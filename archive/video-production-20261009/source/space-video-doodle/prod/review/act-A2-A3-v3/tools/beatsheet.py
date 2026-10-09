"""Per-beat review sheets from an encoded act: beatsheet.py <video.mp4> <map> <bar0> <bar1> <outprefix> [offset_s] [bars_per_sheet]
One frame per beat (beat + offset, default 0.10 s so entrances have landed), 4 columns = the 4 beats of a bar, labelled bar:beat."""
import json, subprocess, sys, os, glob
from PIL import Image, ImageDraw, ImageFont

video, mp, b0, b1, outp = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
off = float(sys.argv[6]) if len(sys.argv) > 6 else 0.10
per = int(sys.argv[7]) if len(sys.argv) > 7 else 4
C = json.load(open(f'/tmp/space-video-doodle/prod/tools/tempo-maps/compiled/{mp}.json'))
bars = {b['sb']: b for b in C['bars']}
# the act video starts at the first frame of its range: read it from the render sidecar if present
rj = video.replace('.mp4', '.render.json')
t_start = None
if os.path.exists(rj):
    r = json.load(open(rj)); t_start = r['frames'][0] / 60 if r.get('frames') else None
if t_start is None:
    t_start = bars[str(b0)]['t0']
items = []
for b in range(b0, b1 + 1):
    if str(b) not in bars: continue
    B = bars[str(b)]
    for k in range(4):
        t = B['t0'] + k * B['len'] / 4 + off
        items.append((f'{b}:{k + 1}', int(round((t - t_start) * 60))))
tmp = '/tmp/beatsheet_tmp'; os.makedirs(tmp, exist_ok=True)
for f in glob.glob(tmp + '/*.png'): os.remove(f)
sel = '+'.join(f'eq(n\\,{n})' for _, n in items)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', video, '-vf', f"select='{sel}',scale=480:270", '-fps_mode', 'passthrough', tmp + '/f%04d.png'], check=True)
files = sorted(glob.glob(tmp + '/*.png'))
assert len(files) == len(items), (len(files), len(items))
font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 20)
sheets = []
for s0 in range(0, len(items), per * 4):
    chunk = list(zip(items[s0:s0 + per * 4], files[s0:s0 + per * 4]))
    rows = (len(chunk) + 3) // 4
    sheet = Image.new('RGB', (4 * 480 + 3 * 4, rows * 270 + (rows - 1) * 4), (40, 40, 40))
    for i, ((lab, n), f) in enumerate(chunk):
        im = Image.open(f).convert('RGB'); d = ImageDraw.Draw(im)
        tw = d.textlength(lab, font=font); d.rectangle([0, 0, tw + 10, 26], fill=(255, 212, 71)); d.text((5, 2), lab, fill=(28, 27, 26), font=font)
        sheet.paste(im, ((i % 4) * 484, (i // 4) * 274))
    out = f'{outp}-{chunk[0][0][0].split(":")[0]}.png'; sheet.save(out); sheets.append(out)
print('\n'.join(sheets))
