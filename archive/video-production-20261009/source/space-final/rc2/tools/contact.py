"""Contact sheet of the final rc2 screenshots: python contact.py <shotDir> <out.png>"""
import sys, pathlib
from PIL import Image, ImageDraw, ImageFont

SHOTS = pathlib.Path(sys.argv[1]); OUT = pathlib.Path(sys.argv[2])
FONT = '/tmp/music-space-font-cache/marker.ttf'
ORDER = [
    ('room-01-first-screen', '房间 · 首屏'), ('room-02-join', '进入现场'), ('room-03-room', '房间'), ('room-04-onboarding-card', '第一次来 1/4'),
    ('room-05-upload', '放照片 · 人海那张'), ('room-06-wall', '照片墙'), ('room-07-accepted', '交换已接受'), ('room-08-chat', '私聊回复'),
    ('room-09-community', '月台 Livehouse 乐迷社群'), ('room-10-about', '关于 Music Space'), ('room-10b-about-online', '关于 · 在线版一句'),
    ('map-01-explore-round', '音乐探索 · 寻声'), ('map-02-duet-sources', '合唱 · 来源 展开'), ('map-03-my-discoveries', '音乐探索 · 我的发现'),
]
title_font = ImageFont.truetype(FONT, 44)
label_font = ImageFont.truetype(FONT, 24)
small_font = ImageFont.truetype(FONT, 20)
PAD, GAP, LABEL = 36, 22, 40
phone_w = 270; phone_h = round(phone_w * 844 / 390)
desk_w = 500; desk_h = round(desk_w * 900 / 1440)
pcols, dcols = 7, 4
prow = -(-len(ORDER) // pcols); drow = -(-len(ORDER) // dcols)
W = max(PAD * 2 + pcols * phone_w + (pcols - 1) * GAP, PAD * 2 + dcols * desk_w + (dcols - 1) * GAP)
H = PAD + 70 + 50 + prow * (phone_h + LABEL + GAP) + 50 + drow * (desk_h + LABEL + GAP) + PAD
sheet = Image.new('RGB', (W, H), (245, 239, 225))
d = ImageDraw.Draw(sheet)
d.text((PAD, PAD), 'Music Space 0.22.0-rc.2 · 最终构建（dist-pages，index.html sha256 57d0254d…）· 2026-10-08', font=title_font, fill=(28, 26, 24))
y = PAD + 70
missing = []
def section(name, kind, cols, w, h, y):
    d.text((PAD, y), name, font=label_font, fill=(200, 60, 100)); y += 50
    for i, (key, label) in enumerate(ORDER):
        col, row = i % cols, i // cols
        x = PAD + col * (w + GAP); yy = y + row * (h + LABEL + GAP)
        f = SHOTS / f'{kind}-{key}.png'
        if not f.exists():
            missing.append(f.name); d.rectangle((x, yy, x + w, yy + h), outline=(200, 0, 0), width=3); continue
        im = Image.open(f).convert('RGB'); im.thumbnail((w, h), Image.LANCZOS)
        sheet.paste(im, (x, yy))
        d.rectangle((x - 1, yy - 1, x + im.width, yy + im.height), outline=(28, 26, 24), width=2)
        d.text((x, yy + h + 8), f'{i + 1:02d} {label}', font=small_font, fill=(28, 26, 24))
    return y + (-(-len(ORDER) // cols)) * (h + LABEL + GAP)
y = section('手机 390×844（Chrome，Apple M4，Metal）', 'phone', pcols, phone_w, phone_h, y)
y = section('桌面 1440×900', 'desktop', dcols, desk_w, desk_h, y + 10)
sheet = sheet.crop((0, 0, W, min(H, y + PAD)))
sheet.save(OUT, optimize=True)
print(OUT, sheet.size, 'missing:', missing or 'none')
