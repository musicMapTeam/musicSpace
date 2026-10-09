#!/usr/bin/env python3
"""Measure the on-screen boxes of the five figures in the D-02 overview (master px) from the product's own vanish frame:
the first frame of the glide to the wall hides the cast (and the overlays) while the camera has not moved yet (rig camera probe), so
|frame(start-1) - frame(start)| is exactly the cast + overlays.  The overlay boxes are masked out, the rest is split per person by the
label columns.  Writes tools/figures.json and review/D-02-figures.png.
usage: figures.py"""
import json, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

ROOT = '/tmp/space-video-doodle/prod/capture/desktop-rc2'
W, H = 3840, 2160
rec = json.load(open(f'{ROOT}/master/D-02-room-hero.rec.json'))
m0 = next(m for m in rec['marks'] if m['label'] == 'overview')
start = next(m for m in rec['marks'] if m['label'] == 'glide-photos-start')['frame']
pr = rec['probe']
assert pr[start - 1][2:5] == pr[start][2:5], 'camera moved on the vanish frame'


def fr(n):
    raw = subprocess.run(['/opt/homebrew/bin/ffmpeg', '-v', 'error', '-i', f'{ROOT}/master/D-02-room-hero.mp4', '-vf', f'select=eq(n\\,{n})', '-fps_mode', 'passthrough', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(H, W, 3)


a, b = fr(start - 1), fr(start)
d = np.abs(a.astype(np.int16) - b.astype(np.int16)).max(axis=2) > 40
people = m0['people']
mask = d.copy()
# overlays to ignore: labels (+ margin), every DOM box of the mark, and everything outside the 3D frame
for p in people:
    x, y, w, h = p['label']; mask[max(0, y - 12): y + h + 12, max(0, x - 12): x + w + 12] = False
for k, bx in (m0.get('boxes') or {}).items():
    if bx and k not in ('world',):
        x, y, w, h = bx; mask[max(0, y - 30): y + h + 30, max(0, x - 30): x + w + 30] = False
wx, wy, ww, wh = m0['boxes']['world']
out = np.zeros_like(mask); out[wy: wy + wh, wx: wx + ww] = True; mask &= out
# the label stems are 1-2 px vertical lines: open horizontally to drop them.  rc2: the product's line boil steps on the vanish frame
# itself (frame 480), so the difference also holds thin boiling plank/wall strokes; a square opening drops strokes thinner than 11 master
# px (the figures' bodies and legs are 30+ px wide) before the per-person split
mask = ndimage.binary_opening(mask, structure=np.ones((1, 15)))
mask = ndimage.binary_opening(mask, structure=np.ones((11, 11)))
mask = ndimage.binary_closing(mask, structure=np.ones((15, 15)))
cx_label = np.array([p['label'][0] + p['label'][2] / 2 for p in people])
ys_all, xs_all = np.where(mask)
near = np.argmin(np.abs(xs_all[:, None] - cx_label[None, :]), axis=1)
pix = {}
for j, p in enumerate(people):
    lb = p['label'][1] + p['label'][3]
    # raised labels (stem > 0) hang a stem down to the same anchor row as the others: start below the lowest label row + 20 px
    lb = max(lb, max(q['label'][1] + q['label'][3] for q in people)) + 20
    sel = (near == j) & (np.abs(xs_all - cx_label[j]) <= 130) & (ys_all >= lb) & (ys_all <= lb + 700)
    pix[p['name']] = [(xs_all[sel], ys_all[sel])] if sel.sum() > 3000 else []
res = []
for p in people:
    if not pix[p['name']]: res.append(dict(name=p['name'], figure=None)); continue
    xs = np.concatenate([q[0] for q in pix[p['name']]]); ys = np.concatenate([q[1] for q in pix[p['name']]])
    # the figure starts at the first row block that is wider than a label stem (the stems survive the opening only where they are thick)
    cnt = np.bincount(ys - ys.min(), minlength=1)
    run = np.convolve((cnt > 45).astype(int), np.ones(12, int), 'valid')
    top = ys.min() + int(np.argmax(run >= 12)) if (run >= 12).any() else ys.min()
    keep = ys >= top; xs, ys = xs[keep], ys[keep]
    x0, x1 = np.percentile(xs, 0.5), np.percentile(xs, 99.5); y0, y1 = np.percentile(ys, 0.2), np.percentile(ys, 99.8)
    res.append(dict(name=p['name'], figure=[int(x0), int(y0), int(x1 - x0), int(y1 - y0)], label=p['label']))
json.dump(dict(source=f'D-02-room-hero frames {start - 1}/{start} (vanish frame, camera unchanged)', units='master px [x, y, w, h]', people=res), open(f'{ROOT}/tools/figures.json', 'w'), indent=1, ensure_ascii=False)
im = Image.fromarray(a).resize((1920, 1080), Image.LANCZOS); dr = ImageDraw.Draw(im)
font = ImageFont.truetype('/tmp/music-space-font-cache/marker.ttf', 20)
for r in res:
    if r['figure']:
        x, y, w, h = [v / 2 for v in r['figure']]; dr.rectangle([x, y, x + w, y + h], outline=(255, 92, 138), width=3); dr.text((x, y + h + 4), r['name'].split(' ')[0], font=font, fill=(255, 92, 138))
im.save(f'{ROOT}/review/D-02-figures.png')
print(json.dumps(res, ensure_ascii=False))
