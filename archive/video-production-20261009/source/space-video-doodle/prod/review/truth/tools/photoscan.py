import json, os, numpy as np
from PIL import Image
info = json.load(open('/tmp/space-video-doodle/prod/out/music-space-video-v1.info.json'))
wins = [(x['t0'], x['t1']) for x in info['texts'] if '照片为 AI 生成的示例图' in x['text'] or '照片由 AI 生成' in x['text']]
def labelled(t): return any(a <= t < b for a, b in wins)
rows = []
for n in range(1, 700):
    p = f'f4/f{n:04d}.jpg'
    if not os.path.exists(p): break
    t = (n - 1) / 4
    a = np.asarray(Image.open(p).convert('RGB')).astype(np.int16)
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    orange = (R > 150) & (G > 40) & (G < 150) & (B < 80) & (R - G > 60)
    darkblue = (B > R + 15) & (B < 110) & (R < 60) & (G < 90)
    score = int(orange.sum()) + int(darkblue.sum())
    rows.append((t, score, labelled(t)))
json.dump(rows, open('photoscan.json', 'w'))
for t, s, l in rows:
    if s > 400 and not l:
        print(f'{int(t//60):02d}:{t%60:05.2f}  score {s:6d}  labelled={l}')
print('max score labelled', max(s for t,s,l in rows if l), 'median labelled', sorted(s for t,s,l in rows if l)[len([1 for r in rows if r[2]])//2])
print('unlabelled scores >100:', sum(1 for t,s,l in rows if s>100 and not l))
