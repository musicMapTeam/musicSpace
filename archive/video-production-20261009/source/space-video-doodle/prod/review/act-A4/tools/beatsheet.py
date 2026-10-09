# per-beat contact sheet from an encoded act mp4: one frame at each beat (+ optional offset in beats), 8 per row (2 bars)
import sys, json, subprocess, io
from PIL import Image, ImageDraw, ImageFont
video, out = sys.argv[1], sys.argv[2]
off = float(sys.argv[3]) if len(sys.argv) > 3 else 0.0          # offset in beats after each beat (0.25 = a 16th later)
b0, b1 = (int(x) for x in (sys.argv[4] if len(sys.argv) > 4 else '41-54').split('-'))
rend = json.load(open(video[:-4] + '.render.json')); mp = rend['map']; t0 = rend['seconds'][0]
C = json.load(open(f'/tmp/space-video-doodle/prod/tools/tempo-maps/compiled/{mp}.json'))
bars = [b for b in C['bars'] if not '+' in b['sb'] and b0 <= int(b['sb']) <= b1] if 'ins' not in sys.argv else [b for b in C['bars'] if b0 <= int(b['sb'].split('+')[0]) <= b1]
items = []
for b in bars:
    for bt in range(4):
        t = b['t0'] + (bt + off) * b['len'] / 4
        items.append((f"{b['sb']}:{bt + 1 + off:g}", t))
W, H, PAD, LAB, COLS = 400, 225, 6, 24, 8
rows = (len(items) + COLS - 1) // COLS
sheet = Image.new('RGB', (COLS * (W + PAD) + PAD, rows * (H + LAB + PAD) + PAD), (247, 239, 223)); d = ImageDraw.Draw(sheet)
F = ImageFont.truetype('/tmp/music-space-font-cache/digits.ttf', 20)
for i, (lab, t) in enumerate(items):
    raw = subprocess.run(['/opt/homebrew/bin/ffmpeg', '-v', 'error', '-ss', f'{max(0, t - t0 + 0.001):.4f}', '-i', video, '-frames:v', '1', '-f', 'image2pipe', '-c:v', 'png', '-'], capture_output=True).stdout
    im = Image.open(io.BytesIO(raw)).convert('RGB').resize((W, H), Image.LANCZOS)
    r, c = divmod(i, COLS); x = PAD + c * (W + PAD); y = PAD + r * (H + LAB + PAD)
    sheet.paste(im, (x, y + LAB)); d.text((x + 2, y + 2), f'{lab}  {t:.2f}s', font=F, fill=(28, 27, 26))
sheet.save(out); print(out, sheet.size, len(items))
