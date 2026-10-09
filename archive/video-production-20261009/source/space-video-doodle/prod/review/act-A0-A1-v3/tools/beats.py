#!/usr/bin/env python3
"""Beat sheets of an encoded mp4: one frame per beat (or any positions), paged.
  PY beats.py <video.mp4> <out-prefix> --map flipping-in-b --from 1:1 --to 21:1 [--step 1] [--per-page 16] [--cols 4] [--video-t0 S] [--w 600]
  --at 1:1,1:2.5,...   explicit positions instead of the beat grid
"""
import io, os, subprocess, sys, json
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, '/tmp/space-video-doodle/prod/tools')
import tempo
FF = '/opt/homebrew/bin/ffmpeg'
F = lambda n, s: ImageFont.truetype(f'/tmp/music-space-font-cache/{n}.ttf', s)

def frame_at(video, t):
    raw = subprocess.run([FF, '-v', 'error', '-ss', f'{max(0.0, t):.4f}', '-i', video, '-frames:v', '1', '-f', 'image2pipe', '-c:v', 'png', '-'], capture_output=True).stdout
    return Image.open(io.BytesIO(raw)).convert('RGB') if raw else Image.new('RGB', (1920, 1080), (40, 40, 40))

def main():
    a = sys.argv[1:]; video, pre = a[0], a[1]; opt = dict(zip(a[2::2], a[3::2]))
    mid = opt.get('--map', 'flipping-in-b'); C = tempo.load_compiled(mid); tl = tempo.Timeline(C)
    base = video[:-4]; rend = json.load(open(base + '.render.json')) if os.path.exists(base + '.render.json') else None
    vt0 = float(opt['--video-t0']) if '--video-t0' in opt else ((rend or {}).get('seconds', [0])[0] if rend else 0.0)
    if '--at' in opt:
        pos = opt['--at'].split(',')
    else:
        b0, b1 = int(opt.get('--from', '1:1').split(':')[0]), int(opt.get('--to', '21:1').split(':')[0])
        step = float(opt.get('--step', '1')); pos = []
        for b in range(b0, b1):
            k = 1.0
            while k < 5 - 1e-9:
                pos.append(f'{b}:{k:g}'); k += step
    items = [(p, tl.t(p)) for p in pos]; items = [(p, t) for p, t in items if t is not None]
    per = int(opt.get('--per-page', 16)); cols = int(opt.get('--cols', 4)); CW = int(opt.get('--w', 600)); CH = CW * 9 // 16; PAD, LAB = 14, 40
    outs = []
    for pg in range(0, len(items), per):
        chunk = items[pg:pg + per]; rows = (len(chunk) + cols - 1) // cols
        W = cols * (CW + PAD) + PAD; H = rows * (CH + LAB + PAD) + PAD
        sheet = Image.new('RGB', (W, H), (247, 239, 223)); d = ImageDraw.Draw(sheet)
        for i, (p, t) in enumerate(chunk):
            im = frame_at(video, t - vt0 + 0.001).resize((CW, CH), Image.LANCZOS)
            r, c = divmod(i, cols); x = PAD + c * (CW + PAD); y = PAD + r * (CH + LAB + PAD)
            sheet.paste(im, (x, y + LAB)); d.rectangle([x - 2, y + LAB - 2, x + CW + 1, y + LAB + CH + 1], outline=(28, 27, 26), width=3)
            d.text((x + 4, y + 6), f'{p}   {int(t // 60)}:{t % 60:05.2f}', font=F('digits', 26), fill=(28, 27, 26))
        out = f'{pre}-p{pg // per + 1:02d}.png'; sheet.save(out); outs.append(out)
    print('\n'.join(outs))

if __name__ == '__main__':
    main()
