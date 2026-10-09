import sys, numpy as np, json
sys.path.insert(0, 'tools')
from grid import *
m = np.load('data/vmetrics.npz'); d, big, cells = m['d'], m['big'], m['cells']
N = len(d)
act = (cells > 8).sum(axis=(1, 2))   # active cells per frame (of 144)
# windows of >= 1.5 s where active cells never exceed K
for K in (2, 4, 8):
    mask = act > K
    idx = np.where(mask)[0]
    prev = 0; G = []
    for i in list(idx) + [N]:
        if (i - prev) / 60 >= 1.5: G.append((prev, i))
        prev = i
    print(f'== windows >= 1.5 s with at most {K} active cells per frame: {len(G)}')
    for a, b in sorted(G, key=lambda x: -(x[1] - x[0]))[:20]:
        print(f'   {mmss(a/60)} -> {mmss(b/60)}  {(b-a)/60:4.2f} s   sb {fmt_pos(a/60)} -> {fmt_pos(b/60)}   mean d {d[a+1:b].mean():.2f}  max act {act[a+1:b].max()}')
