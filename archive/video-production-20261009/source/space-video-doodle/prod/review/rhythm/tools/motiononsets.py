import sys, numpy as np, json
sys.path.insert(0, 'tools')
from grid import *
m = np.load('data/vmetrics.npz'); d, cells = m['d'], m['cells']
N = len(d); f = np.arange(N)
# boil-free motion: replace boil frames (f%5==0) by the mean of neighbours
dm = d.copy()
for i in range(1, N - 1):
    if i % 5 == 0: dm[i] = 0.5 * (d[i - 1] + d[i + 1])
act = (cells > 12).sum(axis=(1, 2)).astype(float)
for i in range(1, N - 1):
    if i % 5 == 0: act[i] = 0.5 * (act[i - 1] + act[i + 1])
info = json.load(open('/tmp/space-video-doodle/prod/out/music-space-video-v1.info.json'))
shots = info['shots']
def shots_at(t):
    return ','.join(s['id'] for s in shots if s['t0'] <= t < s['t1'] and not s['id'].startswith('FILM'))[:60]
ons = []
i = 3
while i < N - 3:
    # onset: previous 3 frames quiet (< 1.5) and now >= 5 with >= 8 active cells
    if dm[i] >= 5 and act[i] >= 8 and dm[i - 3:i].max() < 1.5:
        ons.append(i); i += 6; continue
    i += 1
print(len(ons), 'motion onsets (quiet -> big within a frame)')
bad = []
for i in ons:
    t = i / 60  # frame i shows time i/60; an event at te appears at frame ceil(te*60-0.5)
    o8 = off(t, 8); o16 = off(t, 16)
    # allow 1 frame quantisation: the event time could be up to 1 frame earlier than the frame time
    if not (-0.004 <= o8 <= 1.0 / 60 + 0.004):
        bad.append((i, t, o8, o16))
print(len(bad), 'onsets not within [0, +1 frame] of an 8th-note grid line')
for i, t, o8, o16 in bad:
    print(f'  f{i:5d} {mmss(t)} sb {fmt_pos(t):>8} off8 {o8*1000:+5.0f} ms off16 {o16*1000:+5.0f} ms  peak d {dm[i:i+6].max():5.1f} cells {act[i:i+6].max():4.0f}  {shots_at(t)}')
