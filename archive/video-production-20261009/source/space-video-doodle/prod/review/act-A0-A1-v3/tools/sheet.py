#!/usr/bin/env python3
"""Tile PNG stills of a folder (sorted by name) into one sheet: PY -I sheet.py <dir> <out.png> [cols] [width]"""
import os, sys
from PIL import Image, ImageDraw, ImageFont
d, out = sys.argv[1], sys.argv[2]; cols = int(sys.argv[3]) if len(sys.argv) > 3 else 4; W = int(sys.argv[4]) if len(sys.argv) > 4 else 640
files = sorted(f for f in os.listdir(d) if f.endswith('.png'))
H = W * 9 // 16; PAD, LAB = 12, 34; rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (W + PAD) + PAD, rows * (H + LAB + PAD) + PAD), (240, 232, 214)); dr = ImageDraw.Draw(sheet)
F = ImageFont.truetype('/tmp/music-space-font-cache/digits.ttf', 24)
for i, f in enumerate(files):
    r, c = divmod(i, cols); x = PAD + c * (W + PAD); y = PAD + r * (H + LAB + PAD)
    im = Image.open(os.path.join(d, f)).convert('RGB').resize((W, H), Image.LANCZOS); sheet.paste(im, (x, y + LAB))
    dr.rectangle([x - 1, y + LAB - 1, x + W, y + LAB + H], outline=(28, 27, 26), width=2); dr.text((x + 2, y + 4), f[:-4], font=F, fill=(28, 27, 26))
sheet.save(out); print(out, sheet.size)
