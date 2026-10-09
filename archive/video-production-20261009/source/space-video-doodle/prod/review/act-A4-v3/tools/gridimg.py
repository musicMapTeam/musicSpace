# overlay a labelled source-pixel grid on a frame (for reading UI coordinates); usage: gridimg.py in.png out.png [step] [x0 y0 x1 y1]
import sys
from PIL import Image, ImageDraw, ImageFont
im = Image.open(sys.argv[1]).convert('RGB'); out = sys.argv[2]
step = int(sys.argv[3]) if len(sys.argv) > 3 else 100
if len(sys.argv) > 7:
    x0, y0, x1, y1 = map(int, sys.argv[4:8]); im = im.crop((x0, y0, x1, y1))
else:
    x0, y0 = 0, 0
d = ImageDraw.Draw(im); F = ImageFont.truetype('/tmp/music-space-font-cache/digits.ttf', 22)
W, H = im.size
for x in range((x0 // step + 1) * step - x0, W, step):
    d.line([(x, 0), (x, H)], fill=(255, 0, 0) if (x + x0) % (step * 5) == 0 else (0, 120, 255), width=1); d.text((x + 2, 2), str(x + x0), font=F, fill=(255, 0, 0))
for y in range((y0 // step + 1) * step - y0, H, step):
    d.line([(0, y), (W, y)], fill=(255, 0, 0) if (y + y0) % (step * 5) == 0 else (0, 120, 255), width=1); d.text((2, y + 2), str(y + y0), font=F, fill=(255, 0, 0))
im.save(out); print(out, im.size)
