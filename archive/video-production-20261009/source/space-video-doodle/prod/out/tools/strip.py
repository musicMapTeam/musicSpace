#!/usr/bin/env python3
"""Tile stills into one labelled review sheet:  PY strip.py out.png cols W img1.png[=label] img2.png[=label] ..."""
import sys
from PIL import Image, ImageDraw, ImageFont

out, cols, W = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
items = [(a.split('=', 1) + [None])[:2] for a in sys.argv[4:]]
H = W * 9 // 16; LAB = 34; PAD = 8
rows = (len(items) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (W + PAD) + PAD, rows * (H + LAB + PAD) + PAD), (60, 60, 60))
d = ImageDraw.Draw(sheet)
font = ImageFont.truetype('/tmp/music-space-font-cache/digits.ttf', 24)
for i, (p, lab) in enumerate(items):
    im = Image.open(p).convert('RGB').resize((W, H), Image.LANCZOS)
    r, c = divmod(i, cols); x = PAD + c * (W + PAD); y = PAD + r * (H + LAB + PAD)
    sheet.paste(im, (x, y + LAB))
    d.text((x + 4, y + 4), lab or p.split('/')[-1], font=font, fill=(255, 212, 71))
sheet.save(out)
print(out, sheet.size)
