#!/usr/bin/env python3
"""Contact sheets of the encoded film (what the judges see, decoded from the mp4):

  PY out/tools/sheets.py <video.mp4> [--map ID] [--beat 2.6] [--per-page 30] [--cols 6] [--dir out/contact]

  <dir>/<name>.bars-p<k>.png   one frame per storyboard bar (at beat 2.6: mid-bar, after the bar's first hits have settled),
                               30 per page (6 x 5), labelled bar / timecode / act / shot
  <dir>/<name>.overview-16.png 16 key moments of the film (4 x 4)
Companion files next to the video (<name>.render.json, <name>.info.json) give the range, the act table and the shot list.
"""
import io, json, os, re, subprocess, sys
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, '/tmp/space-video-doodle/prod/tools')
import tempo

FF = '/opt/homebrew/bin/ffmpeg'
FONT = lambda n, s: ImageFont.truetype(f'/tmp/music-space-font-cache/{n}.ttf', s)
PAPER, INK, YEL, PINK, MINT, DOT = (247, 239, 223), (28, 27, 26), (255, 212, 71), (255, 92, 138), (95, 220, 192), (214, 204, 186)
ACT_COL = {'act-A0-A1': YEL, 'act-A2-A3': MINT, 'act-A4': PINK, 'act-A5': YEL, 'act-A6-A7': MINT}
# v3 (2026-10-08): the 16 key moments of the rc.2 cut (v2's list in out/work/v3/sheets.v2-backup.py): the H3 match cut and the Music
# Map beat (65-66) are new; P2 (14:3) and the venue's 「更愿意推广」 (76:3.5) made room
KEY = [('4:2', 'H1 collage: 8 rc.2 product moments'), ('6:3', 'H2 title 同一刻，另一面。'), ('8:3', 'H3 match cut: the real landing page'),
       ('10:3.5', 'P1 你拍了人海，TA 拍了舞台'), ('20:3.5', 'P3 能把那一面，换回来？'), ('22:2', 'E1 drop: the product'),
       ('28:2', 'E4 the 3D livehouse'), ('33:3.8', 'A2 AI 在本机判断，照片不上传'), ('38:3.5', 'A5 3 分钟内拍下，就是同一刻'),
       ('42:2.5', 'M1 the collision · 不到 1 分钟'), ('51:1.6', 'M6 PAYOFF 交换已接受'), ('66:3.5', 'MAP 音乐探索 · 沿着合唱，找到下一首'),
       ('74:2', 'V Livehouse 开个房 · 乐迷社群'), ('77:4', 'W3 隐私 · 同意 · 好玩'), ('79:4', 'W4 曲终，人不散。'), ('87:2', 'C1 end card + QR')]


def frame_at(video, t):
    raw = subprocess.run([FF, '-v', 'error', '-ss', f'{max(0.0, t):.4f}', '-i', video, '-frames:v', '1', '-f', 'image2pipe', '-c:v', 'png', '-'], capture_output=True).stdout
    return Image.open(io.BytesIO(raw)).convert('RGB') if raw else Image.new('RGB', (1920, 1080), (40, 40, 40))


def paper(W, H):
    im = Image.new('RGB', (W, H), PAPER); d = ImageDraw.Draw(im)
    for x in range(0, W, 32):
        for y in range(0, H, 32): d.ellipse([x - 1, y - 1, x + 1, y + 1], fill=DOT)
    return im, d


def header(d, x, title, sub):
    d.text((x, 22), 'MUSIC SPACE', font=FONT('logo', 54), fill=YEL, stroke_width=3, stroke_fill=INK)
    d.text((x + 430, 24), title, font=FONT('marker', 46), fill=INK)
    d.text((x + 430, 82), sub, font=FONT('marker', 24), fill=INK)


def tc(t):
    return f'{int(t // 60)}:{t % 60:05.2f}'


def tile(sheet, d, im, x, y, W, H, lab1, lab2, col):
    sheet.paste(im.resize((W, H), Image.LANCZOS), (x, y))
    d.rectangle([x - 3, y - 3, x + W + 2, y + H + 2], outline=INK, width=4)
    w1 = d.textlength(lab1, font=FONT('digits', 26)) + 24
    d.rounded_rectangle([x, y - 44, x + w1, y - 8], radius=16, fill=col, outline=INK, width=3)
    d.text((x + 12, y - 41), lab1, font=FONT('digits', 26), fill=INK)
    d.text((x + w1 + 10, y - 38), lab2, font=FONT('marker', 22), fill=INK)


def main():
    a = sys.argv[1:]
    video = a[0]; opt = dict(zip(a[1::2], a[2::2]))
    base = video[:-4]; name = os.path.basename(base)
    rend = json.load(open(base + '.render.json')) if os.path.exists(base + '.render.json') else None
    info = json.load(open(base + '.info.json')) if os.path.exists(base + '.info.json') else {}
    mid = opt.get('--map') or (rend or {}).get('map') or 'flipping-in'
    C = tempo.load_compiled(mid); tl = tempo.Timeline(C)
    trk = C.get('track') or {}
    C['label'] = f"map {C['id']} · {trk.get('artist', '')}《{trk.get('title', '')}》{C.get('bpm', 0):g} BPM"     # (the map's own label has a ✂ the font lacks)
    t0, t1 = (rend['seconds'] if rend else [0.0, C['end_s']])
    out_dir = opt.get('--dir', os.path.join(os.path.dirname(os.path.abspath(video)), 'contact')); os.makedirs(out_dir, exist_ok=True)
    acts = (info.get('film') or {}).get('acts') or []
    shots = [s for s in info.get('shots', []) if s['z'] < 30]
    act_of = lambda t: next((x['id'] for x in acts if x['t0'] - 1e-6 <= t < x['t1'] + 1e-6), '')
    def shot_of(t):
        on = [s for s in shots if s['t0'] - 1e-6 <= t < s['t1']]
        return max(on, key=lambda s: (s['z'], s['t0']))['id'] if on else ''

    # ---------------------------------------------------------------- one frame per bar
    beat = opt.get('--beat', '2.6'); per = int(opt.get('--per-page', 30)); cols = int(opt.get('--cols', 6))
    items = [(b['sb'], f"{b['sb']}:{beat}", b['t0'] + (float(beat) - 1) / C['bpb'] * b['len']) for b in C['bars'] if t0 - 1e-6 <= b['t0'] < t1 - 1e-6]
    cut = [str(x) for x in C.get('cut', [])]
    W, H, PAD, LAB = 480, 270, 22, 50
    pages = [items[i:i + per] for i in range(0, len(items), per)]
    files = []
    for k, page in enumerate(pages, 1):
        rows = (len(page) + cols - 1) // cols
        SW = cols * (W + PAD) + PAD; SH = 130 + rows * (H + LAB + PAD) + PAD
        sheet, d = paper(SW, SH)
        header(d, PAD, f'一小节一帧 · 第 {k}/{len(pages)} 页', f"{name}.mp4 · {C['label'][:70]} · bars {page[0][0]}–{page[-1][0]}" + (f" · map cuts bar {', '.join(cut)}" if cut else ''))
        for i, (sb, pos, t) in enumerate(page):
            r, c = divmod(i, cols); x = PAD + c * (W + PAD); y = 130 + r * (H + LAB + PAD) + LAB
            act = act_of(t)
            tile(sheet, d, frame_at(video, t - t0 + 0.001), x, y, W, H, f'{pos}  {tc(t)}', (act.replace('act-', '') + ' · ' + shot_of(t))[:34], ACT_COL.get(act, YEL))
        f = os.path.join(out_dir, f'{name}.bars-p{k}.png'); sheet.save(f); files.append(f); print(f, sheet.size, len(page), 'frames')

    # ---------------------------------------------------------------- 16 key moments
    W, H, PAD = 900, 506, 26
    keys = [(p, lab, tl.t(p)) for p, lab in KEY]; keys = [(p, lab, t) for p, lab, t in keys if t is not None and t0 <= t < t1][:16]
    cols = 4; rows = (len(keys) + cols - 1) // cols
    SW = cols * (W + PAD) + PAD; SH = 130 + rows * (H + LAB + PAD) + PAD
    sheet, d = paper(SW, SH)
    header(d, PAD, '16 个关键画面', f"{name}.mp4 · {tc(t1 - t0)} · {C['label'][:80]}")
    for i, (p, lab, t) in enumerate(keys):
        r, c = divmod(i, cols); x = PAD + c * (W + PAD); y = 130 + r * (H + LAB + PAD) + LAB
        act = act_of(t)
        tile(sheet, d, frame_at(video, t - t0 + 0.001), x, y, W, H, f'{p}  {tc(t)}', lab, ACT_COL.get(act, YEL))
    f = os.path.join(out_dir, f'{name}.overview-16.png'); sheet.save(f); files.append(f); print(f, sheet.size, len(keys), 'frames')


if __name__ == '__main__':
    main()
