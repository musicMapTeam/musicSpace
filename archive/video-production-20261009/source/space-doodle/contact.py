"""Contact sheets for the Doodle restyle: python contact.py -> /tmp/space-doodle/CONTACT-<code>.png and CONTACT-before-after.png"""
import pathlib, re, sys
from PIL import Image, ImageDraw, ImageFont
ROOT = pathlib.Path('/tmp/space-doodle/shots')
FONT = '/tmp/music-space-font-cache/marker.ttf'
f_title = ImageFont.truetype(FONT, 40); f_lab = ImageFont.truetype(FONT, 20)
PAPER = (247, 239, 223); INK = (28, 27, 26)

def tile(path, w):
    im = Image.open(path).convert('RGB'); h = round(im.height * w / im.width)
    return im.resize((w, h), Image.LANCZOS)

def sheet(title, items, w, cols, out):
    tiles = [(lab, tile(p, w)) for lab, p in items]
    if not tiles: return None
    rows = [tiles[i:i + cols] for i in range(0, len(tiles), cols)]
    pad, lab_h = 24, 34
    H = 90 + sum(max(t.height for _, t in r) + lab_h + pad for r in rows)
    W = pad + cols * (w + pad)
    canvas = Image.new('RGB', (W, H), PAPER); d = ImageDraw.Draw(canvas)
    d.text((pad, 24), title, font=f_title, fill=INK)
    y = 90
    for r in rows:
        x = pad
        for lab, t in r:
            d.text((x, y), lab[:60], font=f_lab, fill=INK)
            canvas.paste(t, (x, y + lab_h)); d.rectangle([x - 1, y + lab_h - 1, x + t.width, y + lab_h + t.height], outline=INK, width=2)
            x += w + pad
        y += max(t.height for _, t in r) + lab_h + pad
    canvas.save(out); return out

made = []
for code_dir in sorted(p for p in ROOT.iterdir() if p.is_dir()):
    code = code_dir.name
    phones = sorted(code_dir.glob('after-*phone*.png')); desks = sorted(code_dir.glob('after-*desktop*.png'))
    lab = lambda p: re.sub(r'^after-|-(phone|desktop).*$', '', p.stem)
    if phones: made.append(sheet(f'{code} · phone (after)', [(lab(p), p) for p in phones], 300, 6, f'/tmp/space-doodle/CONTACT-{code}-phone.png'))
    if desks: made.append(sheet(f'{code} · desktop (after)', [(lab(p), p) for p in desks], 640, 3, f'/tmp/space-doodle/CONTACT-{code}-desktop.png'))
# before/after pairs for every screen that has both
pairs = []
for code_dir in sorted(p for p in ROOT.iterdir() if p.is_dir()):
    for a in sorted(code_dir.glob('after-*phone*.png')):
        b = code_dir / a.name.replace('after-', 'before-', 1)
        if b.exists(): pairs += [(f'{code_dir.name}: {b.stem}', b), (f'{code_dir.name}: {a.stem}', a)]
if pairs: made.append(sheet('before → after (phone)', pairs, 300, 6, '/tmp/space-doodle/CONTACT-before-after.png'))
print('\n'.join(m for m in made if m))
