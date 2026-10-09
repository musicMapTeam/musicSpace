#!/usr/bin/env python3
"""Contact sheet for the P2/P3 capture pass: clip key frames (with frame numbers and the action at that frame),
die-cuts over a checker (alpha visible), avatar stickers, full stills and product exports.  Doodle paper look, product fonts.
usage: contact.py out.png
"""
import json, subprocess, sys, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = '/tmp/space-video-doodle/prod/capture/P2P3'
FF = '/opt/homebrew/bin/ffmpeg'
FONT = '/tmp/music-space-font-cache'
f_title = ImageFont.truetype(f'{FONT}/display.ttf', 64)
f_h = ImageFont.truetype(f'{FONT}/marker.ttf', 36)
f_t = ImageFont.truetype(f'{FONT}/marker.ttf', 22)
f_s = ImageFont.truetype(f'{FONT}/marker.ttf', 18)
f_d = ImageFont.truetype(f'{FONT}/digits.ttf', 24)
INK, PAPER, PINK, MINT, YEL = (28, 27, 26), (247, 239, 223), (255, 92, 138), (95, 220, 192), (255, 212, 71)
W = 3000

def frames(clip, nums):
    pr = json.loads(subprocess.run(['/opt/homebrew/bin/ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', clip], capture_output=True, text=True).stdout)['streams'][0]
    w, h = pr['width'], pr['height']
    sel = '+'.join(f'eq(n\\,{n})' for n in nums)
    raw = subprocess.run([FF, '-v', 'error', '-i', clip, '-vf', f"select='{sel}',format=rgb24", '-fps_mode', 'passthrough', '-f', 'rawvideo', '-'], capture_output=True).stdout
    k = len(raw) // (w * h * 3)
    arr = np.frombuffer(raw[:k * w * h * 3], np.uint8).reshape(k, h, w, 3)
    return [Image.fromarray(a) for a in arr]

def checker(w, h, s=14):
    im = Image.new('RGB', (w, h), (255, 255, 255))
    d = ImageDraw.Draw(im)
    for y in range(0, h, s):
        for x in range(0, w, s):
            if ((x // s) + (y // s)) % 2: d.rectangle([x, y, x + s - 1, y + s - 1], fill=(214, 222, 232))
    return im

def paper(w, h):
    im = Image.new('RGB', (w, h), PAPER)
    d = ImageDraw.Draw(im)
    for y in range(12, h, 32):
        for x in range(12, w, 32):
            d.ellipse([x - 1.6, y - 1.6, x + 1.6, y + 1.6], fill=(214, 206, 191))
    return im

def tile(im, label, sub, w, h, alpha=False):
    """polaroid-ish tile: image fitted in w x h, label under it"""
    im = im.convert('RGBA')
    sc = min(w / im.width, h / im.height)
    t = im.resize((max(1, round(im.width * sc)), max(1, round(im.height * sc))), Image.LANCZOS)
    card = Image.new('RGB', (w + 20, h + 78), (255, 253, 246))
    bg = checker(t.width, t.height) if alpha else Image.new('RGB', t.size, (255, 255, 255))
    bg = bg.convert('RGBA'); bg.alpha_composite(t)
    card.paste(bg.convert('RGB'), (10 + (w - t.width) // 2, 10 + (h - t.height) // 2))
    d = ImageDraw.Draw(card)
    d.rectangle([0, 0, card.width - 1, card.height - 1], outline=INK, width=3)
    d.text((12, h + 18), label, font=f_t, fill=INK)
    d.text((12, h + 46), sub, font=f_s, fill=(90, 86, 80))
    return card

def section(sheet, y, title, color):
    d = ImageDraw.Draw(sheet)
    tw = d.textlength(title, font=f_h)
    d.rectangle([40, y + 30, 40 + tw + 24, y + 52], fill=color)
    d.text((52, y + 4), title, font=f_h, fill=INK)
    return y + 70

def place_row(sheet, y, tiles, gap=26, x0=40):
    x, rowh = x0, 0
    for t in tiles:
        if x + t.width > W - 40:
            x, y = x0, y + rowh + gap; rowh = 0
        sheet.paste(t, (x + 6, y + 6), None) if False else None
        # hard ink shadow
        sh = Image.new('RGB', t.size, INK)
        sheet.paste(sh, (x + 8, y + 9))
        sheet.paste(t, (x, y))
        x += t.width + gap; rowh = max(rowh, t.height)
    return y + rowh + gap + 10

def main(out):
    blocks = []
    # ---- clips
    clip_rows = []
    for name in ['P-06', 'P-21']:
        tj = json.load(open(f'{ROOT}/clips/{name}.take.json'))
        KEY = {
            'P-06': [(0, 'room, route card 示例路线 1/4'), (117, 'tap 舞台 · 示例照片 (ring)'), (122, 'upload sheet fades in'), (128, 'form at top: 拍摄于 21:47'),
                     (134, 'jump-scroll: 不确定，请选择 (33:4)'), (219, 'tap 舞台 chip (press)'), (226, '舞台 selected, AI line gone'), (325, 'end (hold)')],
            'P-21': [(0, 'after-show chat room'), (62, 'b0 topics sheet opens'), (119, 'b2 form opens'), (206, 'b4 晚班列车 typed'), (265, 'b6 纸灯乐队 typed'),
                     (330, 'b8 note typing (32nds)'), (382, 'b11 consent ticked'), (411, 'b12 posted card on screen'), (527, 'end (hold on the card)')],
        }
        sel = KEY[name]
        ims = frames(f'{ROOT}/clips/{name}.mp4', [f for f, _ in sel])
        tiles = [tile(im, f'f{f}  {f / 60:.2f} s', l[:30], 230, 498) for im, (f, l) in zip(ims, sel)]
        clip_rows.append((name, tj, tiles))
    # ---- cut-outs
    items = []
    for jf in ['stills-phone.json', 'stills-unsure.json']:
        items += json.load(open(f'{ROOT}/logs/{jf}'))['items']
    cut_tiles = []
    for it in items:
        if 'alpha' in it.get('files', {}):
            im = Image.open(it['files']['alpha'])
            bn = os.path.basename(it['files']['alpha'])
            cut_tiles.append(tile(im, bn.split('_')[0], bn.split('_', 1)[1][:34], 300, 300, alpha=True))
    opaque_only = [it for it in items if 'alpha' not in it.get('files', {}) and 'opaque' in it.get('files', {})]
    for it in opaque_only:
        bn = os.path.basename(it['files']['opaque'])
        cut_tiles.append(tile(Image.open(it['files']['opaque']), bn.split('_')[0] + ' (opaque)', bn.split('_', 1)[1][:34], 300, 300))
    # ---- avatars
    av_tiles = []
    for k, lab in [('cast-yao', '阿遥·示例'), ('cast-man', '小满·示例'), ('cast-bei', '北屿·示例'), ('cast-lin', '林间·示例 (rebuilt)'), ('visitor-aning-shizhen', '阿宁 失真')]:
        for a in ['quarter', 'front', 'side', 'back']:
            av_tiles.append(tile(Image.open(f'{ROOT}/avatars/png/{k}-{a}.png'), lab if a == 'quarter' else '', f'{k}-{a}', 96, 200, alpha=True))
    # ---- stills / exports
    st = []
    for f, lab in [('stills/CUT-13_phone-landing.png', 'CUT-13 landing'), ('exports/CORNER-01_creation-corner-invitation-phone.png', 'CORNER-01'), ('stills/CUT-08ui_memory-card-result-phone.png', 'CUT-08ui'),
                   ('exports/CUT-08_memory-card.png', 'CUT-08 memory card PNG'), ('exports/CORNER-02_creation-corner-panel.png', 'CORNER-02 (alpha)'), ('cut/CUT-02_wardrobe-stand-shizhen-quarter.opaque.png', 'CUT-02 stand')]:
        st.append(tile(Image.open(f'{ROOT}/{f}'), lab, f.split('/')[-1][:34], 280 if 'CUT-08_' in f or 'CORNER-02' in f or 'CUT-02' in f else 200, 433, alpha='CORNER-02' in f))
    for f, lab in [('stills/CUT-01_room-overview-4k.png', 'CUT-01 3840x2160'), ('stills/CUT-03a_3d-wall-4-photos-4k.png', 'CUT-03a 4 photos'), ('stills/CUT-03_3d-wall-5-photos-4k.png', 'CUT-03 5 photos')]:
        st.append(tile(Image.open(f'{ROOT}/{f}'), lab, f.split('/')[-1][:34], 560, 315))
    for f in ['sample-crowd.jpg', 'yao-stage.jpg', 'sample-stage.jpg']:
        st.append(tile(Image.open(f'{ROOT}/exports/CUT-09/{f}'), 'CUT-09 ' + f, 'build file, unmodified', 300, 240))

    # ---- compose
    H = 9000
    sheet = paper(W, H)
    d = ImageDraw.Draw(sheet)
    d.text((40, 30), 'MUSIC SPACE', font=ImageFont.truetype(f'{FONT}/logo.ttf', 54), fill=YEL, stroke_width=3, stroke_fill=INK)
    d.text((40, 100), '同一刻，另一面。 P2 / P3 与剪纸素材', font=f_title, fill=INK)
    meta = 'build 8fa52f0 dist-pages · served under /musicSpace/ · phone 1080x2340 @60 fps (CSS 390x845 @2.769) · desktop stills 3840x2160 · clock 2026-10-07 22:40 +08:00 · visitor 阿宁 in 失真 · beat grid 123 BPM (Flipping In)'
    d.text((40, 186), meta, font=f_t, fill=(70, 66, 60))
    y = 240
    for name, tj, tiles in clip_rows:
        what = 'TAKE-P2 honest case: 舞台 sample -> 不确定，请选择 -> tap 舞台 (never saved)' if name == 'P-06' else 'TAKE-P3 spare: 成员音乐话题 晚班列车 / 纸灯乐队 -> posted card'
        y = section(sheet, y, f'{name}.mp4 · {tj["rec"]["frames"]} f · {tj["rec"]["seconds"]} s · {what}', MINT if name == 'P-06' else YEL)
        y = place_row(sheet, y, tiles)
    y = section(sheet, y, 'die-cuts (alpha shown over a checker) + polaroids, phone DPR 2.769', PINK)
    y = place_row(sheet, y, cut_tiles)
    y = section(sheet, y, 'avatar stickers: product SVGs rasterised 960x2000 with alpha (same scale and baseline)', MINT)
    y = place_row(sheet, y, av_tiles, gap=14)
    y = section(sheet, y, 'full stills and product exports', YEL)
    y = place_row(sheet, y, st)
    sheet = sheet.crop((0, 0, W, y + 20))
    sheet.save(out, optimize=True)
    print(out, sheet.size)

main(sys.argv[1] if len(sys.argv) > 1 else f'{ROOT}/contact-sheet.png')
