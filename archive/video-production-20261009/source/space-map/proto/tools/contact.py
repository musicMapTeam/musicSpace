"""Contact sheet: python contact.py <out.png> <title> <cols> <width> <label>=<path> ..."""
import sys
from PIL import Image, ImageDraw, ImageFont
FONT = '/tmp/music-space-font-cache/marker.ttf'
out, title, cols, w = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
items = [a.rsplit('=', 1) for a in sys.argv[5:]]
f_title = ImageFont.truetype(FONT, 34); f_lab = ImageFont.truetype(FONT, 20)
PAPER = (247, 239, 223); INK = (28, 27, 26)
tiles = []
for lab, p in items:
    im = Image.open(p).convert('RGB'); h = round(im.height * w / im.width); tiles.append((lab, im.resize((w, h), Image.LANCZOS)))
rows = [tiles[i:i + cols] for i in range(0, len(tiles), cols)]
pad, lab_h = 20, 30
H = 70 + sum(max(t.height for _, t in r) + lab_h + pad for r in rows)
W = pad + cols * (w + pad)
canvas = Image.new('RGB', (W, H), PAPER); d = ImageDraw.Draw(canvas)
d.text((pad, 18), title, font=f_title, fill=INK)
y = 70
for r in rows:
    x = pad
    for lab, t in r:
        d.text((x, y), lab[:90], font=f_lab, fill=INK)
        canvas.paste(t, (x, y + lab_h)); d.rectangle([x - 1, y + lab_h - 1, x + t.width, y + lab_h + t.height], outline=INK, width=2)
        x += w + pad
    y += max(t.height for _, t in r) + lab_h + pad
canvas.save(out); print(out, canvas.size)
