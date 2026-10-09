"""Onset map of the edited music bed under my act's bars (A6-A7, 73:1 -> end): which 16ths carry strong hits.
   PY onsets.py <map> [bar0 bar1]"""
import json, sys
import numpy as np
sys.path.insert(0, '/tmp/space-video-doodle/prod/tools')
import audiolib, tempo
mid = sys.argv[1] if len(sys.argv) > 1 else 'flipping-in'
b0 = int(sys.argv[2]) if len(sys.argv) > 2 else 73
b1 = int(sys.argv[3]) if len(sys.argv) > 3 else 90
C = tempo.load_compiled(mid); tl = tempo.Timeline(C)
x = audiolib.decode(f'/tmp/space-video-doodle/prod/audio/beds/{mid}.wav')
env, ft = audiolib.onset_env(x)
bias = audiolib.ONSET_BIAS_MS / 1000
# low band (kick) envelope: 30-150 Hz RMS in 10 ms windows
from scipy.signal import butter, sosfiltfilt
m = x.mean(axis=1)
sos = butter(4, [30, 150], btype='band', fs=audiolib.SR, output='sos'); lo = sosfiltfilt(sos, m)
sos2 = butter(4, 5000, btype='high', fs=audiolib.SR, output='sos'); hi = sosfiltfilt(sos2, m)
def rms(sig, t, w=0.06):
    a, b = int(t * audiolib.SR), int((t + w) * audiolib.SR); s = sig[max(0, a):max(a + 1, b)]
    return 20 * np.log10(np.sqrt((s ** 2).mean() + 1e-18))
def onset_at(t, tol=0.035):
    sel = (ft + bias >= t - tol) & (ft + bias <= t + tol)
    return float(env[sel].max()) if sel.any() else 0.0
print(f'{mid}: bar  16ths (onset strength 0-9, "." < 0.15)   | beat RMS dB (all / low / high)')
for b in range(b0, b1 + 1):
    for lab in [str(b)] + [f'{b}+{k}' for k in range(1, 3)]:
        if lab not in {r['sb'] for r in C['bars']}: continue
        row = next(r for r in C['bars'] if r['sb'] == lab)
        t0, L = row['t0'], row['len']
        cells = []
        for k in range(16):
            t = t0 + k * L / 16; o = onset_at(t)
            cells.append('.' if o < 0.15 else str(min(9, int(o * 10))))
        beats = []
        for q in range(4):
            t = t0 + q * L / 4
            beats.append(f'{rms(m, t, L/4):5.1f}/{rms(lo, t, L/4):5.1f}/{rms(hi, t, L/4):5.1f}')
        print(f'{lab:>5} t={t0:7.3f} trk={row.get("trk", "?")}  ' + ' '.join(''.join(cells[i:i+4]) for i in range(0, 16, 4)) + '  | ' + '  '.join(beats))
