import sys, numpy as np, json
sys.path.insert(0, 'tools')
from grid import *
m = np.load('data/vmetrics.npz'); d, big, cells = m['d'], m['big'], m['cells']
N = len(d)
f = np.arange(N)
boil = (f % 5 == 0)
# check the boil phase statistically
for ph in range(5):
    print('phase', ph, 'mean d', d[f % 5 == ph].mean().round(3))
act = (cells > 8).sum(axis=(1, 2))
info = json.load(open('/tmp/space-video-doodle/prod/out/music-space-video-v1.info.json'))
shots = info['shots']
def shots_at(t):
    return ','.join(s['id'] for s in shots if s['t0'] <= t < s['t1'] and not s['id'].startswith('FILM'))[:80]
for K, thr in ((2, 8), (3, 5), (1, 4)):
    mask = (~boil) & ((cells > thr).sum(axis=(1, 2)) >= K)
    idx = np.where(mask)[0]
    prev = 0; G = []
    for i in list(idx) + [N]:
        if (i - prev) / 60 >= 1.0: G.append((prev, i))
        prev = i
    print(f'== no non-boil frame with >= {K} cells > {thr} for >= 1.0 s: {len(G)} windows')
    for a, b in sorted(G, key=lambda x: -(x[1] - x[0]))[:30]:
        nb = (~boil[a+1:b])
        print(f'   {mmss(a/60)} -> {mmss(b/60)}  {(b-a)/60:4.2f} s  sb {fmt_pos(a/60):>8} -> {fmt_pos(b/60):>8}  non-boil mean d {d[a+1:b][nb].mean():.2f}  {shots_at((a+b)/120)}')
