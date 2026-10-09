#!/usr/bin/env python3
"""Review aid: draw the manifest boxes of one mark on a frame of the 1080 edit copy (boxes are master px, drawn at 1/2).
usage: annotate.py <clip id> <mark label> <out.png> [offset_s]"""
import io, json, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

ROOT = '/tmp/space-video-doodle/prod/capture/desktop'
cid, label, out = sys.argv[1], sys.argv[2], sys.argv[3]
off = float(sys.argv[4]) if len(sys.argv) > 4 else 0.3
rec = json.load(open(f'{ROOT}/master/{cid}.rec.json'))
m = next(x for x in rec['marks'] if x['label'] == label)
n = m['frame'] + round(off * 60)
raw = subprocess.run(['/opt/homebrew/bin/ffmpeg', '-v', 'error', '-i', f'{ROOT}/1080/{cid}.mp4', '-vf', f'select=eq(n\\,{n})', '-fps_mode', 'passthrough', '-frames:v', '1', '-f', 'image2pipe', '-c:v', 'png', '-'], capture_output=True, check=True).stdout
im = Image.open(io.BytesIO(raw)).convert('RGB'); d = ImageDraw.Draw(im)
font = ImageFont.truetype('/tmp/music-space-font-cache/marker.ttf', 18)
cols = [(255, 92, 138), (31, 159, 131), (230, 160, 0), (60, 60, 200), (200, 40, 40)]
for i, (k, b) in enumerate((m.get('boxes') or {}).items()):
    if not b: continue
    x, y, w, h = [v / 2 for v in b]; c = cols[i % len(cols)]
    d.rectangle([x, y, x + w, y + h], outline=c, width=3); d.text((x + 3, y - 20 if y > 22 else y + h + 2), k, font=font, fill=c)
for p in m.get('people') or []:
    x, y, w, h = [v / 2 for v in p['label']]; d.rectangle([x, y, x + w, y + h], outline=(255, 92, 138), width=2)
    if p.get('dot'):
        cx, cy = p['dot'][0] / 2, p['dot'][1] / 2
        d.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], outline=(28, 27, 26), width=3)
        fw, fh = 80 * 4 / 3 / 2 * 2, 170 * 4 / 3 / 2 * 2          # 80 x 170 CSS px at 1080 = x1.333
        d.rectangle([cx - fw / 2, cy + 8, cx + fw / 2, cy + 8 + fh], outline=(31, 159, 131), width=2)
im.save(out); print(out, n, im.size)
