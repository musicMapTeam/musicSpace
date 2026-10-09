#!/usr/bin/env python3
"""Analyze music files for video scoring: duration, loudness (ebur128 via ffmpeg), tempo + beat grid, brightness,
dynamics by 4-bar sections, and a rough 'groove' score (percussive onset regularity).

usage: analyze_music.py file1.mp3 [file2 ...]   -> prints a table; --json out.json to save details
"""
import sys, subprocess, json, re, os
import numpy as np
from scipy import signal

SR = 22050

def decode(path, sr=SR):
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'])
    return np.frombuffer(raw, dtype=np.float32)

def loudness(path):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True)
    t = r.stderr
    m = re.search(r'Integrated loudness:\s+I:\s+(-?[\d.]+) LUFS', t)
    lra = re.search(r'Loudness range:\s+LRA:\s+([\d.]+) LU', t)
    tp = re.search(r'True peak:\s+Peak:\s+(-?[\d.]+) dBFS', t)
    return (float(m.group(1)) if m else None, float(lra.group(1)) if lra else None, float(tp.group(1)) if tp else None)

def onset_env(y, sr=SR, hop=256, n_fft=1024):
    f, t, Z = signal.stft(y, fs=sr, nperseg=n_fft, noverlap=n_fft - hop, boundary=None)
    S = np.abs(Z)
    # log-compress, positive spectral flux across bands (emphasise 40-6000 Hz)
    band = (f >= 40) & (f <= 6000)
    L = np.log1p(S[band] * 50.0)
    flux = np.maximum(0, np.diff(L, axis=1)).sum(axis=0)
    flux = np.concatenate([[0], flux])
    # remove slow trend
    k = int(0.5 * sr / hop)
    trend = signal.convolve(flux, np.ones(k) / k, mode='same')
    env = np.maximum(0, flux - trend)
    return env, sr / hop, f, S

def estimate_tempo(env, fps_env, lo=60, hi=170):
    env = (env - env.mean()) / (env.std() + 1e-9)
    n = len(env)
    ac = signal.correlate(env, env, mode='full')[n - 1:]
    ac /= ac[0] + 1e-9
    lags = np.arange(len(ac))
    bpm = 60.0 * fps_env / np.maximum(lags, 1)
    mask = (bpm >= lo) & (bpm <= hi)
    # weight with log-gaussian prior centred at 100 bpm
    prior = np.exp(-0.5 * (np.log2(bpm / 100.0) / 0.55) ** 2)
    score = np.where(mask, ac * prior, -1)
    # also add contributions of 2x lag (half tempo) for stability
    for i in range(1, len(score) // 2):
        if mask[i]:
            score[i] += 0.5 * ac[2 * i] * prior[i]
    best = int(np.argmax(score))
    # parabolic refine
    if 1 <= best < len(ac) - 1:
        a, b, c = ac[best - 1], ac[best], ac[best + 1]
        denom = (a - 2 * b + c)
        off = 0.5 * (a - c) / denom if abs(denom) > 1e-9 else 0
    else:
        off = 0
    lag = best + off
    return 60.0 * fps_env / lag, ac[best]

def beat_phase(env, fps_env, bpm):
    period = fps_env * 60.0 / bpm
    n = len(env)
    best = (-1, 0)
    for ph in np.arange(0, period, 0.25):
        idx = np.arange(ph, n, period).astype(int)
        idx = idx[idx < n]
        # soft pulse: take max in +-1 frame
        v = np.maximum.reduce([env[np.clip(idx + d, 0, n - 1)] for d in (-1, 0, 1)]).sum()
        if v > best[0]:
            best = (v, ph)
    return best[1] / fps_env

def tempo_drift(env, fps_env, bpm, win_s=20):
    """Estimate tempo in sliding windows to see stability."""
    w = int(win_s * fps_env)
    out = []
    for s in range(0, max(1, len(env) - w), w):
        seg = env[s:s + w]
        if len(seg) < w // 2: break
        t, _ = estimate_tempo(seg, fps_env, lo=bpm * 0.9, hi=bpm * 1.1)
        out.append(round(t, 1))
    return out

def analyze(path):
    y = decode(path)
    dur = len(y) / SR
    env, fps_env, f, S = onset_env(y)
    bpm, conf = estimate_tempo(env, fps_env)
    ph = beat_phase(env, fps_env, bpm)
    I, lra, tp = loudness(path)
    # brightness
    cent = (S * f[:, None]).sum(0) / (S.sum(0) + 1e-9)
    # sections: RMS per 4 beats
    spb = 60.0 / bpm
    sec_len = int(4 * spb * SR)
    rms = [float(np.sqrt(np.mean(y[i:i + sec_len] ** 2))) for i in range(int(ph * SR), len(y) - sec_len, sec_len)]
    rms_db = [round(20 * np.log10(r + 1e-9), 1) for r in rms]
    # groove: fraction of 8th-note grid points that carry an onset above median
    grid = np.arange(ph, dur, spb / 2)
    gi = np.clip((grid * fps_env).astype(int), 0, len(env) - 1)
    thr = np.percentile(env, 70)
    hits = np.array([env[max(0, i - 1):i + 2].max() > thr for i in gi])
    on_beat = hits[::2].mean() if len(hits) else 0
    off_beat = hits[1::2].mean() if len(hits) > 1 else 0
    return {
        'file': os.path.basename(path), 'duration_s': round(dur, 1), 'bpm': round(bpm, 1), 'bpm_conf': round(float(conf), 2),
        'first_beat_s': round(float(ph), 3), 'beat_s': round(spb, 4), 'bar_s': round(4 * spb, 3),
        'tempo_windows': tempo_drift(env, fps_env, bpm),
        'LUFS': I, 'LRA': lra, 'true_peak_dBFS': tp,
        'centroid_hz': int(np.median(cent)), 'onset_on_beat': round(float(on_beat), 2), 'onset_off_beat': round(float(off_beat), 2),
        'rms_4beat_db': rms_db,
    }

if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    out_json = None
    if '--json' in sys.argv:
        out_json = sys.argv[sys.argv.index('--json') + 1]
        args = [a for a in args if a != out_json]
    res = [analyze(p) for p in args]
    for r in res:
        d = r['rms_4beat_db']
        dyn = (max(d) - min(d)) if d else 0
        print(f"{r['file'][:42]:42s} {r['duration_s']:6.1f}s  {r['bpm']:6.1f}bpm (conf {r['bpm_conf']:.2f}, drift {r['tempo_windows'][:6]})  beat0 {r['first_beat_s']:.3f}s  LUFS {r['LUFS']}  LRA {r['LRA']}  TP {r['true_peak_dBFS']}  cent {r['centroid_hz']}Hz  on/off-beat {r['onset_on_beat']}/{r['onset_off_beat']}  RMSspan {dyn:.1f}dB")
    if out_json:
        json.dump(res, open(out_json, 'w'), ensure_ascii=False, indent=1)
