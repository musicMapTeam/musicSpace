#!/usr/bin/env python3
"""sheet.py out.png  t1,t2,... (seconds or bar:beat) [--offs -6,-3,0,3,6] [--w 480]
Extract frames from the film at each time (+ frame offsets) and lay them out: one row per time."""
import sys, subprocess, numpy as np, os
sys.path.insert(0, os.path.dirname(__file__))
from grid import *
from PIL import Image, ImageDraw, ImageFont
SRC = '/tmp/space-video-doodle/prod/out/music-space-video-v1.mp4'
out = sys.argv[1]; times = sys.argv[2].split(',')
offs = [0]; W = 480
for i, a in enumerate(sys.argv):
    if a == '--offs': offs = [int(x) for x in sys.argv[i + 1].split(',')]
    if a == '--w': W = int(sys.argv[i + 1])
H = W * 9 // 16
def tsec(x):
    if ':' in x: return T(x)
    if x.startswith('f'): return int(x[1:]) / 60
    return float(x)
frames = []
for x in times:
    t = tsec(x); f0 = int(np.ceil(t * 60 - 1e-6))
    frames.append([(x, t, f0 + o) for o in offs])
imgs = {}
fs = W * H * 3
for row in frames:
    fa = min(f for (_, _, f) in row); fb = max(f for (_, _, f) in row)
    cmd = ['ffmpeg', '-v', 'error', '-ss', f'{(fa - 0.5)/60:.6f}', '-i', SRC, '-frames:v', str(fb - fa + 1), '-fps_mode', 'passthrough', '-vf', f'scale={W}:{H}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    for k in range(len(raw) // fs):
        imgs[fa + k] = Image.frombytes('RGB', (W, H), raw[k * fs:(k + 1) * fs])
pad = 22
sheet = Image.new('RGB', (len(offs) * (W + 4), len(frames) * (H + pad + 4)), 'white')
dr = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 14)
except Exception:
    font = ImageFont.load_default()
for r, row in enumerate(frames):
    for c, (x, t, f) in enumerate(row):
        X = c * (W + 4); Y = r * (H + pad + 4)
        if f in imgs: sheet.paste(imgs[f], (X, Y + pad))
        lab = f'f{f} {mmss(f/60)} {fmt_pos(f/60)} ({(f/60 - t)*1000:+.0f}ms)' if W >= 400 else f'{fmt_pos(f/60)} {(f/60 - t)*1000:+.0f}ms'
        dr.text((X + 2, Y + 3), lab, fill='black', font=font)
sheet.save(out)
print(out, sheet.size)
