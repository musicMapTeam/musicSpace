import sys, numpy as np, json
sys.path.insert(0, 'tools')
from grid import *
SR = 48000
def env_db(x, win=0.05, hop=0.005):
    m = x.mean(axis=1) if x.ndim == 2 else x
    n = int(win * SR); h = int(hop * SR)
    sq = np.convolve(m.astype(np.float64) ** 2, np.ones(n) / n, mode='same')
    e = sq[::h]
    return 10 * np.log10(e + 1e-12), h / SR
res = {}
for name in ('bed', 'mix'):
    x = np.load(f'data/{name}.npy')
    e, dt = env_db(x)
    rows = []
    for sb, t0, ln, trk in BARS:
        i = int(t0 / dt)
        pre = e[max(0, i - int(0.6 / dt)):i - int(0.05 / dt)]
        post = e[i:i + int(0.25 / dt)]
        prebar = e[max(0, i - int(ln / dt)):i]
        postbar = e[i:i + int(ln / dt)]
        rows.append((int(sb), trk, t0, post.max() - pre.mean() if len(pre) else 0, postbar.mean() - prebar.mean() if len(prebar) else 0, post.max()))
    res[name] = rows
    print(f'== {name}: biggest downbeat hits (peak of 0-250 ms after minus mean 50-600 ms before), and bar-level step')
    for r in sorted(rows, key=lambda r: -r[3])[:12]:
        print(f'   sb {r[0]:2d}:1 FI {r[1]:3d} {mmss(r[2])}  hit {r[3]:+5.1f} dB   bar step {r[4]:+5.1f} dB   peak {r[5]:.1f}')
    for sbq in (5, 9, 21, 41, 51, 53, 55, 73, 75, 77, 79, 83, 85):
        r = [r for r in rows if r[0] == sbq][0]
        rank = sorted(rows, key=lambda r: -r[3]).index(r) + 1
        print(f'   key sb {sbq}:1  hit {r[3]:+5.1f} dB (rank {rank}/{len(rows)})  bar step {r[4]:+5.1f} dB')
