#!/usr/bin/env python3
"""contact sheet of review stills: sheet.py <dir> <out-prefix> [cols] [w] [per-sheet]"""
import sys, glob, os, re
from PIL import Image, ImageDraw, ImageFont
d, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 3
W = int(sys.argv[4]) if len(sys.argv) > 4 else 640
per = int(sys.argv[5]) if len(sys.argv) > 5 else 12
H = W * 9 // 16
F = ImageFont.truetype('/tmp/music-space-font-cache/digits.ttf', 26)
def key(p):
    b = os.path.basename(p)[:-4]; m = re.match(r'(\d+)_([\d.]+)', b)
    return (int(m.group(1)), float(m.group(2))) if m else (999, 0)
fs = sorted(glob.glob(os.path.join(d, '*.png')), key=key)
fs = [f for f in fs if re.match(r'\d+_', os.path.basename(f))]
for si in range(0, len(fs), per):
    chunk = fs[si:si + per]; rows = (len(chunk) + cols - 1) // cols
    S = Image.new('RGB', (cols * (W + 10) + 10, rows * (H + 40) + 10), (40, 40, 40)); dr = ImageDraw.Draw(S)
    for i, f in enumerate(chunk):
        r, c = divmod(i, cols); x = 10 + c * (W + 10); y = 10 + r * (H + 40)
        S.paste(Image.open(f).convert('RGB').resize((W, H), Image.LANCZOS), (x, y + 30))
        dr.text((x, y), os.path.basename(f)[:-4].replace('_', ':'), font=F, fill=(255, 212, 71))
    S.save(f'{out}-{si // per}.png'); print(f'{out}-{si // per}.png', len(chunk))
