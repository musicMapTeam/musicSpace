"""Tile render.mjs --stills output (sorted by frame) with labels into sheets: stillsheets.py <dir> <outprefix> <labels-file> [per] [cols] [width]"""
import sys, glob
from PIL import Image, ImageDraw, ImageFont
d, outp, lf = sys.argv[1], sys.argv[2], sys.argv[3]
per = int(sys.argv[4]) if len(sys.argv) > 4 else 12
cols = int(sys.argv[5]) if len(sys.argv) > 5 else 3
W = int(sys.argv[6]) if len(sys.argv) > 6 else 640
labels = open(lf).read().strip().split(',')
files = sorted(glob.glob(d + '/*.png'))
assert len(files) == len(labels), (len(files), len(labels))
font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 22)
outs = []
for s0 in range(0, len(files), per):
    chunk = list(zip(labels[s0:s0 + per], files[s0:s0 + per]))
    tiles = []
    for lab, f in chunk:
        im = Image.open(f).convert('RGB'); im = im.resize((W, int(W * im.size[1] / im.size[0])), Image.LANCZOS)
        dr = ImageDraw.Draw(im); tw = dr.textlength(lab, font=font)
        dr.rectangle([0, 0, tw + 12, 30], fill=(255, 212, 71)); dr.text((6, 3), lab, fill=(28, 27, 26), font=font)
        tiles.append(im)
    h = tiles[0].size[1]; rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * W + (cols - 1) * 6, rows * h + (rows - 1) * 6), (40, 40, 40))
    for i, im in enumerate(tiles): sheet.paste(im, ((i % cols) * (W + 6), (i // cols) * (h + 6)))
    out = f'{outp}-{s0 // per + 1}.png'; sheet.save(out); outs.append(out)
print('\n'.join(outs))
