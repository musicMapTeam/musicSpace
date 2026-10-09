"""Contact sheet of the final screens: phone (5 x 2) above desktop (2 x 5), each labelled. Usage: contact.py <dir> <out.png>"""
import sys, pathlib
from PIL import Image, ImageDraw, ImageFont

src = pathlib.Path(sys.argv[1]); out = pathlib.Path(sys.argv[2])
FONT = '/tmp/music-space-font-cache/marker.ttf'
SCREENS = [('01-first-screen', '第一屏'), ('02-join', '入场'), ('03-room', '现场'), ('04-onboarding-card', '第一次来'), ('05-upload', '放照片'),
           ('06-wall', '照片墙'), ('07-exchange-accepted', '交换已接受'), ('08-chat', '私聊'), ('09-community', '乐迷社群'), ('10-about', '关于')]
GAP, W = 24, 1680
PAPER, INK, MUTED = (246, 239, 226), (28, 26, 24), (110, 102, 92)
title_font, label_font, small = ImageFont.truetype(FONT, 46), ImageFont.truetype(FONT, 26), ImageFont.truetype(FONT, 22)

def fit(path, width):
    im = Image.open(path).convert('RGB')
    return im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)

phone_w = (W - GAP * 6) // 5
desk_w = (W - GAP * 3) // 2
phones = [fit(src / f'phone-{name}.png', phone_w) for name, _ in SCREENS]
desks = [fit(src / f'desktop-{name}.png', desk_w) for name, _ in SCREENS]
label_h = 44
phone_rows = 2; desk_rows = 5
H = 150 + phone_rows * (max(p.height for p in phones) + label_h + GAP) + 90 + desk_rows * (max(d.height for d in desks) + label_h + GAP) + 60
sheet = Image.new('RGB', (W, H), PAPER)
draw = ImageDraw.Draw(sheet)
draw.text((GAP, 28), 'Music Space 0.22.0-rc.2 · 完整产品的文案', font=title_font, fill=INK)
draw.text((GAP, 92), '生产构建（STATIC_OUT=/tmp/space-copy/final/dist-pages），每个视口一个新的种子世界，评委路线顺序', font=small, fill=MUTED)
y = 150
draw.text((GAP, y - 4), '手机 390×844', font=label_font, fill=MUTED); y += 40
for row in range(phone_rows):
    x = GAP; row_h = 0
    for i in range(5):
        k = row * 5 + i; im = phones[k]
        draw.text((x, y), f'{k + 1:02d} {SCREENS[k][1]}', font=label_font, fill=INK)
        sheet.paste(im, (x, y + label_h)); draw.rectangle([x - 1, y + label_h - 1, x + im.width, y + label_h + im.height], outline=INK, width=2)
        x += phone_w + GAP; row_h = max(row_h, im.height)
    y += label_h + row_h + GAP
y += 30
draw.text((GAP, y - 4), '桌面 1440×900', font=label_font, fill=MUTED); y += 40
for row in range(desk_rows):
    x = GAP; row_h = 0
    for i in range(2):
        k = row * 2 + i; im = desks[k]
        draw.text((x, y), f'{k + 1:02d} {SCREENS[k][1]}', font=label_font, fill=INK)
        sheet.paste(im, (x, y + label_h)); draw.rectangle([x - 1, y + label_h - 1, x + im.width, y + label_h + im.height], outline=INK, width=2)
        x += desk_w + GAP; row_h = max(row_h, im.height)
    y += label_h + row_h + GAP
sheet = sheet.crop((0, 0, W, y + 20))
sheet.save(out, optimize=True)
print(out, sheet.size, out.stat().st_size)
