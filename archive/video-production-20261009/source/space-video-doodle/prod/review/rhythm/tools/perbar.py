import sys, numpy as np, json
sys.path.insert(0, 'tools')
from grid import *
m = np.load('data/vmetrics.npz'); d, big, hd, cells = m['d'], m['big'], m['hd'], m['cells']
A = json.load(open('data/bars_audio.json'))
info = json.load(open('/tmp/space-video-doodle/prod/out/music-space-video-v1.info.json'))
vis = [e for e in info['events'] if e.get('visual', True) is not False and e['kind'] not in ('sfx', 'mark', 'out')]
cuts = [e for e in info['events'] if e['kind'] in ('cut', 'wipe') or e['kind'].startswith('enter-')]
shots = info['shots']
rows = []
for r in A:
    t0 = r['t0']; sb = r['sb']
    ln = [b for b in BARS if int(b[0]) == sb][0][2]
    f0, f1 = int(np.ceil(t0 * 60)), int(np.ceil((t0 + ln) * 60))
    mot = d[f0:f1].mean(); 
    # "hits": frames where >= 3 cells change by > 12 levels (a new element appears / something moves fast)
    hitframes = ((cells[f0:f1] > 12).sum(axis=(1, 2)) >= 3)
    nhit = int(hitframes.sum())
    nev = sum(1 for e in vis if t0 - 1e-6 <= e['t'] < t0 + ln - 1e-6)
    ncut = sum(1 for e in info['events'] if e['kind'] == 'cut' and t0 - 1e-6 <= e['t'] < t0 + ln - 1e-6)
    rows.append((sb, r['trk'], t0, r['all'], r['low'], r['mid'], mot, nhit, nev, ncut))
    print(f"sb {sb:2d} FI {r['trk']:3d} {mmss(t0)} music {r['all']:6.1f} low {r['low']:6.1f} mid {r['mid']:6.1f} | motion {mot:5.2f} fastframes {nhit:3d} events {nev:2d} cuts {ncut}")
json.dump(rows, open('data/perbar.json', 'w'))
