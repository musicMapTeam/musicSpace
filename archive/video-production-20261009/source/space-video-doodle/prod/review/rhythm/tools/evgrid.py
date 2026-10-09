import sys, numpy as np, json, collections
sys.path.insert(0, 'tools')
from grid import *
info = json.load(open('/tmp/space-video-doodle/prod/out/music-space-video-v1.info.json'))
ev = info['events']
vis = [e for e in ev if e.get('visual', True) is not False and e['kind'] not in ('sfx', 'mark')]
cnt = collections.Counter()
odd = []
for e in vis:
    t = e['t']; lv = level(t, tol=0.004)
    b, beat, trk = pos(t)
    cnt[(e['kind'], lv)] += 1
    e['_lv'] = lv; e['_beat'] = beat
by = collections.defaultdict(collections.Counter)
for (k, lv), n in cnt.items(): by[k][lv] += n
for k, c in sorted(by.items(), key=lambda x: -sum(x[1].values())):
    print(f'{k:12s}', dict(c))
print()
print('== events NOT on the 8th grid (16th or off):')
for e in vis:
    if e['_lv'] in ('16th', 'off'):
        print(f"  {mmss(e['t'])} {e['pos']:>9} {e['kind']:10s} {str(e['label'])[:50]:50s} {e.get('act','')}")
print()
print('== cuts/wipes/enter not on a beat:')
for e in vis:
    if (e['kind'] in ('cut', 'wipe') or e['kind'].startswith('enter')) and e['_lv'] not in ('bar', 'half', 'beat'):
        print(f"  {mmss(e['t'])} {e['pos']:>9} {e['kind']:10s} {str(e['label'])[:50]} lvl {e['_lv']}")
print()
print('== cuts (kind=cut) on beats 2/4 (not 1/3):')
for e in vis:
    if e['kind'] == 'cut' and e['_lv'] == 'beat':
        print(f"  {mmss(e['t'])} {e['pos']:>9} {str(e['label'])[:60]}")
print()
print('== slams (titles) not on beat 1 or 3:')
for e in vis:
    if e['kind'] == 'slam' and e['_lv'] not in ('bar', 'half'):
        print(f"  {mmss(e['t'])} {e['pos']:>9} {str(e['label'])[:40]:40s} lvl {e['_lv']} size {e.get('size')}")
