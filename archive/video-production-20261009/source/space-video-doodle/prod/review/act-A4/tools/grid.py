# extract a frame from a clip and overlay a labelled coordinate grid (source px), for measuring UI positions
import sys, subprocess, io
from PIL import Image, ImageDraw, ImageFont
clip, frame, out = sys.argv[1], int(sys.argv[2]), sys.argv[3]
crop = [int(v) for v in sys.argv[4].split(',')] if len(sys.argv) > 4 else None
step = int(sys.argv[5]) if len(sys.argv) > 5 else 100
if clip.endswith('.png') or clip.endswith('.jpg'):
    im = Image.open(clip).convert('RGB')
else:
    raw = subprocess.run(['/opt/homebrew/bin/ffmpeg', '-v', 'error', '-i', clip, '-vf', f'select=eq(n\\,{frame})', '-frames:v', '1', '-f', 'image2pipe', '-c:v', 'png', '-'], capture_output=True).stdout
    im = Image.open(io.BytesIO(raw)).convert('RGB')
x0, y0 = 0, 0
if crop: x0, y0, x1, y1 = crop; im = im.crop((x0, y0, x1, y1))
d = ImageDraw.Draw(im, 'RGBA')
F = ImageFont.truetype('/tmp/music-space-font-cache/digits.ttf', 22)
W, H = im.size
for gx in range((x0 // step) * step, x0 + W + 1, step):
    X = gx - x0
    if X < 0: continue
    d.line([(X, 0), (X, H)], fill=(0, 120, 255, 110) if gx % (step * 5) else (255, 0, 0, 170), width=1)
    for gy in range((y0 // step) * step, y0 + H + 1, step * 2):
        Y = gy - y0
        if Y >= 0: d.text((X + 2, Y + 2), f'{gx},{gy}', font=F, fill=(255, 0, 0, 230))
for gy in range((y0 // step) * step, y0 + H + 1, step):
    Y = gy - y0
    if Y < 0: continue
    d.line([(0, Y), (W, Y)], fill=(0, 120, 255, 110) if gy % (step * 5) else (255, 0, 0, 170), width=1)
im.save(out); print(out, im.size)
