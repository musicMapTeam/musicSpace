# contact sheet from a directory of stills named <label>.png (label = bar:beat with ':' -> '_')
import sys, os, glob
from PIL import Image, ImageDraw, ImageFont
d, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 6
CW, CH = int(sys.argv[4]) if len(sys.argv) > 4 else 480, None
files = sorted(glob.glob(os.path.join(d, '*.png')), key=lambda p: [float(x) for x in os.path.basename(p)[:-4].replace('+', '.').split('_')])
CH = CW * 9 // 16; PAD, LAB = 10, 30
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (CW + PAD) + PAD, rows * (CH + LAB + PAD) + PAD), (247, 239, 223))
dr = ImageDraw.Draw(sheet); F = ImageFont.truetype('/tmp/music-space-font-cache/digits.ttf', 24)
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB').resize((CW, CH), Image.LANCZOS)
    r, c = divmod(i, cols); x = PAD + c * (CW + PAD); y = PAD + r * (CH + LAB + PAD)
    sheet.paste(im, (x, y + LAB)); dr.rectangle([x - 2, y + LAB - 2, x + CW + 1, y + LAB + CH + 1], outline=(28, 27, 26), width=2)
    dr.text((x + 4, y + 2), os.path.basename(f)[:-4].replace('_', ':'), font=F, fill=(28, 27, 26))
sheet.save(out); print(out, sheet.size, len(files))
