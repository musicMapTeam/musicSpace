"""Contact sheet of PNG stills: sheet.py <out.png> <cols> <width> <label=png>... (labels drawn top-left)."""
import sys
from PIL import Image, ImageDraw, ImageFont
out, cols, W = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
items = [a.split('=', 1) for a in sys.argv[4:]]
H = round(W * 9 / 16)
rows = (len(items) + cols - 1) // cols
S = Image.new('RGB', (cols * W + (cols + 1) * 8, rows * (H + 8) + 8), (40, 40, 40))
try:
    font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', max(14, W // 30))
except Exception:
    font = ImageFont.load_default()
d = ImageDraw.Draw(S)
for i, (lab, p) in enumerate(items):
    im = Image.open(p).convert('RGB').resize((W, H), Image.LANCZOS)
    x, y = 8 + (i % cols) * (W + 8), 8 + (i // cols) * (H + 8)
    S.paste(im, (x, y))
    tw = d.textlength(lab, font=font)
    d.rectangle((x, y, x + tw + 12, y + font.size + 10), fill=(255, 214, 64))
    d.text((x + 6, y + 4), lab, fill=(20, 20, 20), font=font)
S.save(out)
print(out, S.size)
