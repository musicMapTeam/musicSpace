"""montage of PNG stills: PY sheet.py <dir> <out.png> [cols] [width]"""
import sys, os
from PIL import Image, ImageDraw, ImageFont
d, out = sys.argv[1], sys.argv[2]; cols = int(sys.argv[3]) if len(sys.argv) > 3 else 3; W = int(sys.argv[4]) if len(sys.argv) > 4 else 800
files = sorted(f for f in os.listdir(d) if f.endswith('.png'))
def key(f):
    a = f[:-4].replace('-', '.').split('_'); return (int(a[0]), float(a[1]) if len(a) > 1 else 0)
try: files.sort(key=key)
except Exception: pass
H = W * 9 // 16; L = 34; pad = 10
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (W + pad) + pad, rows * (H + L + pad) + pad), (240, 232, 214))
dr = ImageDraw.Draw(sheet); F = ImageFont.truetype('/tmp/music-space-font-cache/digits.ttf', 26)
for i, f in enumerate(files):
    im = Image.open(os.path.join(d, f)).convert('RGB').resize((W, H), Image.LANCZOS)
    r, c = divmod(i, cols); x = pad + c * (W + pad); y = pad + r * (H + L + pad)
    sheet.paste(im, (x, y + L)); dr.text((x + 4, y + 2), f[:-4].replace('_', ':').replace('-', '.'), font=F, fill=(28, 27, 26))
sheet.save(out); print(out, sheet.size)
