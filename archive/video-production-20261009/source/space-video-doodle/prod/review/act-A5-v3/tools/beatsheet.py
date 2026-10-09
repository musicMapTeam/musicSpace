#!/usr/bin/env python3
"""beatsheet.py <stills dir> <out prefix> <labels csv> [cols] : one frame per beat, labelled, split into pages of 6 rows"""
import sys, os, glob
from PIL import Image, ImageDraw, ImageFont
d, out, labels = sys.argv[1], sys.argv[2], sys.argv[3].split(',')
cols = int(sys.argv[4]) if len(sys.argv) > 4 else 8
files = sorted(glob.glob(os.path.join(d, '*.png')))
assert len(files) == len(labels), (len(files), len(labels))
w = 480; h = 270; pad = 6; top = 22
try: font = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 16)
except Exception: font = None
rows_per_page = 6; per = cols * rows_per_page
for p in range(0, len(files), per):
    chunk = list(zip(files, labels))[p:p + per]
    rows = (len(chunk) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * (w + pad), rows * (h + top + pad)), (250, 248, 240)); dr = ImageDraw.Draw(sheet)
    for i, (f, lab) in enumerate(chunk):
        im = Image.open(f).convert('RGB').resize((w, h), Image.LANCZOS)
        x, y = (i % cols) * (w + pad), (i // cols) * (h + top + pad)
        sheet.paste(im, (x, y + top)); dr.text((x + 4, y + 3), lab, fill=(20, 20, 20), font=font)
    sheet.save(f'{out}-p{p // per + 1}.png'); print(f'{out}-p{p // per + 1}.png', sheet.size)
