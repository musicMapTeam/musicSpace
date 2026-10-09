import sys, numpy as np, json
sys.path.insert(0, 'tools')
from grid import *
m = np.load('data/vmetrics.npz'); d, big, cells = m['d'], m['big'], m['cells']
N = len(d)
def gaps(mask, minlen):
    out = []; last = 0
    idx = np.where(mask)[0]
    prev = 0
    for i in list(idx) + [N]:
        if (i - prev) / 60 >= minlen:
            out.append((prev, i))
        prev = i
    return out
for thr, nc, label in ((12, 3, 'strong (>=3 cells >12)'), (8, 1, 'any (>=1 cell >8)'), (5, 1, 'weak (>=1 cell >5)')):
    mask = (cells > thr).sum(axis=(1, 2)) >= nc
    G = gaps(mask, 1.2)
    print(f'== {label}: {mask.sum()} active frames; gaps >= 1.2 s: {len(G)}')
    for a, b in sorted(G, key=lambda x: -(x[1] - x[0]))[:25]:
        print(f'   {mmss(a/60)} -> {mmss(b/60)}  {(b-a)/60:4.2f} s   sb {fmt_pos(a/60)} -> {fmt_pos(b/60)}   mean d {d[a+1:b].mean():.2f}')
