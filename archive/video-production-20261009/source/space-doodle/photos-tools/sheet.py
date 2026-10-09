"""Contact sheet of one folder of shots: python3 sheet.py <glob> <title> <tile width> <cols> <out>"""
import sys, pathlib, re
sys.path.insert(0, '/tmp/space-doodle')
from PIL import Image, ImageDraw, ImageFont
FONT = '/tmp/music-space-font-cache/marker.ttf'
f_title = ImageFont.truetype(FONT, 36); f_lab = ImageFont.truetype(FONT, 18)
PAPER = (247, 239, 223); INK = (28, 27, 26)
pattern, title, w, cols, out = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
paths = sorted(pathlib.Path('/').glob(pattern.lstrip('/')))
tiles = []
for p in paths:
    im = Image.open(p).convert('RGB'); h = round(im.height * w / im.width); tiles.append((p.stem, im.resize((w, h), Image.LANCZOS)))
rows = [tiles[i:i + cols] for i in range(0, len(tiles), cols)]
pad, lab_h = 20, 28
H = 80 + sum(max(t.height for _, t in r) + lab_h + pad for r in rows); W = pad + cols * (w + pad)
c = Image.new('RGB', (W, H), PAPER); d = ImageDraw.Draw(c); d.text((pad, 20), title, font=f_title, fill=INK)
y = 80
for r in rows:
    x = pad
    for lab, t in r:
        d.text((x, y), lab[:48], font=f_lab, fill=INK); c.paste(t, (x, y + lab_h)); x += w + pad
    y += max(t.height for _, t in r) + lab_h + pad
c.save(out); print(out, c.size)
