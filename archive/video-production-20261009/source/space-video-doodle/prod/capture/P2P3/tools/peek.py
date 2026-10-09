#!/usr/bin/env python3
"""Review aid: lay out alpha cuts over a checker + their opaque twins, labelled.  usage: peek.py out.png file1.png file2.png ... [--h 300]"""
import sys
from PIL import Image, ImageDraw, ImageFont
args = sys.argv[1:]
H = 300
if '--h' in args:
    i = args.index('--h'); H = int(args[i + 1]); del args[i:i + 2]
out, files = args[0], args[1:]
try:
    font = ImageFont.truetype('/tmp/music-space-font-cache/digits.ttf', 18)
except Exception:
    font = ImageFont.load_default()
tiles = []
for f in files:
    im = Image.open(f).convert('RGBA')
    w = max(1, round(im.width * H / im.height))
    im = im.resize((w, H), Image.LANCZOS)
    chk = Image.new('RGBA', (w, H), (255, 255, 255, 255))
    px = chk.load()
    for y in range(H):
        for x in range(w):
            if ((x // 12) + (y // 12)) % 2: px[x, y] = (205, 215, 230, 255)
    chk.alpha_composite(im)
    tiles.append((f.split('/')[-1], chk))
W = sum(t[1].width for t in tiles) + 12 * (len(tiles) + 1)
sheet = Image.new('RGB', (min(W, 4000), (H + 30) * ((W // 4000) + 1) + 12), (60, 60, 60))
d = ImageDraw.Draw(sheet)
x, y = 12, 6
for name, t in tiles:
    if x + t.width > 4000:
        x, y = 12, y + H + 30
    d.text((x, y), name[:48], fill=(255, 255, 255), font=font)
    sheet.paste(t, (x, y + 24))
    x += t.width + 12
sheet.save(out)
print(out)
