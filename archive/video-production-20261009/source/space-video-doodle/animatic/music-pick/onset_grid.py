# Per-16th onset strength per stem (and mix) for chosen bars: where are the hits?
import json, sys, numpy as np
sys.path.insert(0,'/tmp/space-video-doodle/animatic/music-pick')
from rhythm_compare import load, flux
mix, bj, stemdir = sys.argv[1], sys.argv[2], sys.argv[3]
bars_req = [int(b) for b in sys.argv[4].split(',')]
B = json.load(open(bj)); bars = B['bar_starts_s']; bs = B['bar_s']
srcs = {'mix': (mix, 0.0)}
for s in ['drums','bass','other']: srcs[s] = (f'{stemdir}/{s}.mp3', 0.050)
env = {}
for k,(p,lag) in srcs.items():
    t, d = flux(load(p)); env[k] = (t - lag, d / (np.percentile(d, 99) + 1e-9))
chars = ' .:-=+*#%@'
for b in bars_req:
    t0 = bars[b-1]
    print(f'bar {b} @ {t0:.3f}s   (1 e + a 2 e + a 3 e + a 4 e + a)')
    for k,(t,d) in env.items():
        row = ''
        for i in range(16):
            c = t0 + i*bs/16; m = (t >= c-0.02) & (t < c+0.02)
            v = d[m].max() if m.any() else 0
            row += chars[min(9, int(v*9))] + ' '
        print(f'   {k:6s} {row}')
