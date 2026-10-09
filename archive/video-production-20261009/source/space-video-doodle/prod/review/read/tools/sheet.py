#!/usr/bin/env python3
"""sheet.py <mode: half|phone> <out prefix> [frames dir] : sheets of the state frames with time / bar / texts labels"""
import json, sys, os, glob
sys.dont_write_bytecode = True
sys.path.insert(0, '/tmp/space-video-doodle/prod/tools')
import tempo
from PIL import Image, ImageDraw, ImageFont
C = tempo.load_compiled('flipping-in', rebuild=False); TL = tempo.Timeline(C)
R = '/tmp/space-video-doodle/prod/review/read'
S = json.load(open(R + '/states.json'))
mode, pre = sys.argv[1], sys.argv[2]
FONT = ImageFont.truetype('/tmp/music-space-font-cache/marker.ttf', 18)
FONTS = ImageFont.truetype('/tmp/music-space-font-cache/marker.ttf', 13)
def lab(t):
    sb, beat, k = TL.pos(t); m = int(t // 60); s = t - 60 * m
    return f"{m:02d}:{s:05.2f} {sb}:{beat:.2f}"
items = []
for s in S:
    f = round(s['ts'] * 60); p = f'{R}/frames/st_{f:06d}.png'
    if os.path.exists(p): items.append((p, s))
if mode == 'half':
    W, H, cols, rows, hdr = 640, 360, 3, 3, 40
else:
    W, H, cols, rows, hdr = 390, 219, 4, 5, 34
per = cols * rows
for pg in range(0, len(items), per):
    sheet = Image.new('RGB', (cols * (W + 8) + 8, rows * (H + hdr + 8) + 8), (40, 40, 40))
    d = ImageDraw.Draw(sheet)
    for i, (p, s) in enumerate(items[pg:pg + per]):
        im = Image.open(p).convert('RGB').resize((W, H), Image.LANCZOS)
        x = 8 + (i % cols) * (W + 8); y = 8 + (i // cols) * (H + hdr + 8)
        sheet.paste(im, (x, y + hdr))
        d.text((x, y), f"#{pg + i} {lab(s['ts'])}  ({s['dur']:.2f}s)", fill=(255, 220, 90), font=FONT)
        d.text((x, y + 20), ' | '.join(t.replace('\n', '/')[:12] for t in s['texts'])[:80 if mode == 'half' else 52], fill=(220, 220, 220), font=FONTS)
    sheet.save(f'{R}/sheets/{pre}-{pg // per + 1:02d}.png')
print(len(items), 'items')
