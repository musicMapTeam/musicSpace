#!/usr/bin/env python3
"""Distinct text states (set of visible text ids, op>=0.6, not covered) -> one sample frame per state (settled), written to states.json"""
import json
OUT = '/tmp/space-video-doodle/prod/out/music-space-video-v1'
info = json.load(open(OUT + '.info.json')); geom = json.load(open(OUT + '.geom.json'))
fps = geom['fps']; dt = geom['stride'] / fps
types = {e['id']: (e['t'], e.get('dur', 0)) for e in info['events'] if e.get('kind') == 'type' and e.get('id')}
states = []
prev = None
for fr in geom['frames']:
    t = fr['f'] / fps
    ids = frozenset(tx['id'] for tx in fr['texts'] if tx['op'] >= 0.6 and tx['kind'] in ('title', 'note', 'label', 'fine')) if not fr.get('covered') else frozenset(['__covered__'])
    if ids != prev:
        states.append(dict(t0=t, t1=t + dt, ids=sorted(ids), texts=[tx['text'] for tx in fr['texts'] if tx['id'] in ids]))
        prev = ids
    else:
        states[-1]['t1'] = t + dt
keep = []
for s in states:
    d = s['t1'] - s['t0']
    if '__covered__' in s['ids'] or not s['ids']: continue
    if d < 0.2: continue
    # settle: after entrances (0.3 s) and after any typing in this state completes
    ts = s['t0'] + 0.3
    for i in s['ids']:
        if i in types:
            te = types[i][0] + types[i][1] + 0.08
            if s['t0'] - 0.01 <= te <= s['t1']: ts = max(ts, te)
    ts = min(ts, s['t1'] - 0.06)
    s['ts'] = round(ts, 3); s['dur'] = round(d, 3); keep.append(s)
json.dump(keep, open('/tmp/space-video-doodle/prod/review/read/states.json', 'w'), ensure_ascii=False, indent=0)
print(len(states), 'states,', len(keep), 'kept')
for s in keep: print(f"{s['t0']:7.2f}-{s['t1']:7.2f} ({s['dur']:4.2f}) sample {s['ts']:7.2f}  " + ' | '.join(x.replace(chr(10), '/')[:16] for x in s['texts']))
