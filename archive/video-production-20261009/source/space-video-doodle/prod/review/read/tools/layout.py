#!/usr/bin/env python3
"""Text-on-text overlaps, simultaneous titles, reading order, title-safe, from the geometry samples."""
import json
OUT = '/tmp/space-video-doodle/prod/out/music-space-video-v1'
info = json.load(open(OUT + '.info.json')); geom = json.load(open(OUT + '.geom.json'))
fps = geom['fps']; dt = geom['stride'] / fps
texts = {t['id']: t for t in info['texts']}
first = {}
for fr in geom['frames']:
    for tx in fr['texts']:
        if tx['op'] >= 0.6 and tx['id'] not in first: first[tx['id']] = fr['f'] / fps
def inter(a, b):
    x0, y0 = max(a[0], b[0]), max(a[1], b[1]); x1, y1 = min(a[2], b[2]), min(a[3], b[3])
    return max(0, x1 - x0) * max(0, y1 - y0)
ov = {}; multi = {}; order = {}; safe = {}
for fr in geom['frames']:
    t = fr['f'] / fps
    if fr.get('covered'): continue
    vis = [tx for tx in fr['texts'] if tx['op'] >= 0.6]
    for i in range(len(vis)):
        for j in range(i + 1, len(vis)):
            a, b = vis[i], vis[j]
            A = inter(a['box'], b['box'])
            if A <= 0: continue
            sa = (a['box'][2] - a['box'][0]) * (a['box'][3] - a['box'][1]); sb = (b['box'][2] - b['box'][0]) * (b['box'][3] - b['box'][1])
            frac = A / max(1, min(sa, sb))
            if frac < 0.04: continue
            k = tuple(sorted([a['id'], b['id']]))
            o = ov.setdefault(k, dict(t0=t, t1=t, n=0, maxfrac=0, ta=a['text'], tb=b['text'], ka=a['kind'], kb=b['kind'], boxa=a['box'], boxb=b['box']))
            o['t1'] = t; o['n'] += 1
            if frac > o['maxfrac']: o['maxfrac'] = frac; o['boxa'] = a['box']; o['boxb'] = b['box']; o['tmax'] = t
    tit = [tx for tx in vis if tx['kind'] in ('title', 'note')]
    if len(tit) >= 3:
        k = tuple(sorted(x['id'] for x in tit))
        m = multi.setdefault(k, dict(t0=t, t1=t, texts=[x['text'] for x in sorted(tit, key=lambda x: first.get(x['id'], 0))]))
        m['t1'] = t
    for tx in vis:
        if tx.get('inFootage'): continue
        x0, y0, x1, y1 = tx['box']
        if x0 < 96 or y0 < 54 or x1 > 1824 or y1 > 1026:
            s = safe.setdefault(tx['id'], dict(text=tx['text'], kind=tx['kind'], n=0, t0=t, worst=tx['box'], cut=False))
            s['n'] += 1; s['t1'] = t
            if x0 < 0 or y0 < 0 or x1 > 1920 or y1 > 1080: s['cut'] = True; s['cutbox'] = tx['box']; s['cutt'] = t
print('== text-on-text overlaps (>=4% of the smaller box), duration')
for k, o in sorted(ov.items(), key=lambda kv: kv[1]['t0']):
    d = o['n'] * dt
    if d < 0.15: continue
    print(f"{o['t0']:7.2f}-{o['t1']:7.2f} {d:5.2f}s frac {o['maxfrac']:.2f} @ {o.get('tmax',0):.2f}  [{o['ka']}]「{o['ta'][:18]}」 {o['boxa']}  x  [{o['kb']}]「{o['tb'][:18]}」 {o['boxb']}")
print('== 3+ titles/notes at once')
for k, m in sorted(multi.items(), key=lambda kv: kv[1]['t0']):
    print(f"{m['t0']:7.2f}-{m['t1'] + dt:7.2f} {m['t1'] + dt - m['t0']:5.2f}s  " + ' | '.join(x.replace(chr(10), '/') for x in m['texts']))
print('== outside 5% title-safe (any time while op>=0.6, not covered)')
for k, s in sorted(safe.items(), key=lambda kv: kv[1]['t0']):
    print(f"{s['t0']:7.2f}-{s['t1']:7.2f} {s['n'] * dt:5.2f}s [{s['kind']}]「{s['text'][:22]}」 {s['worst']}" + (f"  CUT BY FRAME at {s['cutt']:.2f} {s['cutbox']}" if s['cut'] else ''))
