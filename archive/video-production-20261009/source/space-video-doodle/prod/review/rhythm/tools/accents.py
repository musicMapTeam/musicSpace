import sys, numpy as np, json
sys.path.insert(0, 'tools'); sys.path.insert(0, '/tmp/space-video-doodle/prod/tools')
from grid import *
from audiolib import ONSET_BIAS_MS
o = np.load('data/bed_onset.npz'); env, tt = o['env'], o['t']
def strength(t, w=0.03):
    tc = t + ONSET_BIAS_MS / 1000
    m = (tt >= tc - w) & (tt <= tc + w)
    return env[m].max() if m.any() else 0
info = json.load(open('/tmp/space-video-doodle/prod/out/music-space-video-v1.info.json'))
strong = ('slam', 'slap', 'cut', 'stamp', 'punch', 'confetti', 'enter-slap', 'enter-slide', 'drop', 'spring')
rows = []
for e in info['events']:
    if e['kind'] in strong and e.get('visual', True) is not False:
        s = strength(e['t'])
        rows.append((e['t'], e['pos'], e['kind'], str(e['label'])[:40], s, e.get('size')))
weak = [r for r in rows if r[4] < 0.2]
print(f'{len(rows)} strong visual events; {len(weak)} land where the music has an onset < 0.2 (of 1.0)')
for t, p, k, l, s, sz in weak:
    print(f'  {mmss(t)} {p:>8} {k:10s} {l:40s} music onset {s:.2f}  size {sz}')
