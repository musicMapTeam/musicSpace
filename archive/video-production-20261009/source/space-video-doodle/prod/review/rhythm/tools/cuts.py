import numpy as np, sys, json
sys.path.insert(0, 'tools')
from grid import *
m = np.load('data/vmetrics.npz')
d, big, hd = m['d'], m['big'], m['hd']
N = len(d)
info = json.load(open('/tmp/space-video-doodle/prod/out/music-space-video-v1.info.json'))
ev = info['events']
evt = [(e['t'], e['kind'], e['label'], e['pos'], e.get('act', '')) for e in ev]
def near_events(t, w=0.06):
    return [f"{k}:{str(l)[:28]}@{p}" for (tt, k, l, p, a) in evt if abs(tt - t) <= w]
# candidate cuts: big > thr and local max within +-3 frames
thr = float(sys.argv[1]) if len(sys.argv) > 1 else 0.2
rows = []
for i in range(1, N - 1):
    if big[i] >= thr and big[i] == big[max(0, i - 3):i + 4].max():
        t = i / FPS
        rows.append((i, t, big[i], hd[i], d[i]))
print(f'{len(rows)} candidates with big>={thr}')
for i, t, b, h, dd in rows:
    o4 = off(t, 4); o8 = off(t, 8); o16 = off(t, 16)
    # the frame shows time t; an event at te shows on frame ceil(te*60): so compare to grid with tolerance 1 frame
    lv = level(t, tol=1.01 / 60)
    print(f'f{i:5d} {mmss(t)} sb {fmt_pos(t):>8} big {b:.2f} hd {h:.2f} d {dd:5.1f}  beatoff {o4*1000:+6.0f}ms 8th {o8*1000:+5.0f} lvl {lv:5s} | {"; ".join(near_events(t, 0.04))[:150]}')
