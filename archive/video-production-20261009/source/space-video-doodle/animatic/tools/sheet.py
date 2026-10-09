# contact sheet: tools/sheet.py out.png cols cellW label1=img1 label2=img2 ...
import sys
from PIL import Image, ImageDraw, ImageFont
out, cols, cw = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]); items = [a.split('=', 1) for a in sys.argv[4:]]
if len(items) == 1 and items[0][0].startswith('glob:'):
    import glob, os; items = [(os.path.basename(f)[:-4], f) for f in sorted(glob.glob(items[0][1]))]
ch = cw * 9 // 16; rows = (len(items) + cols - 1) // cols; pad = 14; lab = 34
sheet = Image.new('RGB', (cols * (cw + pad) + pad, rows * (ch + pad + lab) + pad), (247, 239, 223)); d = ImageDraw.Draw(sheet)
try: font = ImageFont.truetype('/tmp/music-space-font-cache/marker.ttf', 24)
except Exception: font = None
for i, (label, path) in enumerate(items):
    r, c = divmod(i, cols); x = pad + c * (cw + pad); y = pad + r * (ch + pad + lab)
    im = Image.open(path).convert('RGB').resize((cw, ch), Image.LANCZOS); sheet.paste(im, (x, y + lab))
    d.rectangle([x - 2, y + lab - 2, x + cw + 1, y + lab + ch + 1], outline=(28, 27, 26), width=3)
    d.text((x, y + 4), label, fill=(28, 27, 26), font=font)
sheet.save(out); print(out, sheet.size)
