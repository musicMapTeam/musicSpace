"""Tile rendered stills with labels: sheet.py out.png cols width label1=file1 label2=file2 ..."""
import sys
from PIL import Image, ImageDraw, ImageFont

out, cols, W = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
items = [a.split('=', 1) for a in sys.argv[4:]]
font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', max(14, W // 30))
tiles = []
for lab, f in items:
    im = Image.open(f).convert('RGB')
    im = im.resize((W, int(W * im.size[1] / im.size[0])), Image.LANCZOS)
    d = ImageDraw.Draw(im)
    tw = d.textlength(lab, font=font)
    d.rectangle([0, 0, tw + 12, font.size + 10], fill=(255, 212, 71))
    d.text((6, 4), lab, fill=(28, 27, 26), font=font)
    tiles.append(im)
h = tiles[0].size[1]
rows = (len(tiles) + cols - 1) // cols
sheet = Image.new('RGB', (cols * W + (cols - 1) * 6, rows * h + (rows - 1) * 6), (40, 40, 40))
for i, im in enumerate(tiles):
    sheet.paste(im, ((i % cols) * (W + 6), (i // cols) * (h + 6)))
sheet.save(out)
print(out, sheet.size)
