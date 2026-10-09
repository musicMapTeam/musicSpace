# Contact sheet of the final map screenshots: a phone row and a desktop grid, each shot labelled in the marker face.
# /tmp/space-fonts/venv/bin/python -I contact.py
from PIL import Image, ImageDraw, ImageFont

SRC = '/tmp/space-map/final'
OUT = '/tmp/space-map/final/CONTACT-map.png'
FONT = '/tmp/music-space-font-cache/marker.ttf'
STATES = [('1-courtyard', '小院'), ('2-search', '搜歌手'), ('3-path-sources', '一段合唱 ·「来源」展开'), ('4-found-song', '留下一首'),
          ('5-my-discoveries', '我的发现'), ('5b-kept-songs', '留下的歌 ·「来源」在行内'), ('6-record-shop', '唱片店 · 寻声')]
PAPER, INK, INK2 = (247, 239, 223), (28, 27, 26), (90, 84, 76)
W, GAP, PW, DW = 2020, 18, 268, 480
title_font = ImageFont.truetype(FONT, 40)
label_font = ImageFont.truetype(FONT, 22)
small_font = ImageFont.truetype(FONT, 20)

def thumb(name, width):
    image = Image.open(f'{SRC}/{name}.png').convert('RGB')
    return image.resize((width, round(image.height * width / image.width)), Image.LANCZOS)

phones = [thumb(f'phone-{key}', PW) for key, _ in STATES]
desks = [thumb(f'desktop-{key}', DW) for key, _ in STATES]
label_h = 34
phone_h = max(t.height for t in phones) + label_h
desk_h = desks[0].height + label_h
rows = (len(desks) + 3) // 4
H = 90 + 40 + phone_h + 60 + 40 + rows * (desk_h + GAP) + 20
sheet = Image.new('RGB', (W, H), PAPER)
draw = ImageDraw.Draw(sheet)
draw.text((GAP, 24), 'Music Space · 音乐探索 — 生产构建 /musicSpace/music-map/（2026-10-08）', font=title_font, fill=INK)

def framed(image, x, y, label):
    draw.rectangle([x - 3, y - 3, x + image.width + 2, y + image.height + 2], outline=INK, width=3)
    sheet.paste(image, (x, y))
    draw.text((x, y + image.height + 8), label, font=label_font, fill=INK)

y = 90
draw.text((GAP, y), '手机 390×844', font=small_font, fill=INK2)
y += 40
x = GAP
for image, (_, label) in zip(phones, STATES):
    framed(image, x, y, label); x += PW + GAP
y += phone_h + 40
draw.text((GAP, y), '桌面 1440×900', font=small_font, fill=INK2)
y += 40
for index, (image, (_, label)) in enumerate(zip(desks, STATES)):
    col, row = index % 4, index // 4
    framed(image, GAP + col * (DW + GAP), y + row * (desk_h + GAP), label)
sheet.save(OUT, optimize=True)
print(OUT, sheet.size)
