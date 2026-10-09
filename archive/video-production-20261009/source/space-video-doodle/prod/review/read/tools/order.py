#!/usr/bin/env python3
"""Reading-order inversions: a newer title/note placed above (same column) or left (same row) of an older one still on screen."""
import json, sys
sys.dont_write_bytecode = True
sys.path.insert(0, '/tmp/space-video-doodle/prod/tools')
import tempo
TL = tempo.Timeline(tempo.load_compiled('flipping-in', rebuild=False))
OUT = '/tmp/space-video-doodle/prod/out/music-space-video-v1'
info = json.load(open(OUT + '.info.json')); geom = json.load(open(OUT + '.geom.json'))
fps = geom['fps']; dt = geom['stride'] / fps
first = {}
for fr in geom['frames']:
    for tx in fr['texts']:
        if tx['op'] >= 0.6 and tx['id'] not in first: first[tx['id']] = fr['f'] / fps
inv = {}
for fr in geom['frames']:
    if fr.get('covered'): continue
    t = fr['f'] / fps
    vis = [tx for tx in fr['texts'] if tx['op'] >= 0.6 and tx['kind'] in ('title', 'note')]
    for a in vis:
        for b in vis:
            if a is b or first[a['id']] >= first[b['id']] - 0.05: continue   # a older, b newer
            A, B = a['box'], b['box']
            hov = min(A[2], B[2]) - max(A[0], B[0])
            vov = min(A[3], B[3]) - max(A[1], B[1])
            kind = None
            if B[3] <= A[1] + 20 and hov > 0: kind = 'newer ABOVE older'
            elif B[2] <= A[0] + 20 and vov > 0.3 * min(A[3] - A[1], B[3] - B[1]): kind = 'newer LEFT of older'
            if kind:
                k = (a['id'], b['id'])
                o = inv.setdefault(k, dict(t0=t, n=0, kind=kind, old=a['text'], new=b['text'], A=A, B=B))
                o['n'] += 1; o['t1'] = t + dt
def pos(t):
    sb, beat, k = TL.pos(t); return f'{sb}:{beat:.2f}'
for k, o in sorted(inv.items(), key=lambda kv: kv[1]['t0']):
    d = o['n'] * dt
    if d < 0.3: continue
    m = int(o['t0'] // 60)
    print(f"{m:02d}:{o['t0'] - 60 * m:05.2f} ({pos(o['t0'])}) {d:4.2f}s {o['kind']}: new「{o['new'].replace(chr(10), '/')}」{o['B']} over old「{o['old'].replace(chr(10), '/')}」{o['A']}")
