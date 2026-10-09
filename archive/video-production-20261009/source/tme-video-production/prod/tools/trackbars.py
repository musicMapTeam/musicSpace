#!/usr/bin/env python3
"""Per-bar feature table of a track on its beats.json grid (used to choose tempo-map segments; nobody can listen here).

  PY tools/trackbars.py <beats.json> [--audio file] [--json out.json] [--from 50 --to 80]

Columns per bar (all measured on the decoded audio, mono 22.05 kHz):
  rms      full-band RMS dBFS of the bar
  low      30-150 Hz RMS dB (kick + bass)          hi    5-12 kHz RMS dB (hats, cymbals, snare air)
  kick     mean low-band onset strength on the 4 beats / bar mean (>1.5 = kick on the beats)
  perc     high-band spectral-flux density (onsets/s weighted); ~0 = no drums/percussion
  b4gap    RMS of the last 8th of the bar vs the bar RMS, dB (< -10 = a stop/gap before the next downbeat)
  hit      RMS of beat 1 vs RMS of the previous bar's beat 4, dB (> +6 = an entry/drop on this downbeat)
  chroma   cosine similarity of this bar's chroma to the previous bar's (harmonic continuity)
Flags: STOP (rms 6 dB under the 8-bar median), DRUMLESS (perc < 0.25 x track median), DROP (hit > +6 dB and the bar is not quiet),
       GAP (b4gap < -12 dB).
"""
import argparse, json, subprocess, sys
import numpy as np
from scipy.signal import stft

FF = '/opt/homebrew/bin/ffmpeg'
SR = 22050


def decode(path, sr=SR):
    raw = subprocess.run([FF, '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '1', '-ar', str(sr), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)


def db(x):
    return 20 * np.log10(np.maximum(x, 1e-9))


def features(beats_path, audio=None):
    B = json.load(open(beats_path))
    if audio is None:
        import os
        audio = os.path.join(os.path.dirname(beats_path), B['file']) if 'file' in B else None
        if audio and not os.path.exists(audio):
            files = B.get('files', {})
            audio = os.path.join(os.path.dirname(beats_path), files.get('master_wav', ''))
    x = decode(audio)
    bars = list(B['bar_starts_s'])
    bar_s = B.get('bar_s') or (bars[1] - bars[0])
    bars.append(bars[-1] + bar_s)
    hop = 256
    f, t, Z = stft(x, SR, nperseg=2048, noverlap=2048 - hop, boundary=None, padded=False)
    t = t  # frame centres
    M = np.abs(Z)
    def band(lo, hi):
        m = (f >= lo) & (f < hi)
        return np.sqrt((M[m] ** 2).mean(axis=0) + 1e-18)
    low, hi = band(30, 150), band(5000, 11000)
    flux_hi = np.maximum(0, np.diff(np.log1p(1000 * M[(f >= 2500) & (f < 11000)]), axis=1)).sum(axis=0)
    flux_lo = np.maximum(0, np.diff(np.log1p(1000 * M[(f >= 30) & (f < 150)]), axis=1)).sum(axis=0)
    flux_hi = np.concatenate([[0], flux_hi]); flux_lo = np.concatenate([[0], flux_lo])
    # chroma (12 bins) from 110-3520 Hz
    fm = (f >= 110) & (f < 3520)
    pc = np.round(12 * np.log2(f[fm] / 440.0)).astype(int) % 12
    C = np.zeros((12, M.shape[1]))
    for k in range(12):
        C[k] = (M[fm][pc == k] ** 2).sum(axis=0)
    def seg(arr, a, b):
        i0, i1 = np.searchsorted(t, a), np.searchsorted(t, b)
        return arr[..., i0:max(i0 + 1, i1)]
    def rms_t(a, b):
        i0, i1 = int(a * SR), int(b * SR)
        s = x[i0:max(i0 + 1, i1)]
        return float(np.sqrt((s ** 2).mean() + 1e-18))
    rows = []
    prev_ch = None
    for n in range(len(bars) - 1):
        a, b = bars[n], bars[n + 1]
        if a >= len(x) / SR:
            break
        L = b - a; beat = L / 4
        r = rms_t(a, b)
        lo_db = float(db(seg(low, a, b).mean())); hi_db = float(db(seg(hi, a, b).mean()))
        fl = seg(flux_lo, a, b); fh = seg(flux_hi, a, b)
        kick_on = np.mean([seg(flux_lo, a + k * beat - 0.03, a + k * beat + 0.05).max() if seg(flux_lo, a + k * beat - 0.03, a + k * beat + 0.05).size else 0 for k in range(4)])
        kick = float(kick_on / (fl.mean() + 1e-9))
        perc = float(fh.mean())
        last8 = rms_t(b - L / 8, b)
        b4gap = float(db(last8) - db(r))
        first = rms_t(a, a + beat)
        prevb4 = rms_t(a - beat, a) if n > 0 else 1e-9
        hit = float(db(first) - db(prevb4))
        ch = seg(C, a, b).sum(axis=1); ch = ch / (np.linalg.norm(ch) + 1e-12)
        cs = float(ch @ prev_ch) if prev_ch is not None else 1.0
        prev_ch = ch
        rows.append(dict(bar=n + 1, t=round(a, 3), rms=round(float(db(r)), 1), low=round(lo_db, 1), hi=round(hi_db, 1), kick=round(kick, 2),
                         perc=round(perc, 2), b4gap=round(b4gap, 1), hit=round(hit, 1), chroma=round(cs, 2), chroma_vec=[round(float(v), 4) for v in ch]))
    med_perc = float(np.median([r_['perc'] for r_ in rows])) or 1e-9
    for i, r_ in enumerate(rows):
        win = [q['rms'] for q in rows[max(0, i - 4):i + 4]]
        flags = []
        if r_['rms'] < np.median(win) - 6:
            flags.append('STOP')
        if r_['perc'] < 0.25 * med_perc:
            flags.append('DRUMLESS')
        if r_['hit'] > 6 and r_['rms'] > np.median([q['rms'] for q in rows]) - 6:
            flags.append('DROP')
        if r_['b4gap'] < -12:
            flags.append('GAP')
        r_['perc_rel'] = round(r_['perc'] / med_perc, 2)
        r_['flags'] = flags
    return dict(beats=beats_path, audio=audio, bpm=B.get('tempo_bpm') or B.get('bpm'), bar_s=bar_s, rows=rows)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('beats'); ap.add_argument('--audio'); ap.add_argument('--json'); ap.add_argument('--from', dest='a', type=int, default=1); ap.add_argument('--to', dest='b', type=int, default=10 ** 6)
    a = ap.parse_args()
    F = features(a.beats, a.audio)
    print(f"{F['audio']}  {F['bpm']} BPM  bar {F['bar_s']:.4f} s  {len(F['rows'])} bars")
    print(' bar      t    rms   low    hi  kick perc_rel b4gap   hit chroma  flags')
    for r in F['rows']:
        if a.a <= r['bar'] <= a.b:
            print(f"{r['bar']:4d} {r['t']:7.2f} {r['rms']:6.1f} {r['low']:5.1f} {r['hi']:5.1f} {r['kick']:5.2f} {r['perc_rel']:6.2f} {r['b4gap']:6.1f} {r['hit']:5.1f}  {r['chroma']:.2f}  {' '.join(r['flags'])}")
    if a.json:
        json.dump(F, open(a.json, 'w'), indent=0)
