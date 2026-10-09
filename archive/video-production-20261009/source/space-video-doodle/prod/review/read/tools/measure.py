#!/usr/bin/env python3
"""Readability measurements of film v1 from the render's geometry samples (every 50 ms) + the event log.
Writes review/read/measure.json and prints a table."""
import json, re, sys
sys.path.insert(0, '/tmp/space-video-doodle/prod/tools')
OUT = '/tmp/space-video-doodle/prod/out/music-space-video-v1'
info = json.load(open(OUT + '.info.json'))
geom = json.load(open(OUT + '.geom.json'))
fps, stride = geom['fps'], geom['stride']; dt = stride / fps
beat = info['map']['beat_s']; bar = info['map']['bar_s']

def units(text):
    t = re.sub(r'[\s，。、！？…·：；,.!?「」『』（）()《》“”"\'\-—~～↗⇄]', ' ', text)
    n = 0
    for tok in t.split():
        cjk = re.findall(r'[㐀-鿿豈-﫿]', tok); n += len(cjk)
        rest = re.sub(r'[㐀-鿿豈-﫿]', ' ', tok).split(); n += len(rest)
    return n

texts = {t['id']: t for t in info['texts']}
# typing events: id -> (t, dur, nchars)
types = {}
for e in info['events']:
    if e.get('kind') == 'type' and e.get('id'):
        types[e['id']] = (e['t'], e.get('dur', 0), e.get('note'))
samples = {}
maxw = {}
ws = {}
for fr in geom['frames']:
    for tx in fr['texts']:
        if tx['op'] >= 0.9: ws.setdefault(tx['id'], []).append(tx['box'][2] - tx['box'][0])
for k, v in ws.items():
    v.sort(); maxw[k] = v[len(v) // 2]   # median 'rest' width
for fr in geom['frames']:
    t = fr['f'] / fps; cov = fr.get('covered')
    for tx in fr['texts']:
        b = tx['box']; w = b[2] - b[0]
        mw = maxw.get(tx['id'], w) or 1; samples.setdefault(tx['id'], []).append((t, tx['op'], b, cov, 0.85 * mw <= w <= 1.2 * mw))

def runs(ts):
    """continuous windows from sorted sample times"""
    out = []
    for t in ts:
        if out and t - out[-1][1] <= dt * 1.51: out[-1][1] = t
        else: out.append([t, t])
    return [(a, b + dt) for a, b in out]

rows = []
for tid, ss in samples.items():
    tx = texts.get(tid, {})
    text = ss and tx.get('text') or ''
    good = [t for t, op, b, cov, full in ss if op >= 0.9 and full and not cov and b[0] >= 0 and b[2] <= 1920 and b[1] >= 0 and b[3] <= 1080]
    wins = runs(sorted(good))
    best = max(wins, key=lambda w: w[1] - w[0]) if wins else (0, 0)
    first = min(t for t, *_ in ss); last = max(t for t, *_ in ss) + dt
    # full-typed time
    ty = types.get(tid)
    full_from = None
    if ty:
        full_from = ty[0] + ty[1]  # last char starts at t + (n-1)*step; + ~3 frames to settle == approx t+dur
    hs = [b[3] - b[1] for t, op, b, cov, full in ss if op >= 0.9]
    h = sorted(hs)[len(hs) // 2] if hs else 0
    boxes = [b for t, op, b, cov, full in ss if op >= 0.9]
    rows.append(dict(id=tid, text=tx.get('text', ''), kind=tx.get('kind'), role=tx.get('role'), size=tx.get('size'), script=tx.get('script'),
                     units=units(tx.get('text', '')), first=round(first, 3), last=round(last, 3), best0=round(best[0], 3), best1=round(best[1], 3),
                     best=round(best[1] - best[0], 3), typed=round(best[1] - max(best[0], full_from), 3) if full_from else None,
                     type_t=ty[0] if ty else None, type_dur=ty[1] if ty else None, box_h=h,
                     box=boxes[len(boxes) // 2] if boxes else None))
rows.sort(key=lambda r: r['first'])
json.dump(rows, open('/tmp/space-video-doodle/prod/review/read/measure.json', 'w'), ensure_ascii=False, indent=1)

def pos(t):
    # storyboard bar from the act table: reconstruct with tempo map events: use nearest event pos
    best = None
    for e in info['events']:
        if e.get('pos') and abs(e['t'] - t) < (abs(best[0] - t) if best else 1e9): best = (e['t'], e['pos'])
    return best[1] if best else '?'

for r in rows:
    need = max(0.8, 0.25 * r['units'])
    flag = ''
    if r['best'] + 1e-3 < need: flag += ' SHORT'
    if r['typed'] is not None and r['typed'] < 0.6: flag += ' TYPED<0.6'
    print('%-26s %-5s %-7s %4s %6.2f-%6.2f best %5.2f need %4.2f typed %5s h%4d %s %s%s' % (r['id'][:26], (r['kind'] or '')[:5], (r['role'] or '')[:7], r['size'], r['first'], r['last'], r['best'], need,
          '%.2f' % r['typed'] if r['typed'] is not None else '  -  ', r['box_h'], r['script'] or '', r['text'].replace('\n', '/')[:34], flag))
