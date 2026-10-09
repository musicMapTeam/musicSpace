import sys, os
from PIL import Image, ImageDraw, ImageFont
d, t0, fps, out = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), sys.argv[4]
cols = int(sys.argv[5]) if len(sys.argv) > 5 else 6
fs = sorted(f for f in os.listdir(d) if f.endswith('.jpg'))
F = ImageFont.truetype('/tmp/music-space-font-cache/digits.ttf', 18)
im0 = Image.open(os.path.join(d, fs[0])); tw, th = im0.size
rows = (len(fs) + cols - 1) // cols
S = Image.new('RGB', (cols * (tw + 4), rows * (th + 24)), (30, 30, 30)); dr = ImageDraw.Draw(S)
for i, f in enumerate(fs):
    im = Image.open(os.path.join(d, f)); x = (i % cols) * (tw + 4); y = (i // cols) * (th + 24)
    S.paste(im, (x, y + 22)); dr.text((x, y), f'{t0 + i / fps:.2f}s', font=F, fill=(255, 230, 120))
S.save(out); print(out, len(fs))
