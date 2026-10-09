"""Build labelled sheets from a list of PNG frames: python sheet.py out_prefix cols rows tile_w file1 file2 ..."""
import sys, os, re
from PIL import Image, ImageDraw, ImageFont
out, cols, rows, tw = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4])
files = sys.argv[5:]
font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 22) if os.path.exists('/System/Library/Fonts/Supplemental/Arial Bold.ttf') else ImageFont.load_default()
BAR = 4 * 60 / 123
per = cols * rows
for si in range(0, len(files), per):
    chunk = files[si:si + per]
    ims = [Image.open(f).convert('RGB') for f in chunk]
    th = round(tw * 9 / 16)
    sheet = Image.new('RGB', (cols * tw + (cols + 1) * 6, rows * (th + 30) + (rows + 1) * 6), (40, 40, 40))
    d = ImageDraw.Draw(sheet)
    for i, (f, im) in enumerate(zip(chunk, ims)):
        im = im.resize((tw, th), Image.LANCZOS)
        c, r = i % cols, i // cols
        x = 6 + c * (tw + 6); y = 6 + r * (th + 36)
        sheet.paste(im, (x, y + 28))
        lab = os.path.basename(f).replace('.png', '')
        m = re.search(r't([0-9.]+)', lab)
        d.text((x + 4, y + 2), lab, fill=(255, 230, 120), font=font)
    sheet.save(f'{out}-{si // per:02d}.png')
    print(f'{out}-{si // per:02d}.png', len(chunk))
