# frames of an act mp4 at storyboard positions -> one labelled grid.  usage: at.py video.mp4 out.png "41:1+3f,42:4,51:1.25" [cols] [tileW]
# a position is bar:beat (storyboard), optionally +Nf (frames) ; inserted bars as 54+1:2
import sys, json, subprocess, io, re
from PIL import Image, ImageDraw, ImageFont
video, out, spec = sys.argv[1], sys.argv[2], sys.argv[3]
cols = int(sys.argv[4]) if len(sys.argv) > 4 else 2
TW = int(sys.argv[5]) if len(sys.argv) > 5 else 960
rend = json.load(open(video[:-4] + '.render.json')); mp = rend['map']; v0 = rend['seconds'][0]
C = json.load(open(f'/tmp/space-video-doodle/prod/tools/tempo-maps/compiled/{mp}.json'))
bars = {str(b['sb']): b for b in C['bars']}
def tpos(p):
    m = re.match(r'^([\d+]+):([\d.]+)(?:([+-]\d+)f)?$', p.strip())
    sb, bt, fr = m.group(1), float(m.group(2)), int(m.group(3) or 0)
    b = bars[sb]; return b['t0'] + (bt - 1) * b['len'] / 4 + fr / 60
items = [(p.strip(), tpos(p)) for p in spec.split(',') if p.strip()]
TH = TW * 9 // 16; PAD, LAB = 8, 30
rows = (len(items) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (TW + PAD) + PAD, rows * (TH + LAB + PAD) + PAD), (60, 60, 60)); d = ImageDraw.Draw(sheet)
F = ImageFont.truetype('/tmp/music-space-font-cache/digits.ttf', 24)
for i, (lab, t) in enumerate(items):
    fr = round((t - v0) * 60)
    raw = subprocess.run(['/opt/homebrew/bin/ffmpeg', '-v', 'error', '-ss', f'{max(0, fr / 60 - 0.002):.4f}', '-i', video, '-frames:v', '1', '-f', 'image2pipe', '-c:v', 'png', '-'], capture_output=True).stdout
    im = Image.open(io.BytesIO(raw)).convert('RGB').resize((TW, TH), Image.LANCZOS)
    r, c = divmod(i, cols); x = PAD + c * (TW + PAD); y = PAD + r * (TH + LAB + PAD)
    sheet.paste(im, (x, y + LAB)); d.text((x + 4, y + 2), f'{lab}  t={t:.3f}s  f{fr}', font=F, fill=(255, 255, 255))
sheet.save(out); print(out, sheet.size, len(items))
