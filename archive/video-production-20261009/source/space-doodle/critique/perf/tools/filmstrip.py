# filmstrip.py <framesDir> <out.png> <t1,t2,...> [crop x,y,w,h]  -> frame shown at each time (latest frame <= t)
import sys, os
from PIL import Image, ImageDraw, ImageFont
d, out, times = sys.argv[1], sys.argv[2], [int(x) for x in sys.argv[3].split(',')]
crop = [int(v) for v in sys.argv[4].split(',')] if len(sys.argv) > 4 else None
frames = sorted((int(f[:-4]), f) for f in os.listdir(d) if f.endswith('.jpg'))
tiles = []
for t in times:
    cand = [f for ms, f in frames if ms <= t]
    if not cand: tiles.append((t, None)); continue
    im = Image.open(os.path.join(d, cand[-1])).convert('RGB')
    if crop: im = im.crop((crop[0], crop[1], crop[0] + crop[2], crop[1] + crop[3]))
    tiles.append((t, im))
w = max(im.width for _, im in tiles if im); h = max(im.height for _, im in tiles if im)
cols = min(len(tiles), int(sys.argv[5]) if len(sys.argv) > 5 else 6); rows = (len(tiles) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (w + 8), rows * (h + 28)), 'white'); dr = ImageDraw.Draw(sheet)
try: font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 18)
except Exception: font = None
for i, (t, im) in enumerate(tiles):
    x, y = (i % cols) * (w + 8), (i // cols) * (h + 28)
    dr.text((x + 4, y + 4), f'{t} ms', fill='black', font=font)
    if im: sheet.paste(im, (x, y + 26))
sheet.save(out); print(out, sheet.size)
