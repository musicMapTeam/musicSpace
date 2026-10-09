#!/usr/bin/env python3
"""Fast screening of 30-75 s middle chunks: tempo, pulse clarity, beat strength, percussive ratio, kick/backbeat,
brightness, loudness, onset density, major/minor estimate.  usage: screen.py chunks_dir out.jsonl"""
import sys, os, json, subprocess, glob
import numpy as np
from scipy import signal
from scipy.ndimage import median_filter
from multiprocessing import Pool
SR = 22050

def decode(p):
    raw = subprocess.check_output(['ffmpeg', '-v', 'quiet', '-i', p, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'])
    return np.frombuffer(raw, dtype=np.float32).copy()

MAJ = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MIN = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])

def flux(S, f, lo, hi, fps, gain=60.0):
    b = (f >= lo) & (f <= hi)
    L = np.log1p(S[b] * gain)
    d = np.maximum(0, np.diff(L, axis=1)).sum(axis=0)
    d = np.concatenate([[0], d])
    k = max(3, int(0.4 * fps))
    return np.maximum(0, d - signal.convolve(d, np.ones(k) / k, mode='same'))

def acf(e):
    e = (e - e.mean()) / (e.std() + 1e-9)
    a = signal.correlate(e, e, mode='full', method='fft')[len(e) - 1:]
    return a / (a[0] + 1e-9)

def tempo(env, fps, lo=60, hi=200, centre=118):
    a = acf(env)
    lags = np.arange(1, len(a))
    bpm = 60 * fps / lags
    prior = np.exp(-0.5 * (np.log2(bpm / centre) / 0.7) ** 2)
    sc = np.where((bpm >= lo) & (bpm <= hi), a[1:] * prior, -1)
    i = int(np.argmax(sc)) + 1
    if 1 <= i < len(a) - 1:
        x, y0, z = a[i - 1], a[i], a[i + 1]; den = x - 2 * y0 + z
        off = 0.5 * (x - z) / den if abs(den) > 1e-9 else 0
    else: off = 0
    return 60 * fps / (i + off), float(a[i]), a

def analyse(p):
    try:
        y = decode(p)
    except Exception as e:
        return {'id': os.path.basename(p)[:-4], 'err': str(e)}
    y = y[int(0.3 * SR):]
    dur = len(y) / SR
    if dur < 12: return {'id': os.path.basename(p)[:-4], 'err': 'short', 'dur': dur}
    y = y[:int(60 * SR)]  # at most 60 s
    rms_db = float(20 * np.log10(np.sqrt(np.mean(y ** 2)) + 1e-9))
    # onset STFT
    hop = 128
    f, t, Z = signal.stft(y, fs=SR, nperseg=1024, noverlap=1024 - hop, boundary=None)
    S = np.abs(Z); fps = SR / hop
    env = flux(S, f, 40, 8000, fps)
    low = flux(S, f, 30, 150, fps)
    snr = flux(S, f, 1500, 6000, fps)
    bpm, pc, a = tempo(env, fps)
    beat = fps * 60 / bpm
    # beat strength: comb phase search, env at beat positions / mean env
    best = (0, 0)
    for ph in np.arange(0, beat, 1.0):
        idx = np.arange(ph, len(env), beat).astype(int)
        v = np.maximum.reduce([env[np.clip(idx + d, 0, len(env) - 1)] for d in (-2, -1, 0, 1, 2)]).mean()
        if v > best[0]: best = (v, ph)
    beat_strength = best[0] / (env.mean() + 1e-9)
    ph = best[1]
    # kick periodicity at beat lag and backbeat (snare-band energy on alternate beats)
    def at(e, lag):
        aa = acf(e); L = int(round(lag)); return float(max(aa[max(1, L - 2):L + 3]))
    kick_per = at(low, beat); snare_per = at(snr, 2 * beat)
    idx = np.arange(ph, len(snr), beat).astype(int); idx = idx[idx < len(snr)]
    vals = np.array([snr[max(0, i - 2):i + 3].max() for i in idx])
    lows = np.array([low[max(0, i - 2):i + 3].max() for i in idx])
    if len(vals) >= 8:
        even, odd = vals[0::2].mean(), vals[1::2].mean()
        backbeat = float(max(even, odd) / (min(even, odd) + 1e-9))
        le, lo_ = lows[0::2].mean(), lows[1::2].mean()
        kick_alt = float(max(le, lo_) / (min(le, lo_) + 1e-9))
    else: backbeat = kick_alt = 1.0
    # onset density: peaks of env above adaptive threshold
    thr = np.percentile(env, 75) + 0.5 * env.std()
    pk, _ = signal.find_peaks(env, height=thr, distance=int(0.07 * fps))
    onset_rate = len(pk) / (len(env) / fps)
    # HPSS on coarser STFT
    f2, t2, Z2 = signal.stft(y, fs=SR, nperseg=2048, noverlap=1536, boundary=None)
    S2 = np.abs(Z2)
    Hm = median_filter(S2, size=(1, 17)); Pm = median_filter(S2, size=(17, 1))
    mp = Pm ** 2 / (Hm ** 2 + Pm ** 2 + 1e-12)
    perc_ratio = float(((S2 * mp) ** 2).sum() / ((S2 ** 2).sum() + 1e-12))
    # brightness
    cent = float(np.median((S2 * f2[:, None]).sum(0) / (S2.sum(0) + 1e-9)))
    # low-end share (< 150 Hz) and air (> 6 kHz)
    E = (S2 ** 2).sum(1); tot = E.sum() + 1e-12
    low_share = float(E[f2 < 150].sum() / tot); air_share = float(E[f2 > 6000].sum() / tot)
    # chroma on harmonic part
    Hh = S2 * (1 - mp)
    ok = (f2 > 60) & (f2 < 2000)
    midi = 69 + 12 * np.log2(f2[ok] / 440.0)
    pcs = np.mod(np.round(midi), 12).astype(int)
    ch = np.zeros(12)
    for k in range(12): ch[k] = Hh[ok][pcs == k].sum()
    ch = ch / (ch.sum() + 1e-9)
    cm = [np.corrcoef(ch, np.roll(MAJ, k))[0, 1] for k in range(12)]
    cn = [np.corrcoef(ch, np.roll(MIN, k))[0, 1] for k in range(12)]
    km, kn = int(np.argmax(cm)), int(np.argmax(cn))
    names = 'C C# D D# E F F# G G# A A# B'.split()
    mode = 'major' if cm[km] >= cn[kn] else 'minor'
    key = names[km] if mode == 'major' else names[kn] + 'm'
    # dynamics inside chunk: RMS per 2 s windows
    w = 2 * SR
    seg = [np.sqrt(np.mean(y[i:i + w] ** 2)) for i in range(0, len(y) - w, w)]
    seg_db = 20 * np.log10(np.array(seg) + 1e-9)
    return {'id': os.path.basename(p)[:-4], 'dur': round(dur, 1), 'bpm': round(bpm, 1), 'pulse': round(pc, 3), 'beat_strength': round(float(beat_strength), 2),
            'kick_per': round(kick_per, 3), 'snare_per': round(snare_per, 3), 'backbeat': round(backbeat, 2), 'kick_alt': round(kick_alt, 2),
            'onset_rate': round(float(onset_rate), 2), 'perc_ratio': round(perc_ratio, 3), 'centroid': int(cent), 'low_share': round(low_share, 3),
            'air_share': round(air_share, 4), 'rms_db': round(rms_db, 1), 'seg_db_span': round(float(seg_db.max() - seg_db.min()), 1) if len(seg_db) else 0,
            'key': key, 'mode_margin': round(float(cm[km] - cn[kn]), 3)}

if __name__ == '__main__':
    d, out = sys.argv[1], sys.argv[2]
    done = set()
    if os.path.exists(out):
        for l in open(out): done.add(json.loads(l)['id'])
    files = [p for p in sorted(glob.glob(os.path.join(d, '*.mp3'))) if os.path.basename(p)[:-4] not in done]
    with Pool(8) as pool, open(out, 'a') as fo:
        for r in pool.imap_unordered(analyse, files, chunksize=4):
            fo.write(json.dumps(r) + '\n'); fo.flush()
    print('analysed', len(files))
