#!/usr/bin/env python3
"""Objective checks of the rendered score (nobody can listen on this machine).
usage: analyze.py <out dir>   -> prints a report, writes analysis/report.json
"""
import json, os, sys
import numpy as np
from scipy import signal
from scipy.io import wavfile
sys.path.insert(0, os.path.dirname(__file__))
from dsp import SR, integrated_lufs, short_term, lra, true_peak_db, db, block_loudness

OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/space-video-doodle/music-original/out'
AN = os.path.join(os.path.dirname(OUT.rstrip('/')), 'analysis')
os.makedirs(AN, exist_ok=True)


def load(p):
    sr, x = wavfile.read(p)
    assert sr == SR
    x = x.astype(np.float64)
    if x.dtype.kind == 'i':
        x /= 2 ** 31
    return x.T


beats = json.load(open(os.path.join(OUT, 'beats.json')))
M = load(os.path.join(OUT, 'master_float.wav'))
stems = {f.split('_')[0]: load(os.path.join(OUT, 'stems', f)) for f in sorted(os.listdir(os.path.join(OUT, 'stems'))) if f.endswith('_float.wav')}
rep = {}

# ---------------------------------------------------------------- global
rep['lufs'] = round(integrated_lufs(M), 2)
rep['true_peak_dbtp'] = round(true_peak_db(M), 2)
rep['sample_peak_dbfs'] = round(float(db(np.max(np.abs(M)))), 2)
rep['lra'] = round(lra(M), 1)
rep['dc'] = [round(float(np.mean(M[c])), 6) for c in range(2)]
rep['duration_s'] = round(M.shape[1] / SR, 3)
mono = 0.5 * (M[0] + M[1])
side = 0.5 * (M[0] - M[1])
rep['side_to_mid_db'] = round(float(10 * np.log10(np.mean(side ** 2) / np.mean(mono ** 2))), 1)
rep['correlation'] = round(float(np.corrcoef(M[0], M[1])[0, 1]), 3)

# low end mono check (<120 Hz side energy)
sos = signal.butter(4, 120, 'low', fs=SR, output='sos')
lo_side = signal.sosfilt(sos, side)
lo_mid = signal.sosfilt(sos, mono)
rep['low_side_to_mid_db'] = round(float(10 * np.log10(np.mean(lo_side ** 2) / np.mean(lo_mid ** 2) + 1e-12)), 1)

# ---------------------------------------------------------------- stems: loudness share
rep['stems_lufs'] = {k: round(integrated_lufs(v), 1) for k, v in stems.items()}

# ---------------------------------------------------------------- sections
secs = []
for s in beats['sections']:
    a, b = int(s['start_s'] * SR), int(s['end_s'] * SR)
    seg = M[:, a:b]
    row = dict(name=s['name'], start=s['start_s'], end=s['end_s'])
    _, L, z = block_loudness(seg)
    row['lufs'] = round(float(-0.691 + 10 * np.log10(np.mean(z) + 1e-15)), 1)
    row['peak'] = round(float(db(np.max(np.abs(seg)))), 1)
    for k, v in stems.items():
        sz = v[:, a:b]
        _, _, zz = block_loudness(sz)
        row[k] = round(float(-0.691 + 10 * np.log10(np.mean(zz) + 1e-15)), 1)
    secs.append(row)
rep['sections'] = secs

# ---------------------------------------------------------------- per-bar loudness curve (momentary-ish)
bars = beats['bar_starts_s'] + [beats['total_s']]
curve = []
for i in range(len(bars) - 1):
    a, b = int(bars[i] * SR), int(bars[i + 1] * SR)
    seg = M[:, a:b]
    if seg.shape[1] < SR * 0.4:
        continue
    _, L, z = block_loudness(seg)
    curve.append(round(float(-0.691 + 10 * np.log10(np.mean(z) + 1e-15)), 1))
rep['bar_lufs'] = curve

# ---------------------------------------------------------------- spectrum (1/3 octave) per section + overall
fc = 1000 * 2.0 ** (np.arange(-17, 14) / 3.0)   # 20 Hz .. 20 kHz


def third_oct(x):
    f, P = signal.welch(x, SR, nperseg=8192)
    out = []
    for c in fc:
        lo, hi = c / 2 ** (1 / 6), c * 2 ** (1 / 6)
        m = (f >= lo) & (f < hi)
        out.append(10 * np.log10(np.sum(P[m]) * (f[1] - f[0]) + 1e-20))
    return np.array(out)


spec = third_oct(mono)
rep['third_oct_hz'] = [round(float(c), 1) for c in fc]
rep['third_oct_db'] = [round(float(v - spec.max()), 1) for v in spec]
# broad balance: sub (20-60), low (60-250), lowmid (250-1k), mid (1-4k), high (4-10k), air (10-20k), energy share in dB
f, P = signal.welch(mono, SR, nperseg=8192)
tot = np.sum(P)
bands = dict(sub=(20, 60), low=(60, 250), lowmid=(250, 1000), mid=(1000, 4000), high=(4000, 10000), air=(10000, 20000))
rep['band_share_db'] = {k: round(float(10 * np.log10(np.sum(P[(f >= a) & (f < b)]) / tot)), 1) for k, (a, b) in bands.items()}
# spectral tilt (slope of 1/3-oct levels vs log2 f between 100 Hz and 10 kHz)
m = (fc >= 100) & (fc <= 10000)
slope = np.polyfit(np.log2(fc[m]), spec[m], 1)[0]
rep['tilt_db_per_oct_100_10k'] = round(float(slope), 2)
# spikiness: max deviation of a 1/3-oct band from a smoothed curve (resonance detector)
sm = np.convolve(spec, np.ones(5) / 5, mode='same')
dev = (spec - sm)[3:-3]
rep['max_band_bump_db'] = round(float(dev.max()), 1)
rep['max_band_bump_hz'] = round(float(fc[3:-3][np.argmax(dev)]), 1)

# ---------------------------------------------------------------- chroma vs intended chords (per bar)
names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
chord_pcs = json.load(open(os.path.join(OUT, 'chord_pcs.json'))) if os.path.exists(os.path.join(OUT, 'chord_pcs.json')) else None


def chroma(x):
    n = len(x)
    w = np.hanning(n)
    S = np.abs(np.fft.rfft(x * w)) ** 2
    fr = np.fft.rfftfreq(n, 1 / SR)
    c = np.zeros(12)
    msk = (fr > 60) & (fr < 2000)
    midi = 69 + 12 * np.log2(fr[msk] / 440.0)
    pc = np.round(midi).astype(int) % 12
    np.add.at(c, pc, S[msk])
    return c / (c.sum() + 1e-12)


harm = stems.get('guitars', 0) + stems.get('keys', 0) + stems.get('bass', 0)
hm = 0.5 * (harm[0] + harm[1])
bad = []
if chord_pcs:
    for row in beats['chords_per_bar']:
        a = int(row['start_s'] * SR)
        b = int((row['start_s'] + beats['bar_s']) * SR)
        seg = hm[a:min(b, len(hm))]
        if len(seg) < SR * 0.5 or np.max(np.abs(seg)) < 1e-4:
            continue
        c = chroma(seg)
        pcs = chord_pcs[row['chord']]
        in_chord = float(sum(c[p] for p in pcs))
        top = [names[i] for i in np.argsort(c)[::-1][:4]]
        if in_chord < 0.6:
            bad.append(dict(bar=row['bar'], chord=row['chord'], in_chord=round(in_chord, 2), top=top))
    rep['chroma_bars_checked'] = len(beats['chords_per_bar'])
    rep['chroma_low_bars'] = bad

# ---------------------------------------------------------------- gates: silence depth
gs = []
for g in beats['silences']:
    a, b = int((g['start_s'] + 0.01) * SR), int((g['end_s'] - 0.002) * SR)
    seg = M[:, a:b]
    gs.append(dict(name=g['name'], len_s=round(g['end_s'] - g['start_s'], 3), max_dbfs=round(float(db(np.max(np.abs(seg)) + 1e-12)), 1)))
rep['silences'] = gs

# ---------------------------------------------------------------- hits: level jump at each hit (short-term 0.25 s after vs 0.5 s before)
hits = []
for h in beats['hits']:
    t = h['time_s']
    a0, a1 = int(max(0, t - 0.5) * SR), int(t * SR)
    b0, b1 = int(t * SR), int(min(M.shape[1] / SR, t + 0.25) * SR)
    if a1 - a0 < 100 or b1 - b0 < 100:
        continue
    before = float(db(np.sqrt(np.mean(M[:, a0:a1] ** 2)) + 1e-9))
    after = float(db(np.sqrt(np.mean(M[:, b0:b1] ** 2)) + 1e-9))
    hits.append(dict(name=h['name'], t=t, before_db=round(before, 1), after_db=round(after, 1), jump_db=round(after - before, 1)))
rep['hits'] = hits

# ---------------------------------------------------------------- longest quiet stretch (-50 dBFS, 50 ms windows)
w = int(0.05 * SR)
nw = M.shape[1] // w
rms = np.sqrt(np.mean((M[:, :nw * w].reshape(2, nw, w)) ** 2, axis=(0, 2)))
quiet = rms < 10 ** (-50 / 20)
longest, cur, start, best_start = 0, 0, 0, 0
for i, q in enumerate(quiet):
    if q:
        if cur == 0:
            start = i
        cur += 1
        if cur > longest:
            longest, best_start = cur, start
    else:
        cur = 0
rep['longest_below_-50dBFS_s'] = round(longest * 0.05, 2)
rep['longest_below_-50dBFS_at_s'] = round(best_start * 0.05, 2)

json.dump(rep, open(os.path.join(AN, 'report.json'), 'w'), ensure_ascii=False, indent=1)

# ---------------------------------------------------------------- print
print(f"LUFS {rep['lufs']}  TP {rep['true_peak_dbtp']} dBTP  sample peak {rep['sample_peak_dbfs']}  LRA {rep['lra']}  dur {rep['duration_s']}  DC {rep['dc']}")
print(f"stereo: corr {rep['correlation']}  side/mid {rep['side_to_mid_db']} dB  low(<120) side/mid {rep['low_side_to_mid_db']} dB")
print('stems LUFS:', rep['stems_lufs'])
print('band share dB:', rep['band_share_db'], ' tilt', rep['tilt_db_per_oct_100_10k'], 'dB/oct', ' max bump', rep['max_band_bump_db'], 'dB @', rep['max_band_bump_hz'])
print('1/3 oct (rel dB):', ' '.join(f"{int(c) if c < 1000 else str(round(c / 1000, 1)) + 'k'}:{v}" for c, v in zip(rep['third_oct_hz'], rep['third_oct_db'])))
print(f"{'section':9s} {'start':>6s} {'LUFS':>6s} {'peak':>6s} " + ' '.join(f'{k:>8s}' for k in stems))
for r in secs:
    print(f"{r['name']:9s} {r['start']:6.1f} {r['lufs']:6.1f} {r['peak']:6.1f} " + ' '.join(f'{r[k]:8.1f}' for k in stems))
print('bar LUFS:', rep['bar_lufs'])
print('silences:', rep['silences'], ' longest < -50 dBFS:', rep['longest_below_-50dBFS_s'], 's at', rep['longest_below_-50dBFS_at_s'])
print('hits:')
for h in hits:
    print(f"   {h['name']:16s} {h['t']:7.3f}s  before {h['before_db']:6.1f}  after {h['after_db']:6.1f}  jump {h['jump_db']:+5.1f} dB")
if chord_pcs:
    print(f"chroma: {len(bad)} of {rep['chroma_bars_checked']} bars with < 60 % energy in chord tones:", bad[:12])
