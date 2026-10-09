#!/usr/bin/env python3
"""beatframes.py <act.mp4> <out prefix> [offset_beats=0.3] : one frame per beat (bars 55-72) decoded from the rendered act video,
labelled bar:beat and film time, one row per bar, pages of 6 bars."""
import sys, os, subprocess, json
sys.path.insert(0, '/tmp/space-video-doodle/prod/tools'); import tempo
from PIL import Image, ImageDraw, ImageFont
mp4, out = sys.argv[1], sys.argv[2]; off = float(sys.argv[3]) if len(sys.argv) > 3 else 0.3
C = tempo.load_compiled('flipping-in-b', rebuild=False); tl = tempo.Timeline(C); t0 = tl.t('55:1')
w, h, pad, top = 480, 270, 6, 24
try: font = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 17)
except Exception: font = None
tmp = out + '.tmp'; os.makedirs(tmp, exist_ok=True)
bars = list(range(55, 73))
for p in range(0, len(bars), 6):
    rows = bars[p:p + 6]
    sheet = Image.new('RGB', (4 * (w + pad), len(rows) * (h + top + pad)), (250, 248, 240)); dr = ImageDraw.Draw(sheet)
    for r, b in enumerate(rows):
        for k in range(4):
            pos = f'{b}:{k + 1 + off:g}'; t = tl.t(pos)
            f = os.path.join(tmp, pos.replace(':', '_') + '.png')
            subprocess.run(['/opt/homebrew/bin/ffmpeg', '-v', 'error', '-y', '-ss', f'{t - t0:.4f}', '-i', mp4, '-frames:v', '1', '-vf', f'scale={w}:{h}', f], check=True)
            x, y = k * (w + pad), r * (h + top + pad)
            sheet.paste(Image.open(f).convert('RGB'), (x, y + top))
            m, s = divmod(t, 60); dr.text((x + 4, y + 3), f'{pos}  {int(m)}:{s:05.2f}', fill=(20, 20, 20), font=font)
    name = f'{out}-bars{rows[0]}-{rows[-1]}.png'; sheet.save(name); print(name, sheet.size)
