#!/usr/bin/env python3
"""Doodle-style contact sheet of the desktop takes: one row per clip, frames pulled from the 1080 edit copies at the rig's marks.
usage: contact.py <out.png>
"""
import io, json, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

ROOT = '/tmp/space-video-doodle/prod/capture/desktop-rc2'
FF = '/opt/homebrew/bin/ffmpeg'
FPS = 60
# (clip id, row title, [(mark label, offset s, caption)])
ROWS = [
    ('D-01-landing', 'D-01 落地页（H3 匹配剪辑）', [('landing', 0.2, '落地页 · 无指针'), ('landing', 4.0, '线条抖动（产品自带）'), ('end', -0.05, '8 s 末帧')]),
    ('D-02-room-hero', 'D-02 三维场馆全景 + 慢速运镜（E4 / W5 / CUT-01）', [('overview', 0.5, '全景 · 五人到齐'), ('glide-photos-start', 1.0, '慢移 → 照片墙'), ('photos', 1.0, '照片墙 · 4 张'), ('glide-yao-start', 1.0, '慢移 → 阿遥'), ('yao-close-up', 1.0, '阿遥 近景'), ('glide-overview2-start', 1.0, '拉回全景'), ('end', -0.05, '全景收尾')]),
    ('D-04-linjian-quiet', 'D-04 安静参与的人（S3）', [('overview', 0.5, '全景'), ('glide-linjian-start', 1.0, '慢移 → 林间'), ('linjian-close-up', 1.0, '林间 近景'), ('card-in', 0.1, '点「认识一下」'), ('card-settled', 1.0, 'TA 选择安静参与')]),
    ('D-03a-wall-before', 'D-03a 照片墙 · 上墙前', [('wall-4', 1.0, '4 张 · 同场的人')]),
    ('D-03s-wall-save', 'D-03s 桌面上墙（备用）', [('upload-sheet', 0.3, '放一张'), ('ai-chip', 0.2, 'AI 判断：人海'), ('ai-chip-centred', 0.6, '你说了算'), ('saved-wall-panel', 0.25, '已分享给本场成员'), ('camera-settled', 1.5, '墙面重排 · 5 张')]),
    ('D-03b-wall-after', 'D-03b 照片墙 · 上墙后（CUT-03）', [('wall-5', 1.0, '5 张 · 含你的')]),
    ('D-05-exchange', 'D-05 交换（桌面备用）', [('wall-badge', 0.5, '同一刻的另一面'), ('compose', 0.6, '交换一个视角'), ('reason', 0.4, '推荐 · 同一刻的另一面'), ('consent', 0.3, '勾选同意'), ('pending', 0.5, '等待对方回应'), ('accepted-top', 1.0, '交换已接受'), ('revoke', 1.0, '撤销这次交换')]),
    ('D-06-greet-chat', 'D-06 招手 + 私聊回复（桌面备用）', [('person-card', 0.5, '小满'), ('greet-sent', 0.3, '招呼已送达'), ('friends', 0.8, '你们已经认识了'), ('chat-open', 0.6, 'ONE TO ONE'), ('typed', 0.1, '打字'), ('sent', 0.3, '发出'), ('reply-settled', 1.0, '收到回复')]),
]
F = lambda n, s: ImageFont.truetype(f'/tmp/music-space-font-cache/{n}.ttf', s)
INK, PAPER, CARD, PINK, MINT, YEL = (28, 27, 26), (247, 239, 223), (255, 250, 240), (255, 92, 138), (95, 220, 192), (255, 212, 71)


def frame(path, n):
    raw = subprocess.run([FF, '-v', 'error', '-i', path, '-vf', f'select=eq(n\\,{n})', '-fps_mode', 'passthrough', '-frames:v', '1', '-f', 'image2pipe', '-c:v', 'png', '-'], capture_output=True, check=True).stdout
    return Image.open(io.BytesIO(raw)).convert('RGB')


def main(out):
    CW, CH, GAP, CAP, ROWH, LEFT, TOP = 520, 293, 22, 46, 0, 40, 170
    cols = max(len(r[2]) for r in ROWS)
    W = LEFT * 2 + cols * CW + (cols - 1) * GAP
    rowh = 58 + CH + CAP + 34
    H = TOP + len(ROWS) * rowh + 40
    sheet = Image.new('RGB', (W, H), PAPER); d = ImageDraw.Draw(sheet)
    for x in range(0, W, 32):
        for y in range(0, H, 32): d.ellipse([x - 1.2, y - 1.2, x + 1.2, y + 1.2], fill=(214, 204, 186))
    d.text((LEFT, 30), 'MUSIC SPACE', font=F('logo', 64), fill=YEL, stroke_width=3, stroke_fill=INK)
    d.text((LEFT + 470, 34), '桌面实拍素材', font=F('display', 56), fill=INK)
    d.text((LEFT + 470 + int(d.textlength('桌面实拍素材', font=F('display', 56))) + 24, 48), '/ desktop takes', font=F('marker', 40), fill=INK)
    d.text((LEFT, 112), 'rc2 · 0.22.0-rc.2 (space-final/dist-pages) · CSS 1440×810 @8/3 → 3840×2160 母版 + 1920×1080 Lanczos · 60 fps · 逐帧受控时钟 · 访客 阿宁（失真）· 时钟 2026-10-08 22:40 · 帧取自 1080 剪辑版', font=F('marker', 26), fill=INK)
    y = TOP
    for cid, title, picks in ROWS:
        rec = json.load(open(f'{ROOT}/master/{cid}.rec.json'))
        marks = {m['label']: m for m in rec['marks']}
        d.rounded_rectangle([LEFT, y, LEFT + 30 + int(d.textlength(title, font=F('marker', 30))) + 20, y + 46], radius=23, fill=CARD, outline=INK, width=3)
        d.text((LEFT + 22, y + 7), title, font=F('marker', 30), fill=INK)
        d.text((W - LEFT - 420, y + 10), f"{rec['seconds']:.2f} s · {rec['frames']} f", font=F('digits', 30), fill=INK)
        for i, (lab, off, cap) in enumerate(picks):
            m = marks[lab]; n = max(0, min(rec['frames'] - 1, m['frame'] + round(off * FPS)))
            im = frame(f'{ROOT}/1080/{cid}.mp4', n).resize((CW, CH), Image.LANCZOS)
            x = LEFT + i * (CW + GAP); yy = y + 58
            d.rectangle([x + 7, yy + 7, x + CW + 7, yy + CH + 7], fill=INK)
            sheet.paste(im, (x, yy)); d.rectangle([x - 2, yy - 2, x + CW + 1, yy + CH + 1], outline=INK, width=4)
            d.rounded_rectangle([x, yy + CH + 12, x + 132, yy + CH + 12 + 36], radius=10, fill=YEL, outline=INK, width=2)
            d.text((x + 10, yy + CH + 15), f'{n / FPS:6.2f}s', font=F('digits', 26), fill=INK)
            d.text((x + 144, yy + CH + 16), cap, font=F('marker', 25), fill=INK)
        y += rowh
    sheet.save(out); print(out, sheet.size)


if __name__ == '__main__':
    main(sys.argv[1])
