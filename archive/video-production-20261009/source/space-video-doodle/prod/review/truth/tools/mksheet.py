#!/usr/bin/env python3
# usage: mksheet.py <frames_dir> <fps_of_frames> <t0> <t1> <step_s> <cols> <thumb_w> <out.png>
import sys, os, json
from PIL import Image, ImageDraw, ImageFont
fd, ffps, t0, t1, step, cols, tw, out = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4]), float(sys.argv[5]), int(sys.argv[6]), int(sys.argv[7]), sys.argv[8]
C = json.load(open('/tmp/space-video-doodle/prod/tools/tempo-maps/compiled/flipping-in.json'))
bars = C['bars']
def bar_of(t):
    for b in bars:
        if b['t0'] <= t < b['t0'] + b['len']:
            beat = 1 + (t - b['t0']) / (b['len'] / 4)
            return f"{b['sb']}:{beat:.2f}"
    return 'tail'
th = int(tw * 9 / 16)
times = []
t = t0
while t <= t1 + 1e-6:
    times.append(round(t, 3)); t += step
rows = (len(times) + cols - 1) // cols
F = ImageFont.truetype('/tmp/music-space-font-cache/digits.ttf', 20)
W = cols * (tw + 6) + 6; H = rows * (th + 30) + 6
sheet = Image.new('RGB', (W, H), (30, 30, 30)); d = ImageDraw.Draw(sheet)
for i, t in enumerate(times):
    n = int(round(t * ffps)) + 1
    p = os.path.join(fd, f'f{n:04d}.jpg')
    if not os.path.exists(p): continue
    im = Image.open(p).convert('RGB').resize((tw, th), Image.LANCZOS)
    x = 6 + (i % cols) * (tw + 6); y = 6 + (i // cols) * (th + 30)
    sheet.paste(im, (x, y + 24))
    m = int(t // 60); s = t - 60 * m
    d.text((x, y), f'{m:02d}:{s:05.2f}  bar {bar_of(t)}', font=F, fill=(255, 230, 120))
sheet.save(out)
print(out, len(times))
