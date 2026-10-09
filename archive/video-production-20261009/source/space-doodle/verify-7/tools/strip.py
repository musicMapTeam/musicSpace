import sys, os, re
from PIL import Image, ImageDraw
d, out, box = sys.argv[1], sys.argv[2], tuple(int(x) for x in sys.argv[3].split(','))
wanted = [int(x) for x in sys.argv[4].split(',')]
files = sorted(os.listdir(d)); times = [(int(re.search(r'-(-?\d+)ms', f).group(1)), f) for f in files]
picked = []
for w in wanted:
    best = min((abs(t - w), t, f) for t, f in times if t <= w + 5) if any(t <= w + 5 for t, f in times) else None
    if best: picked.append((best[1], best[2]))
scale = 2
crops = []
for t, f in picked:
    im = Image.open(os.path.join(d, f)).convert('RGB').crop(box)
    im = im.resize((im.width * scale, im.height * scale), Image.LANCZOS)
    canvas = Image.new('RGB', (im.width, im.height + 26), 'white'); canvas.paste(im, (0, 26))
    ImageDraw.Draw(canvas).text((6, 6), f'{t} ms', fill='black'); crops.append(canvas)
W = max(c.width for c in crops); H = sum(c.height for c in crops)
sheet = Image.new('RGB', (W, H), 'white'); y = 0
for c in crops: sheet.paste(c, (0, y)); y += c.height
sheet.save(out); print(out, [t for t, f in picked])
