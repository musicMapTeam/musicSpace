#!/usr/bin/env python3
"""Extract numbered frames from a clip and lay them out as a labelled strip (review aid).
usage: frames.py clip.mp4 out.png f1 f2 ... [--w 360] [--cols N] [--crop x,y,w,h]
"""
import subprocess, sys, json
import numpy as np
from PIL import Image, ImageDraw, ImageFont

FF = '/opt/homebrew/bin/ffmpeg'
args = sys.argv[1:]
def opt(name, default):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return default
W = int(opt('--w', 360)); cols = int(opt('--cols', 0)); crop = opt('--crop', '')
clip, out, *fr = args
fr = [int(f) for f in fr]
probe = json.loads(subprocess.run(['/opt/homebrew/bin/ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', clip], capture_output=True, text=True).stdout)['streams'][0]
w0, h0 = probe['width'], probe['height']
sel = '+'.join(f'eq(n\\,{f})' for f in fr)
vf = f"select='{sel}'"
if crop:
    x, y, cw, ch = map(int, crop.split(',')); vf += f',crop={cw}:{ch}:{x}:{y}'; w0, h0 = cw, ch
raw = subprocess.run([FF, '-v', 'error', '-i', clip, '-vf', vf + ',format=rgb24', '-fps_mode', 'passthrough', '-f', 'rawvideo', '-'], capture_output=True).stdout
n = len(raw) // (w0 * h0 * 3)
imgs = np.frombuffer(raw[:n * w0 * h0 * 3], np.uint8).reshape(n, h0, w0, 3)
H = round(W * h0 / w0)
cols = cols or min(len(fr), 8)
rows = (n + cols - 1) // cols
sheet = Image.new('RGB', (cols * (W + 10) + 10, rows * (H + 34) + 10), (247, 239, 223))
d = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype('/tmp/music-space-font-cache/digits.ttf', 22)
except Exception:
    font = ImageFont.load_default()
for i in range(n):
    im = Image.fromarray(imgs[i]).resize((W, H), Image.LANCZOS)
    cx, cy = 10 + (i % cols) * (W + 10), 10 + (i // cols) * (H + 34)
    sheet.paste(im, (cx, cy + 28))
    d.text((cx + 2, cy + 2), f'f{fr[i]} · {fr[i] / 60:.2f}s', fill=(28, 27, 26), font=font)
sheet.save(out)
print(out, n, 'frames')
