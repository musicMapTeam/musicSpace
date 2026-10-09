"""Overlay a source-pixel grid on frames for measuring: grid.py out.png scale step img1 [img2 ...] (side by side)."""
import sys
from PIL import Image, ImageDraw, ImageFont

out, scale, step = sys.argv[1], float(sys.argv[2]), int(sys.argv[3])
ims = []
font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 16)
for p in sys.argv[4:]:
    im = Image.open(p).convert('RGB')
    W, H = im.size
    im = im.resize((int(W * scale), int(H * scale)), Image.LANCZOS)
    d = ImageDraw.Draw(im, 'RGBA')
    for x in range(0, W, step):
        X = x * scale
        d.line([(X, 0), (X, im.size[1])], fill=(0, 120, 255, 110 if x % (step * 5) else 200), width=1)
        if x % (step * 2) == 0:
            d.text((X + 2, 2), str(x), fill=(0, 60, 220, 255), font=font)
    for y in range(0, H, step):
        Y = y * scale
        d.line([(0, Y), (im.size[0], Y)], fill=(255, 0, 80, 110 if y % (step * 5) else 200), width=1)
        if y % (step * 2) == 0:
            d.text((2, Y + 1), str(y), fill=(220, 0, 60, 255), font=font)
    d.text((W * scale / 2 - 60, im.size[1] - 22), p.split('/')[-1], fill=(0, 0, 0, 255), font=font)
    ims.append(im)
w = sum(i.size[0] for i in ims) + 10 * (len(ims) - 1)
h = max(i.size[1] for i in ims)
sheet = Image.new('RGB', (w, h), 'white')
x = 0
for i in ims:
    sheet.paste(i, (x, 0)); x += i.size[0] + 10
sheet.save(out)
print(out, sheet.size)
