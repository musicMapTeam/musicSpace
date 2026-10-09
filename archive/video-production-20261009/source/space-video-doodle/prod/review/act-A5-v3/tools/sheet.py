#!/usr/bin/env python3
"""sheet.py out.png w cols img1 img2 ... : contact sheet, each image scaled to width w, labelled with its file name"""
import sys, os
from PIL import Image, ImageDraw, ImageFont
out, w, cols = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]); files = sys.argv[4:]
ims = []
for f in files:
    im = Image.open(f).convert('RGB'); h = round(im.height * w / im.width); ims.append((os.path.basename(f), im.resize((w, h), Image.LANCZOS)))
rows = (len(ims) + cols - 1) // cols
H = max(i.height for _, i in ims) + 26
sheet = Image.new('RGB', (cols * (w + 8), rows * H), 'white'); d = ImageDraw.Draw(sheet)
try: font = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 16)
except Exception: font = None
for k, (name, im) in enumerate(ims):
    x, y = (k % cols) * (w + 8), (k // cols) * H
    sheet.paste(im, (x, y + 24)); d.text((x + 2, y + 3), name, fill='black', font=font)
sheet.save(out)
