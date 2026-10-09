import sys, numpy as np, json
sys.path.insert(0, 'tools')
from grid import *
m = np.load('data/vmetrics.npz'); d, big, cells = m['d'], m['big'], m['cells']
N = len(d); f = np.arange(N)
info = json.load(open('/tmp/space-video-doodle/prod/out/music-space-video-v1.info.json'))
evt = np.array(sorted(e['t'] for e in info['events'] if e['kind'] not in ('sfx',)))
shots = info['shots']
def shots_at(t):
    return ','.join(s['id'] for s in shots if s['t0'] <= t < s['t1'] and not s['id'].startswith('FILM'))[:70]
abrupt = (cells > 25).sum(axis=(1, 2))
cand = []
for i in range(2, N - 2):
    if abrupt[i] >= 3 and abrupt[i] == abrupt[i - 2:i + 3].max():
        t = i / 60
        # nearest logged event (an event at te shows from frame ceil(te*60 - 0.5))
        j = np.searchsorted(evt, t); near = min(abs(evt[k] - t) for k in (j - 1, j) if 0 <= k < len(evt))
        if near > 0.12:
            cand.append((i, t, abrupt[i], near))
print(len(cand), 'abrupt local changes (>=3 cells jump >25 levels) with no logged event within 120 ms')
for i, t, a, near in cand:
    print(f'  f{i:5d} {mmss(t)} sb {fmt_pos(t):>8} lvl {level(t, 1.01/60):5s} cells {a:3d}  nearest event {near*1000:5.0f} ms  boilframe {i%5==0}  {shots_at(t)}')
