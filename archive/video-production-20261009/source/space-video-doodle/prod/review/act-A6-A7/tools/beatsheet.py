"""Frames of an act mp4 at every beat (+offset) -> labelled contact sheets (one bar per row).
   PY beatsheet.py <mp4> <map> <bar0> <bar1> <outprefix> [offset_s=0.12] [parts=3] [cols=4] [w=640]"""
import sys, os, json, subprocess, tempfile
sys.path.insert(0, '/tmp/space-video-doodle/prod/tools')
import tempo
from PIL import Image, ImageDraw, ImageFont
mp4, mid, b0, b1, outp = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
off = float(sys.argv[6]) if len(sys.argv) > 6 else 0.12
parts = int(sys.argv[7]) if len(sys.argv) > 7 else 3
cols = int(sys.argv[8]) if len(sys.argv) > 8 else 4
W = int(sys.argv[9]) if len(sys.argv) > 9 else 640
rj = json.load(open(mp4[:-4] + '.render.json')); F0 = rj['frames'][0]; F1 = rj['frames'][1]
C = tempo.load_compiled(mid)
rows = []
for r in C['bars']:
    sb = r['sb']; base = int(str(sb).split('+')[0])
    if base < b0 or base > b1: continue
    cells = []
    for q in range(4):
        t = r['t0'] + q * r['len'] / 4 + off
        cells.append((f"{sb}:{q + 1}+{off:.2f}s", t))
    rows.append(cells)
# the tail after the grid (end card hold) as one more row
end = F1 / 60.0; g = C['grid_end_s']
if end - g > 0.2:
    tl = [(f"tail +{k * (end - g) / 4:.2f}s", g + k * (end - g) / 4 + 0.02) for k in range(4)]
    rows.append(tl)
frames = sorted({max(F0, min(F1 - 1, round(t * 60))) - F0 for row in rows for _, t in row})
tmp = tempfile.mkdtemp(prefix='beats-')
sel = '+'.join(f'eq(n\\,{n})' for n in frames)
subprocess.run(['ffmpeg', '-v', 'error', '-i', mp4, '-vf', f"select='{sel}'", '-fps_mode', 'passthrough', os.path.join(tmp, 'f%06d.png')], check=True)
got = sorted(os.listdir(tmp))
# frame_pts gives the pts index; map back by order
fmap = {n: os.path.join(tmp, f) for n, f in zip(frames, got)}
H = W * 9 // 16; L = 30; pad = 8
F = ImageFont.truetype('/tmp/music-space-font-cache/digits.ttf', 24)
per = (len(rows) + parts - 1) // parts
outs = []
for p in range(parts):
    rr = rows[p * per:(p + 1) * per]
    if not rr: continue
    sheet = Image.new('RGB', (cols * (W + pad) + pad, len(rr) * (H + L + pad) + pad), (240, 232, 214))
    dr = ImageDraw.Draw(sheet)
    for i, row in enumerate(rr):
        for j, (lab, t) in enumerate(row):
            n = max(F0, min(F1 - 1, round(t * 60))) - F0
            im = Image.open(fmap[n]).convert('RGB').resize((W, H), Image.LANCZOS)
            x = pad + j * (W + pad); y = pad + i * (H + L + pad)
            sheet.paste(im, (x, y + L)); dr.text((x + 4, y + 2), f"{lab}  {t:.2f}s", font=F, fill=(28, 27, 26))
    o = f"{outp}-{p}.png"; sheet.save(o); outs.append(o); print(o, sheet.size)
