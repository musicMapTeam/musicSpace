#!/usr/bin/env python3
"""Deep analysis of one full track for cutting video to music.

usage: deep.py AUDIO OUT_DIR [--stems DIR_WITH_drums/bass/other/vocals.mp3] [--title "..."]

Writes OUT_DIR/analysis.json and OUT_DIR/analysis.png:
  * tempo (global autocorrelation + comb refinement, octave check), tempo stability (beat-phase drift per 16-beat window,
    linear drift removed by re-estimating the period), beat grid, first downbeat (kick-on-1 + chord-change + backbeat
    evidence, with a confidence margin), bar list (pre-roll included), per-bar RMS / onset density / percussive share,
  * sections (novelty on bar features, snapped to 4-bar phrases) with energy labels,
  * strongest 30 s window (bar-aligned, energy + drive + percussion, bonus for starting on a section entry),
  * stems (demucs htdemucs, if given): energy shares, vocal presence per second, drum pattern on a 16-step grid
    (kick / snare / hats), bass and 'other' (guitars, keys, synths) character,
  * key / mode (Krumhansl profiles on the harmonic part), loudness (EBU R128 via ffmpeg).
Everything is objective signal analysis; nobody listened to the audio."""
import sys, os, json, subprocess, re, argparse
import numpy as np
from scipy import signal
from scipy.ndimage import median_filter, uniform_filter1d

SR = 22050
HOP = 128
FPS = SR / HOP


def decode(p, sr=SR, ch=1):
    raw = subprocess.check_output(['ffmpeg', '-v', 'quiet', '-i', p, '-ac', str(ch), '-ar', str(sr), '-f', 'f32le', '-'])
    y = np.frombuffer(raw, dtype=np.float32).copy()
    return y.reshape(-1, ch).T if ch > 1 else y


def loudness(p):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', p, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    g = lambda pat: (float(m.group(1)) if (m := re.search(pat, r)) else None)
    return dict(I=g(r'I:\s+(-?[\d.]+) LUFS\s*\n\s*Threshold'), LRA=g(r'LRA:\s+([\d.]+) LU\s*\n'), TP=g(r'Peak:\s+(-?[\d.]+) dBFS'))


def stft_mag(y, n=1024, hop=HOP):
    f, t, Z = signal.stft(y, fs=SR, nperseg=n, noverlap=n - hop, boundary=None, padded=False)
    return f, np.abs(Z)


def flux(S, f, lo, hi, gain=60.0, detrend=0.4):
    b = (f >= lo) & (f <= hi)
    L = np.log1p(S[b] * gain)
    d = np.maximum(0, np.diff(L, axis=1)).sum(axis=0)
    d = np.concatenate([[0], d])
    if detrend:
        k = max(3, int(detrend * FPS))
        d = np.maximum(0, d - uniform_filter1d(d, k))
    return d


def acf(e):
    e = (e - e.mean()) / (e.std() + 1e-9)
    a = signal.correlate(e, e, mode='full', method='fft')[len(e) - 1:]
    return a / (a[0] + 1e-9)


def global_tempo(env):
    a = acf(env)
    lags = np.arange(1, len(a))
    bpm = 60 * FPS / lags
    prior = np.exp(-0.5 * (np.log2(bpm / 118) / 0.7) ** 2)
    sc = np.where((bpm >= 60) & (bpm <= 200), a[1:] * prior, -1)
    i = int(np.argmax(sc)) + 1
    x, y0, z = a[i - 1], a[i], a[i + 1]
    den = x - 2 * y0 + z
    lag = i + (0.5 * (x - z) / den if abs(den) > 1e-9 else 0)
    T = 60 * FPS / lag
    note = ''
    # octave check: prefer 90-180 if the other octave is almost as strong
    def strength(Tc):
        L = 60 * FPS / Tc; k = int(round(L))
        return float(max(a[max(1, k - 2):k + 3])) if k + 3 < len(a) else 0
    if (T < 85 and strength(2 * T) >= 0.25 * strength(T)) or (T < 95 and strength(2 * T) >= 0.6 * strength(T)):
        T *= 2; note = 'doubled (autocorrelation peak was the half-time pulse)'
    elif T > 170 and strength(T / 2) >= 0.6 * strength(T):
        T /= 2; note = 'halved'
    return T, float(y0), note


FLUX_BIAS = 0.030  # s; spectral-flux peaks come ~30 ms before the true onset with this STFT (calibrated on synthetic hits)


def comb(env, T, ph_step=0.25, spread=0.015, n_cand=61):
    """fold the onset envelope at each candidate period (0.25-frame bins, circular Gaussian smoothing sigma 0.75 frame);
    returns (bpm, phase_frames) with a parabolic sub-bin refinement of the phase"""
    idx = np.arange(len(env))
    best = (-1, T, 0.0)
    for cand in np.linspace(T * (1 - spread), T * (1 + spread), n_cand):
        period = FPS * 60 / cand
        nb = int(np.ceil(period / ph_step))
        b = np.minimum(((idx % period) / ph_step).astype(int), nb - 1)
        acc = np.bincount(b, weights=env, minlength=nb)
        cnt = np.bincount(b, minlength=nb) + 1e-9
        v = acc / cnt
        k = np.arange(-8, 9); g = np.exp(-0.5 * (k * ph_step / 0.75) ** 2); g /= g.sum()
        vs = np.real(np.fft.ifft(np.fft.fft(v) * np.fft.fft(np.roll(np.r_[g, np.zeros(nb - len(g))], -8))))
        j = int(np.argmax(vs))
        if vs[j] > best[0]:
            a_, b_, c_ = vs[j - 1], vs[j], vs[(j + 1) % nb]
            den = a_ - 2 * b_ + c_
            off = 0.5 * (a_ - c_) / den if abs(den) > 1e-12 else 0.0
            best = (float(vs[j]), cand, ((j + off) * ph_step) % period)
    return best[1], best[2]


def local_offsets(env, T, ph, win_beats=16):
    """phase offset (frames) of the best local alignment in each window, relative to the global grid"""
    period = FPS * 60 / T
    beats = np.arange(ph, len(env) - 1, period)
    out = []
    for s in range(0, len(beats) - win_beats, win_beats // 2):
        bb = beats[s:s + win_beats]
        best = (-1, 0)
        for o in np.arange(-0.2 * period, 0.2 * period + 0.01, 0.5):
            idx = np.clip((bb + o).astype(int), 0, len(env) - 1)
            v = env[idx].sum()
            if v > best[0]:
                best = (v, o)
        # strength of local alignment vs random phase
        rnd = np.mean([env[np.clip((bb + r).astype(int), 0, len(env) - 1)].sum() for r in np.linspace(0, period, 9)[1:-1]])
        out.append((float(bb[len(bb) // 2] / FPS), float(best[1] / FPS * 1000), float(best[0] / (rnd + 1e-9))))
    return out


def chroma_frames(S, f):
    ok = (f > 55) & (f < 2000)
    midi = 69 + 12 * np.log2(f[ok] / 440.0)
    pcs = np.mod(np.round(midi), 12).astype(int)
    C = np.zeros((12, S.shape[1]))
    for k in range(12):
        C[k] = S[ok][pcs == k].sum(axis=0)
    return C


MAJ = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MIN = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
NAMES = 'C C# D D# E F F# G G# A A# B'.split()


def key_of(ch):
    ch = ch / (ch.sum() + 1e-9)
    cm = [np.corrcoef(ch, np.roll(MAJ, k))[0, 1] for k in range(12)]
    cn = [np.corrcoef(ch, np.roll(MIN, k))[0, 1] for k in range(12)]
    km, kn = int(np.argmax(cm)), int(np.argmax(cn))
    if cm[km] >= cn[kn]:
        return dict(key=NAMES[km] + ' major', r=round(float(cm[km]), 3), alt=NAMES[kn] + ' minor', r_alt=round(float(cn[kn]), 3))
    return dict(key=NAMES[kn] + ' minor', r=round(float(cn[kn]), 3), alt=NAMES[km] + ' major', r_alt=round(float(cm[km]), 3))


def novelty(F, k=4):
    """Foote checkerboard novelty on a bar-feature matrix F (bars x dims)."""
    X = (F - F.mean(0)) / (F.std(0) + 1e-9)
    Xn = X / (np.linalg.norm(X, axis=1, keepdims=True) + 1e-9)
    Ssm = Xn @ Xn.T
    n = len(F)
    g = np.outer(np.r_[-np.ones(k), np.ones(k)], np.r_[-np.ones(k), np.ones(k)]) * -1
    nov = np.zeros(n)
    for i in range(k, n - k):
        nov[i] = (Ssm[i - k:i + k, i - k:i + k] * g).sum()
    return nov


def drum_grid(stem, bar_starts, bar_s, lo, hi, nsteps=16):
    f, S = stft_mag(stem, n=1024, hop=HOP)
    e = flux(S, f, lo, hi, detrend=0.25)
    thr = np.percentile(e, 60)
    grid = np.zeros(nsteps)
    cnt = 0
    for b0 in bar_starts:
        if b0 < 0 or b0 + bar_s > len(e) / FPS:
            continue
        cnt += 1
        for k in range(nsteps):
            t = b0 + k * bar_s / nsteps - FLUX_BIAS
            i = int(round(t * FPS))
            w_ = e[max(0, i - 3):min(len(e), i + 4)]
            if len(w_):
                grid[k] += w_.max()
    grid = grid / max(cnt, 1)
    return (grid / (grid.max() + 1e-9)).round(2).tolist(), float(thr)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('audio'); ap.add_argument('out')
    ap.add_argument('--stems', default=None); ap.add_argument('--title', default=None)
    ap.add_argument('--win', type=float, default=30.0)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    y = decode(a.audio)
    dur = len(y) / SR
    f, S = stft_mag(y)
    env = flux(S, f, 40, 8000)
    low = flux(S, f, 30, 150)
    snr = flux(S, f, 1500, 6000)
    T0, conf, octave_note = global_tempo(env)
    T, ph = comb(env, T0)
    # drift check + period refinement by linear regression of local offsets
    offs = local_offsets(env, T, ph)
    good = [(t, o) for t, o, s in offs if s > 1.15]
    if len(good) >= 4:
        tt, oo = np.array(good).T
        slope, icpt = np.polyfit(tt, oo, 1)  # ms per s
        if abs(slope) > 0.05:
            # adjust period: beat drifts by slope ms per second -> period scale (1 + slope/1000)
            T = T / (1 + slope / 1000.0)
            T, ph = comb(env, T, spread=0.002)
            offs = local_offsets(env, T, ph)
            good = [(t, o) for t, o, s in offs if s > 1.15]
    resid = np.array([o for t, o in good]) if good else np.array([0.0])
    beat = 60 / T
    first_beat0 = ph / FPS + FLUX_BIAS  # time of beats_f[0]
    first_beat = first_beat0
    while first_beat - beat >= 0:
        first_beat -= beat
    # downbeat evidence for 4 phases
    period = FPS * beat
    beats_f = np.arange(ph, len(env) - 1, period)
    C = chroma_frames(S, f)
    Cs = uniform_filter1d(C, size=int(period), axis=1)
    def at(e, idx):
        return np.array([e[max(0, int(i) - 2):int(i) + 3].max() for i in idx])
    kick_b = at(low, beats_f)
    snr_b = at(snr, beats_f)
    # chord-change novelty at each beat: chroma (normalised) before vs after
    chg = []
    for i in beats_f:
        i = int(i); w = int(period * 2)
        if i - w < 0 or i + w >= C.shape[1]:
            chg.append(0); continue
        p = C[:, i - w:i].sum(1); q = C[:, i:i + w].sum(1)
        p = p / (np.linalg.norm(p) + 1e-9); q = q / (np.linalg.norm(q) + 1e-9)
        chg.append(1 - float(p @ q))
    chg = np.array(chg)
    sc = []
    for k in range(4):
        sel = np.arange(k, len(beats_f), 4)
        bb = np.arange((k + 1) % 4, len(beats_f), 4); bb2 = np.arange((k + 3) % 4, len(beats_f), 4)
        z = lambda v, s: (v[s].mean() - v.mean()) / (v.std() + 1e-9)
        backbeat = (z(snr_b, bb) + z(snr_b, bb2)) / 2
        sc.append(dict(kick=round(float(z(kick_b, sel)), 3), chord_change=round(float(z(chg, sel)), 3), backbeat=round(float(backbeat), 3)))
    tot = [s['kick'] + 1.2 * s['chord_change'] + 0.6 * s['backbeat'] for s in sc]
    order = np.argsort(tot)[::-1]
    db = int(order[0])
    db_margin = float(tot[order[0]] - tot[order[1]])
    first_down = first_beat0 + db * beat
    while first_down - 4 * beat >= 0:
        first_down -= 4 * beat
    bar_s = 4 * beat
    bars = []
    t0 = first_down
    while t0 - bar_s > -bar_s * 0.999 and t0 - bar_s >= -1e-9:
        t0 -= bar_s
    pre = first_down
    starts = []
    t = first_down
    while t - bar_s >= 0:
        t -= bar_s
    while t < dur - 0.5:
        starts.append(round(float(t), 3)); t += bar_s
    # per-bar features
    f2, S2 = stft_mag(y, n=2048, hop=512)
    Hm = median_filter(S2, size=(1, 17)); Pm = median_filter(S2, size=(17, 1))
    mp = Pm ** 2 / (Hm ** 2 + Pm ** 2 + 1e-12)
    fps2 = SR / 512
    perc_e = ((S2 * mp) ** 2).sum(0); tot_e = (S2 ** 2).sum(0) + 1e-12
    C2 = chroma_frames(S2 * (1 - mp), f2)
    bar_feat = []
    rows = []
    for b0 in starts:
        i0, i1 = int(b0 * SR), int(min(dur, b0 + bar_s) * SR)
        seg = y[i0:i1]
        rms = 20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-9) if len(seg) > 100 else -90
        j0, j1 = int((b0 - FLUX_BIAS) * FPS), int((min(dur, b0 + bar_s) - FLUX_BIAS) * FPS)
        e = env[j0:j1]
        thr = np.percentile(env, 75) + 0.5 * env.std()
        pk, _ = signal.find_peaks(e, height=thr, distance=int(0.07 * FPS)) if len(e) > 3 else ([], None)
        k0, k1 = int(b0 * fps2), int(min(dur, b0 + bar_s) * fps2)
        pr = float(perc_e[k0:k1].sum() / tot_e[k0:k1].sum()) if k1 > k0 else 0
        ch = C2[:, k0:k1].sum(1) if k1 > k0 else np.zeros(12)
        ch = ch / (ch.sum() + 1e-9)
        cen = float((S2[:, k0:k1] * f2[:, None]).sum() / (S2[:, k0:k1].sum() + 1e-9)) if k1 > k0 else 0
        rows.append(dict(t=b0, rms_db=round(float(rms), 1), onsets=int(len(pk)), perc=round(pr, 3), centroid=int(cen)))
        bar_feat.append(np.r_[ch * 3, [rms / 6, pr * 4, len(pk) / 4, cen / 1500]])
    F = np.array(bar_feat)
    _r = np.array([r['rms_db'] for r in rows])
    first_active = next((r['t'] for r in rows if r['rms_db'] > _r.max() - 25), rows[0]['t'])
    nov = novelty(F, k=4) if len(F) > 10 else np.zeros(len(F))
    # boundaries: novelty peaks, snapped to 4-bar phrase grid when within 1 bar
    pk, _ = signal.find_peaks(nov, distance=4, height=np.percentile(nov, 70) if len(nov) else 0)
    rms_tmp = np.array([r['rms_db'] for r in rows])
    steps = [i for i in range(1, len(rms_tmp)) if abs(rms_tmp[i] - rms_tmp[i - 1]) >= 4.0 and
             (i + 1 >= len(rms_tmp) or abs(rms_tmp[i + 1] - rms_tmp[i - 1]) >= 3.0)]
    bounds = sorted(set([0] + [int(p) for p in pk] + steps + [len(rows)]))
    # merge tiny sections (<4 bars)
    merged = [bounds[0]]
    for b in bounds[1:]:
        if b - merged[-1] >= 4 or b == len(rows) or b in steps or merged[-1] in steps:
            if b - merged[-1] >= 2 or b == len(rows):
                merged.append(b)
    if len(merged) >= 2 and merged[-1] - merged[-2] < 4 and len(merged) > 2:
        merged.pop(-2)
    rms_arr = np.array([r['rms_db'] for r in rows])
    ons_arr = np.array([r['onsets'] for r in rows], float)
    perc_arr = np.array([r['perc'] for r in rows])
    loud_ref = np.percentile(rms_arr, 90)
    secs = []
    for s0, s1 in zip(merged[:-1], merged[1:]):
        m = float(rms_arr[s0:s1].mean())
        lvl = 'peak' if m >= loud_ref - 1.5 else 'high' if m >= loud_ref - 4 else 'mid' if m >= loud_ref - 8 else 'low'
        secs.append(dict(bars=[s0 + 1, s1], t=[rows[s0]['t'], round(rows[s1 - 1]['t'] + bar_s, 3)], rms_db=round(m, 1),
                         onsets_per_bar=round(float(ons_arr[s0:s1].mean()), 1), perc=round(float(perc_arr[s0:s1].mean()), 3), level=lvl))
    # strongest window
    nb = max(4, int(round(a.win / bar_s)))
    zs = lambda v: (v - v.mean()) / (v.std() + 1e-9)
    score_bar = zs(rms_arr) * 1.0 + zs(ons_arr) * 0.6 + zs(perc_arr) * 0.5
    sec_starts = set(s0 for s0, _ in zip(merged[:-1], merged[1:]))
    best = (-1e9, 0)
    for i in range(0, max(1, len(rows) - nb + 1)):
        if rows[i]['t'] + a.win > dur - 0.2:
            break
        v = score_bar[i:i + nb].mean()
        if i in sec_starts and i > 0 and rms_arr[i] - rms_arr[i - 1] > 1.0:
            v += 0.25  # starts on a section entry with an energy step
        elif i % 4 == 0:
            v += 0.08
        if v > best[0]:
            best = (v, i)
    wi = best[1]
    window = dict(start_bar=wi + 1, start_s=rows[wi]['t'], end_s=round(rows[wi]['t'] + a.win, 3), bars=nb,
                  bars_exact_s=round(nb * bar_s, 3), mean_rms_db=round(float(rms_arr[wi:wi + nb].mean()), 1))
    # key from harmonic chroma
    key = key_of(C2.sum(1))
    # stems
    stems = None
    if a.stems and os.path.exists(os.path.join(a.stems, 'drums.mp3')):
        st = {k: decode(os.path.join(a.stems, f'{k}.mp3')) for k in ('drums', 'bass', 'other', 'vocals')}
        n = min(len(v) for v in st.values())
        st = {k: v[:n] for k, v in st.items()}
        # demucs mp3 stems carry an encoder delay: measure it against the mix and remove it
        ssum = sum(st.values())
        s0, s1 = int(min(30, dur / 4) * SR), int(min(60, dur / 2) * SR)
        xc = signal.correlate(ssum[s0:s1], y[s0:s1], mode='full', method='fft')
        stem_lag = int(np.argmax(xc) - (s1 - s0 - 1))
        if 0 < stem_lag < SR // 4:
            st = {k: np.r_[v[stem_lag:], np.zeros(stem_lag, np.float32)] for k, v in st.items()}
        elif -SR // 4 < stem_lag < 0:
            st = {k: np.r_[np.zeros(-stem_lag, np.float32), v[:stem_lag]] for k, v in st.items()}
        E = {k: float((v ** 2).sum()) for k, v in st.items()}
        Et = sum(E.values()) + 1e-12
        mix = y[:n]
        w = SR
        vr = []
        for i in range(0, n - w, w):
            am = np.sqrt(np.mean(mix[i:i + w] ** 2)) + 1e-9
            av = np.sqrt(np.mean(st['vocals'][i:i + w] ** 2)) + 1e-9
            if am > 10 ** (-45 / 20):
                vr.append(20 * np.log10(av / am))
        vr = np.array(vr)
        kick_grid, _ = drum_grid(st['drums'], starts, bar_s, 30, 130)
        snare_grid, _ = drum_grid(st['drums'], starts, bar_s, 1200, 5000)
        hat_grid, _ = drum_grid(st['drums'], starts, bar_s, 7000, 11000)
        # bass/other character
        fb, Sb = stft_mag(st['bass'], n=4096, hop=512)
        sp = Sb.mean(1); band = (fb > 30) & (fb < 400)
        bass_peak = float(fb[band][np.argmax(sp[band])])
        def onset_rate(v):
            ff, SS = stft_mag(v)
            e = flux(SS, ff, 40, 8000)
            thr = np.percentile(e, 75) + 0.5 * e.std()
            p, _ = signal.find_peaks(e, height=thr, distance=int(0.07 * FPS))
            return round(len(p) / (len(e) / FPS), 2)
        fo, So = stft_mag(st['other'], n=2048, hop=512)
        Ho = median_filter(So, size=(1, 17)); Po = median_filter(So, size=(17, 1))
        mpo = Po ** 2 / (Ho ** 2 + Po ** 2 + 1e-12)
        o_perc = float(((So * mpo) ** 2).sum() / ((So ** 2).sum() + 1e-12))
        o_cent = float(np.median((So * fo[:, None]).sum(0) / (So.sum(0) + 1e-9)))
        gm = np.exp(np.mean(np.log(So[(fo > 300) & (fo < 6000)] + 1e-9), axis=0)); am_ = np.mean(So[(fo > 300) & (fo < 6000)], axis=0) + 1e-9
        o_flat = float(np.median(gm / am_))
        # sustain: fraction of frames whose 'other' energy stays within 3 dB of its 1-s max (pads/organs/distorted guitars sustain)
        oe = 10 * np.log10((So ** 2).sum(0) + 1e-12)
        mx = median_filter(oe, size=int(SR / 512))  # ~1 s median
        stems = dict(stem_lag_ms=round(stem_lag / SR * 1000, 1), energy_share={k: round(E[k] / Et, 3) for k in E},
                     vocals=dict(rel_db_overall=round(float(10 * np.log10(E['vocals'] / (Et + 1e-12) + 1e-12)), 1),
                                 median_db=round(float(np.median(vr)), 1) if len(vr) else None,
                                 p95_db=round(float(np.percentile(vr, 95)), 1) if len(vr) else None,
                                 frac_seconds_above_m10db=round(float((vr > -10).mean()), 3) if len(vr) else None,
                                 frac_seconds_above_m15db=round(float((vr > -15).mean()), 3) if len(vr) else None),
                     drum_grid_16=dict(kick=kick_grid, snare=snare_grid, hats=hat_grid),
                     drums_onset_rate=onset_rate(st['drums']), bass_onset_rate=onset_rate(st['bass']), other_onset_rate=onset_rate(st['other']),
                     bass_peak_hz=round(bass_peak, 1), other_centroid_hz=int(o_cent), other_percussive_share=round(o_perc, 3),
                     other_flatness=round(o_flat, 3))
    lo = loudness(a.audio)
    res = dict(file=os.path.basename(a.audio), title=a.title, duration_s=round(dur, 2), loudness=lo,
               tempo=dict(bpm=round(float(T), 2), beat_s=round(beat, 4), bar_s=round(bar_s, 4), autocorr_conf=round(conf, 3), octave_note=octave_note,
                          drift_ms=dict(windows=len(offs), aligned_windows=len(good), resid_sd=round(float(resid.std()), 1),
                                        resid_max_abs=round(float(np.abs(resid - np.median(resid)).max()), 1))),
               grid=dict(first_beat_s=round(first_beat, 3), downbeat_offset_beats=db, downbeat_scores=sc, downbeat_margin=round(db_margin, 3),
                         first_downbeat_s=round(float(first_down), 3), first_active_downbeat_s=first_active, n_bars=len(starts), bar_starts_s=starts),
               bars=rows, sections=secs, strongest_window=window, key=key, stems=stems,
               note='Constant-tempo grid fitted to the whole track (comb + drift regression). downbeat chosen from kick-on-1, chord-change and backbeat evidence; '
                    'a small margin means check one bar by eye on the waveform. Nobody listened to the track.')
    json.dump(res, open(os.path.join(a.out, 'analysis.json'), 'w'), indent=1, ensure_ascii=False)
    # figure
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    fig = plt.figure(figsize=(16, 9.6), dpi=100)
    ax1 = fig.add_axes([0.05, 0.62, 0.92, 0.33])
    fm, Sm = stft_mag(y, n=2048, hop=512)
    keep = fm < 11000
    Sdb = 20 * np.log10(Sm[keep] + 1e-6)
    # log-frequency display
    ax1.imshow(Sdb, origin='lower', aspect='auto', extent=[0, dur, 0, 11000], cmap='magma', vmin=Sdb.max() - 80, vmax=Sdb.max())
    ax1.set_yscale('symlog', linthresh=300); ax1.set_ylim(30, 11000)
    ax1.set_title(f"{a.title or os.path.basename(a.audio)}  |  {T:.1f} BPM, bar {bar_s:.3f}s, first downbeat {first_down:.3f}s, key {key['key']}, {lo['I']} LUFS")
    for s in secs:
        ax1.axvline(s['t'][0], color='cyan', lw=1, alpha=.8)
    ax1.axvspan(window['start_s'], window['end_s'], color='lime', alpha=.12)
    ax1.set_ylabel('Hz')
    ax2 = fig.add_axes([0.05, 0.36, 0.92, 0.22], sharex=ax1)
    tb = [r['t'] for r in rows]
    ax2.step(tb, rms_arr, where='post', color='k', label='bar RMS dB')
    ax2b = ax2.twinx(); ax2b.step(tb, ons_arr, where='post', color='tab:orange', alpha=.6, label='onsets/bar'); ax2b.set_ylabel('onsets/bar')
    for s in secs:
        ax2.axvline(s['t'][0], color='tab:blue', lw=1, alpha=.6)
        ax2.text(s['t'][0] + .3, rms_arr.min() + 0.5, f"b{s['bars'][0]} {s['level']}", fontsize=7, color='tab:blue')
    ax2.axvspan(window['start_s'], window['end_s'], color='lime', alpha=.15)
    ax2.set_ylabel('bar RMS dBFS'); ax2.set_xlim(0, dur); ax2.set_xlabel('s')
    if stems:
        ax3 = fig.add_axes([0.05, 0.05, 0.44, 0.24])
        g = stems['drum_grid_16']
        M = np.array([g['kick'], g['snare'], g['hats']])
        ax3.imshow(M, aspect='auto', cmap='Greys', vmin=0, vmax=1)
        ax3.set_yticks([0, 1, 2]); ax3.set_yticklabels(['kick', 'snare', 'hats']); ax3.set_xticks(range(16)); ax3.set_xticklabels(['1', 'e', '+', 'a', '2', 'e', '+', 'a', '3', 'e', '+', 'a', '4', 'e', '+', 'a'])
        ax3.set_title('average drum hits per 16th (drum stem)')
        ax4 = fig.add_axes([0.56, 0.05, 0.41, 0.24])
        es = stems['energy_share']
        ax4.bar(list(es.keys()), list(es.values()), color=['#1c1b1a', '#5fdcc0', '#ffd447', '#ff5c8a'])
        ax4.set_title(f"stem energy share  (vocals stem median {stems['vocals']['median_db']} dB re mix, {100 * (stems['vocals']['frac_seconds_above_m10db'] or 0):.0f}% of seconds > -10 dB)")
    fig.savefig(os.path.join(a.out, 'analysis.png'))
    print(json.dumps(dict(file=res['file'], bpm=res['tempo']['bpm'], drift=res['tempo']['drift_ms'], first_down=res['grid']['first_downbeat_s'],
                          db_margin=res['grid']['downbeat_margin'], key=key['key'], LUFS=lo['I'], LRA=lo['LRA'], window=window,
                          stems=(stems['energy_share'] if stems else None), vocals=(stems['vocals'] if stems else None))))


if __name__ == '__main__':
    main()
