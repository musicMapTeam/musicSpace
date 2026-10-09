#!/usr/bin/env python3
"""crop.py out.png W  frame:x0,y0,x1,y1 ...  -> crops scaled to width W, stacked vertically with labels (frame number + time)"""
import sys
from PIL import Image, ImageDraw, ImageFont
R = '/tmp/space-video-doodle/prod/review/read/frames'
out, W = sys.argv[1], int(sys.argv[2])
F = ImageFont.truetype('/tmp/music-space-font-cache/marker.ttf', 20)
tiles = []
for spec in sys.argv[3:]:
    fr, box = spec.split(':'); x0, y0, x1, y1 = map(int, box.split(','))
    p = f'{R}/zoom/z_{int(fr):06d}.png'
    try: im = Image.open(p)
    except FileNotFoundError: im = Image.open(f'{R}/st_{int(fr):06d}.png')
    c = im.convert('RGB').crop((x0, y0, x1, y1)); h = round(c.height * W / c.width)
    c = c.resize((W, h), Image.LANCZOS)
    t = int(fr) / 60; m = int(t // 60)
    tiles.append((c, f'f{fr}  {m:02d}:{t - 60 * m:05.2f}  box {x0},{y0},{x1},{y1}'))
H = sum(c.height + 26 for c, _ in tiles)
sheet = Image.new('RGB', (W, H), (40, 40, 40)); d = ImageDraw.Draw(sheet); y = 0
for c, lab in tiles:
    d.text((4, y + 2), lab, fill=(255, 220, 90), font=F); sheet.paste(c, (0, y + 26)); y += c.height + 26
sheet.save(out)
