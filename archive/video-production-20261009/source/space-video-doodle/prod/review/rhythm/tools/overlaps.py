import sys, json
sys.path.insert(0, 'tools')
from grid import *
g = json.load(open('/tmp/space-video-doodle/prod/out/music-space-video-v1.geom.json'))
def inter(a, b):
    x0, y0 = max(a[0], b[0]), max(a[1], b[1]); x1, y1 = min(a[2], b[2]), min(a[3], b[3])
    if x1 <= x0 or y1 <= y0: return 0
    return (x1 - x0) * (y1 - y0)
def area(a): return max(0, a[2] - a[0]) * max(0, a[3] - a[1])
hits = {}
for fr in g['frames']:
    T_ = [t for t in fr['texts'] if t['kind'] in ('title', 'note', 'label', 'sticker') and t.get('op', 1) > 0.15 and not t.get('inFootage')]
    for i in range(len(T_)):
        for j in range(i + 1, len(T_)):
            a, b = T_[i], T_[j]
            ia = inter(a['box'], b['box'])
            if ia > 0.15 * min(area(a['box']), area(b['box'])) and min(area(a['box']), area(b['box'])) > 2000:
                key = (a['id'], b['id'])
                hits.setdefault(key, []).append((fr['f'], a['text'][:14], b['text'][:14], round(ia / min(area(a['box']), area(b['box'])), 2), a['kind'], b['kind']))
for key, v in sorted(hits.items(), key=lambda kv: kv[1][0][0]):
    f0, f1 = v[0][0], v[-1][0]
    print(f'{mmss(f0/60)}-{mmss(f1/60)} sb {fmt_pos(f0/60):>8}-{fmt_pos(f1/60):>8} frames {len(v):3d} (x3) 「{v[0][1]}」({v[0][4]}) x 「{v[0][2]}」({v[0][5]}) max overlap {max(x[3] for x in v)}')
