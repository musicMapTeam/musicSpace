"""Final contact sheet: the judge route on the production Pages build, phone row + desktop rows."""
from PIL import Image, ImageDraw, ImageFont
D = '/tmp/space-doodle/final'
FONT = '/tmp/music-space-font-cache/marker.ttf'
f_title = ImageFont.truetype(FONT, 46); f_sub = ImageFont.truetype(FONT, 24); f_lab = ImageFont.truetype(FONT, 24)
PAPER = (247, 239, 223); INK = (28, 27, 26); PINK = (255, 92, 138)
SCREENS = [('01-first-screen', '01 first screen'), ('02-join', '02 join'), ('03-room', '03 room overview'), ('04-upload', '04 upload · AI sure'),
           ('05-wall', '05 wall · other-side badge'), ('06-accepted', '06 exchange accepted'), ('07-chat', '07 chat'), ('08-about', '08 about')]
def tile(path, w):
    im = Image.open(path).convert('RGB'); return im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
pad, lab_h = 26, 40
phones = [(lab, tile(f'{D}/{key}-phone.png', 360)) for key, lab in SCREENS]
desks = [(lab, tile(f'{D}/{key}-desktop.png', 746)) for key, lab in SCREENS]
W = pad + 8 * (360 + pad)
rows = [phones] + [desks[i:i + 4] for i in (0, 4)]
H = 140 + sum(max(t.height for _, t in r) + lab_h + pad + 40 for r in rows)
canvas = Image.new('RGB', (W, H), PAPER); d = ImageDraw.Draw(canvas)
d.text((pad, 24), 'Music Space · Doodle restyle · final judge route', font=f_title, fill=INK)
d.text((pad, 84), 'production build (npm run build:pages, served at /musicSpace/) · zero /api requests · no console errors · 2026-10-07', font=f_sub, fill=PINK)
y = 140
for name, r in (('phone 390×844 @2x', rows[0]), ('desktop 1440×900', rows[1]), ('', rows[2])):
    if name: d.text((pad, y), name, font=f_sub, fill=INK); y += 40
    x = pad
    for lab, t in r:
        d.text((x, y), lab, font=f_lab, fill=INK)
        canvas.paste(t, (x, y + lab_h)); d.rectangle([x - 2, y + lab_h - 2, x + t.width + 1, y + lab_h + t.height + 1], outline=INK, width=3)
        x += t.width + pad
    y += max(t.height for _, t in r) + lab_h + pad
canvas = canvas.crop((0, 0, W, y + 10))
canvas.save(f'{D}/CONTACT-final.png'); print(canvas.size)
