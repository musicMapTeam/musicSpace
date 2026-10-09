#!/usr/bin/env python3
"""Contact sheet of a rendered mp4 at storyboard positions (what the judges see, decoded from the encoded file).

  PY tools/contact.py <video.mp4> <out.png> [--map ID] [--at 1:3,2:1.5,...] [--per-bar 2.6] [--cols 5] [--from-s S]
  default: one frame per bar of the video's range, at beat 2.6 (mid-bar, after the bar's first hits have settled)
"""
import io, json, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import tempo
FF = '/opt/homebrew/bin/ffmpeg'
F = lambda n, s: ImageFont.truetype(f'/tmp/music-space-font-cache/{n}.ttf', s)


def frame_at(video, t):
    raw = subprocess.run([FF, '-v', 'error', '-ss', f'{max(0, t):.4f}', '-i', video, '-frames:v', '1', '-f', 'image2pipe', '-c:v', 'png', '-'], capture_output=True).stdout
    return Image.open(io.BytesIO(raw)).convert('RGB') if raw else Image.new('RGB', (1920, 1080), (40, 40, 40))


def main():
    a = sys.argv[1:]; video, out = a[0], a[1]; opt = dict(zip(a[2::2], a[3::2]))
    base = video[:-4]; rend = json.load(open(base + '.render.json')) if os.path.exists(base + '.render.json') else None
    mid = opt.get('--map') or (rend or {}).get('map') or 'flipping-in'
    C = tempo.load_compiled(mid); tl = tempo.Timeline(C)
    t0, t1 = (rend['seconds'] if rend else [float(opt.get('--from-s', 0)), C['end_s']])
    if '--at' in opt:
        pos = opt['--at'].split(',')
    else:
        beat = opt.get('--per-bar', '2.6'); pos = [f"{b['sb']}:{beat}" for b in C['bars'] if t0 - 1e-6 <= b['t0'] < t1 - 1e-6]
    items = [(p, tl.t(p)) for p in pos]; items = [(p, t) for p, t in items if t is not None and t0 <= t < t1]
    cols = int(opt.get('--cols', 5)); CW, CH, PAD, LAB = 640, 360, 18, 46
    rows = (len(items) + cols - 1) // cols; W = cols * (CW + PAD) + PAD; H = 110 + rows * (CH + LAB + PAD) + PAD
    sheet = Image.new('RGB', (W, H), (247, 239, 223)); d = ImageDraw.Draw(sheet)
    for x in range(0, W, 34):
        for y in range(0, H, 34): d.point((x, y), fill=(214, 204, 186))
    d.text((PAD, 22), 'MUSIC SPACE', font=F('logo', 52), fill=(255, 212, 71), stroke_width=3, stroke_fill=(28, 27, 26))
    d.text((PAD + 420, 34), f"{os.path.basename(video)} · {C['label'][:60]} · {t0:.2f}-{t1:.2f} s", font=F('marker', 26), fill=(28, 27, 26))
    for i, (p, t) in enumerate(items):
        im = frame_at(video, t - t0 + 0.001).resize((CW, CH), Image.LANCZOS)
        r, c = divmod(i, cols); x = PAD + c * (CW + PAD); y = 110 + r * (CH + LAB + PAD)
        sheet.paste(im, (x, y + LAB)); d.rectangle([x - 3, y + LAB - 3, x + CW + 2, y + LAB + CH + 2], outline=(28, 27, 26), width=4)
        d.rounded_rectangle([x, y + 4, x + 250, y + 40], radius=18, fill=(255, 212, 71), outline=(28, 27, 26), width=3)
        d.text((x + 12, y + 8), f'{p}  {int(t // 60)}:{t % 60:05.2f}', font=F('digits', 26), fill=(28, 27, 26))
    sheet.save(out); print(out, sheet.size, len(items), 'frames')


if __name__ == '__main__':
    main()
