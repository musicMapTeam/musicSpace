#!/usr/bin/env python3
"""Builds manifest.json for the P2/P3 capture pass: clips (timeline, QC, encode) and every asset (file, size, alpha, notes)."""
import hashlib, json, os, subprocess
import numpy as np
from PIL import Image

ROOT = '/tmp/space-video-doodle/prod/capture/P2P3'
rel = lambda p: os.path.relpath(p, ROOT)
sha = lambda p: hashlib.sha256(open(p, 'rb').read()).hexdigest()

def img_info(p):
    if p.endswith('.svg'):
        return {'file': rel(p), 'viewBox': '0 0 240 500', 'bytes': os.path.getsize(p), 'sha256': sha(p), 'vector': True}
    im = Image.open(p)
    info = {'file': rel(p), 'size': list(im.size), 'bytes': os.path.getsize(p), 'sha256': sha(p)}
    a = np.asarray(im.convert('RGBA'))[..., 3]
    info['alpha'] = bool((a < 255).any())
    if info['alpha']:
        info['alphaShare'] = {'transparent': round(float((a == 0).mean()), 3), 'opaque': round(float((a == 255).mean()), 3)}
    return info

checks = {}
for l in open(f'{ROOT}/logs/alpha_check.jsonl'):
    d = json.loads(l); checks[os.path.basename(d['file'])] = d

assets = {}
# ---- die-cuts / stills / exports from the phone worlds and the desktop world
for jf, world in [('stills-phone.json', 'phone world S1: fresh, walked like TAKE-P1 (upload, wall, exchange, greet, chat, chat room, World Cup, corner, recap)'),
                  ('stills-unsure.json', 'phone world S3: fresh, 舞台 sample opened, never saved (TAKE-P2 state)'),
                  ('desk-stills.json', 'desktop world D: fresh, CSS 1440x810 @ 8/3')]:
    data = json.load(open(f'{ROOT}/logs/{jf}'))
    for it in data['items']:
        e = {'world': world, 'storyboard': it.get('storyboard', ''), 'notes': it.get('note', '')}
        f = it['files']
        if 'alpha' in f:
            e.update(img_info(f['alpha']))
            e['kind'] = 'die-cut (alpha) + opaque twin'
            if 'opaque' in f:
                e['opaqueTwin'] = img_info(f['opaque'])
            c = checks.get(os.path.basename(f['alpha']))
            if c:
                e['verify'] = {'vsOpaqueTwin_blurredDiff_p99': c.get('blurredDiff', {}).get('p99'), 'note': 're-rendered alone; same pixels up to sub-pixel anti-aliasing (twin may also show overlapping neighbours)'}
        elif 'opaque' in f:
            e.update(img_info(f['opaque'])); e['kind'] = 'region still (opaque)'
        elif 'full' in f:
            e.update(img_info(f['full'])); e['kind'] = 'full-screen still'
        if 'clipCss' in it:
            c = it['clipCss']; e['clipCss'] = {k: round(c[k], 1) for k in ('x', 'y', 'width', 'height')}
            e['selectors'] = it.get('sels')
        fid = os.path.basename(e.get('file', '')).split('_')[0]          # id = file prefix (CUT-04a, POL-03, EXCH-01, CORNER-02 ...)
        if it['id'] == 'CUT-02s': e['verify']['note'] = 'the opaque twin also shows the angle switch and the 试穿中 sticker overlapping the orbit/hair; the cut is the figure + orbit alone'
        assets[fid or it['id']] = e

sp = json.load(open(f'{ROOT}/logs/stills-phone.json'))
mc = f'{ROOT}/exports/CUT-08_memory-card.png'
assets['CUT-08'] = {**img_info(mc), 'kind': 'product export (download)', 'storyboard': 'H1, S9 (the real PNG that flies out of the phone)',
                    'notes': f"downloaded by the product itself from 回看这一晚 -> 保存我的纪念卡 -> photo + avatar + confirm -> 下载纪念卡 PNG; suggested name {sp['extra']['memoryCard']['suggested']}; "
                             "visitor 阿宁 in 失真, your 人海 photo, 保存于 2026.10.07 (clock 22:40 +08:00); opaque: the product draws the card on its own dotted paper",
                    'world': 'phone world S1'}
demo = {f['path']: f['sha256'] for f in json.load(open('/tmp/space-publish/dist-pages/build.json'))['files']}
for f, n in [('sample-crowd.jpg', 'yours: 人海 · 示例照片, fictional EXIF time 21:48:10'), ('yao-stage.jpg', '阿遥·示例 stage photo on the wall (21:47:20)'), ('sample-stage.jpg', '舞台 · 示例照片 used in P-06, fictional EXIF time 21:47:50')]:
    p = f'{ROOT}/exports/CUT-09/{f}'
    i = img_info(p)
    assets[f'CUT-09/{f}'] = {**i, 'kind': 'build file (copied, unmodified)', 'storyboard': 'M1 collision polaroids', 'notes': n + '; AI-generated example image (label 照片为 AI 生成的示例图 on screen)',
                             'matchesBuildJson': i['sha256'] == demo.get(f'demo/{f}')}

# ---- avatars
av = json.load(open(f'{ROOT}/logs/avatars.json'))
names = {'yao': '阿遥·示例', 'man': '小满·示例', 'bei': '北屿·示例', 'lin': '林间·示例'}
for k, nm in names.items():
    for a in ['front', 'side', 'back', 'quarter']:
        png, svg = f'{ROOT}/avatars/png/cast-{k}-{a}.png', f'{ROOT}/avatars/svg/cast-{k}-{a}.svg'
        note = (f'{nm}, {a} view. ' + ('Rebuilt in the product wardrobe from her definition in the build (preset 脉冲 + skin 0, neutral, no accessory, pose listen); '
                'the same rebuild gives identical drawings for 阿遥/小满/北屿 (same SVG geometry as the chat room, pixel-identical rasters), so this is her exact look (she never posts, so no 2D avatar of her appears in the product DOM; she is only drawn in the 3D room)'
                if k == 'lin' else f'Rebuilt in the product wardrobe from the definition in the build; quarter view verified identical to the chat-room drawing ({av["validation"].get(k)})'))
        assets[f'AV-{k}-{a}'] = {**img_info(png), 'svg': img_info(svg), 'kind': 'avatar sticker (product SVG rasterised 4x, alpha)', 'storyboard': 'P3, W4, C1 (CUT-10)', 'notes': note + '. 960x2000 canvas = the SVG viewBox 240x500 at 4x: all avatars share scale and baseline (do not trim).'}
    if k != 'lin':
        p = f'{ROOT}/avatars/png/cast-{k}-quarter.chatroom.png'
        assets[f'AV-{k}-quarter-chatroom'] = {**img_info(p), 'svg': img_info(p.replace('/png/', '/svg/').replace('.png', '.svg')), 'kind': 'avatar sticker (reference)', 'storyboard': 'CUT-10',
                                             'notes': f'{nm} exactly as the product draws it in the after-show chat room (quarter view); pixel-identical to AV-{k}-quarter'}
for a in ['front', 'side', 'back', 'quarter']:
    png, svg = f'{ROOT}/avatars/png/visitor-aning-shizhen-{a}.png', f'{ROOT}/avatars/svg/visitor-aning-shizhen-{a}.svg'
    assets[f'AV-aning-{a}'] = {**img_info(png), 'svg': img_info(svg), 'kind': 'avatar sticker (product SVG rasterised 4x, alpha)', 'storyboard': 'P3, W4, C1, H1 (CUT-02 alt)',
                               'notes': f'visitor 阿宁, look 失真 (preset 4; skin 0, neutral, pose listen from the rig seed 20261009, identical in every world of this pass and in the clips), {a} view, exported from the wardrobe stand; 960x2000, shared baseline'}

# ---- clips
clips = {}
for name, sb, take in [('P-06', 'A3 (33:3 -> 35:1); SHOTS TAKE-P2', 'TAKE-P2'), ('P-21', 'elastic +4 (2 bars after bar 60): 成员音乐话题; SHOTS TAKE-P3', 'TAKE-P3')]:
    tj = json.load(open(f'{ROOT}/clips/{name}.take.json'))
    qc = json.load(open(f'{ROOT}/review/{name}.qc.json'))
    p = f'{ROOT}/clips/{name}.mp4'
    clips[name] = {
        'file': rel(p), 'bytes': os.path.getsize(p), 'sha256': sha(p), 'take': take, 'storyboard': sb,
        'video': f"{qc['codec']} {qc['size']} {qc['fps']} fps {qc['pix_fmt']} {qc['colour']}, x264 CRF 15 preset slow tune animation, no audio",
        'frames': tj['rec']['frames'], 'duration_s': tj['rec']['seconds'], 'clock': tj['clock'], 'beatGrid': f"{tj['workBpm']} BPM = {tj['beatFrames']} frames per beat",
        'timeline': [{k: v for k, v in e.items() if k in ('label', 'frame', 't', 'down', 'up')} for e in sorted(tj['timeline'], key=lambda e: e['frame'])],
        'qc': {'stutter_dupInsideMotion': qc['stutter_dupInsideMotion'], 'blankFrames': qc['blankFrames'], 'holds_over_0.5s': qc['holds_over_0.5s'], 'motionSegments': qc['motionSegments_over_4f'],
               'note': 'holds are the product standing still (static within H.264 noise): safe to trim or extend for another tempo'},
        'perFrameState': rel(f'{ROOT}/clips/{name}.take.json') + ' (probeRuns) and ' + rel(f'{ROOT}/clips/{name}.rec.json') + ' (frame hashes, per-frame probe)',
    }
clips['P-06']['notes'] = [
    'fresh example world, visitor 阿宁 in 失真, never saved (sheet closed with ×, checked: no photo saved)',
    'the build answers 「不确定，请选择」 (dashed tag) with 舞台 and 人海 as dashed suggestions, nothing selected, as in SHOTS.md; after the tap the AI line is removed by the product and 舞台 turns yellow with a check',
    'the AI runs in real time (~0.17 s) while the rig steps virtual time, so the thinking state lasts 1 frame (f120, below the fold); the chips and the AI line come into view with the product\'s own jump-scroll when the sheet animation ends (f134 = sync point 33:4)',
    'the doodle tap ring (rig, 0.48 s) stays where the finger touched: f117-f146 it sits over the newly opened form (near the 舞台 chip)',
]
clips['P-21']['notes'] = [
    'fresh example world (P1-like: 阿宁 in 失真, entered, waited 9.5 s, route skipped, joined the after-show chat room in real time, not recorded)',
    'the chat room\'s action row was pre-scrolled so 「成员音乐话题」 is first and the 「Music Map · 沿音乐探索 ↗」 chip is off-screen; the topics panel copy itself mentions Music Map (product text: 「四张留档关系卡是通往独立 Music Map 的小桥…」), and the header button 「音乐探索」 is on every phone screen',
    'text caret hidden (caret-color: transparent; Chrome blinks it on real time, which frame-stepping turns into flicker), same as TAKE-P1',
    'f60-f118 the half-height topics sheet leaves an empty dotted gap under the 3D header (real layout); b2 opens the form and the sheet goes full height in one frame',
    'the ring of the 发布音乐话题 tap stays over the reset 音乐名称 field after the card appears (ring f408-f437)',
]

manifest = {
    'what': 'Music Space doodle video, capture pass P2/P3: TAKE-P2 (P-06, the honest AI case), TAKE-P3 (P-21, spare 成员音乐话题) and SHOTS.md §5 cut-outs and exports',
    'build': {'dir': '/tmp/space-publish/dist-pages', 'commit': '8fa52f0', 'version': '0.22.0-rc.1', 'served': 'node scripts/pages/serve-prefix.mjs <dist> /musicSpace/ 48311 (root path, not /preview/)'},
    'rig': '/tmp/space-video-doodle/capture-test/rec2.mjs (read-only): Chrome headless --use-angle=metal --enable-gpu, Playwright fake clock, 16 ms virtual step per frame labelled 60 fps (product motion plays at 0.96x), PNG frames -> ffmpeg; seeded Math.random 20261009; plus tools/lib.mjs freezeKeep() (existing animations keep their time at freeze, finished ones are not replayed)',
    'clock': '2026-10-07T22:40:00+08:00 (same as TAKE-P1 and the desktop takes; chat times read 22:40, memory card 保存于 2026.10.07)',
    'phone': '390x845 CSS @ 36/13 = 1080x2340', 'desktop': '1440x810 CSS @ 8/3 = 3840x2160',
    'honesty': ['real product states only: real taps/typing, no injected product DOM, no edited storage; the only page-level CSS added are the rig tap ring, the hidden text caret (P-21) and, for die-cut stills only, a temporary style that hides every box except the target (removed right after the shot)',
                'cast labelled 示例 in every room shot; sample photos are AI-generated examples (keep 照片为 AI 生成的示例图 on screen); albums are 原创虚构专辑; 晚班列车 / 纸灯乐队 is the example\'s own fictional song',
                'not produced: a creation-corner co-created PNG (「生成共同纪念PNG」 needs the friend to join; the example cast never joins, the build\'s autopilot has no corner handler) -> CORNER-01/02 are stills of the real invitation state'],
    'clips': clips,
    'assets': assets,
    'contactSheet': 'contact-sheet.png',
    'review': ['review/P-06.qc.json', 'review/P-21.qc.json', 'review/avatars-lineup.png', 'logs/alpha_check.jsonl'],
    'rebuild': ['node tools/take-p2.mjs P-06', 'node tools/take-p3.mjs P-21', 'node tools/stills-phone.mjs', 'node tools/stills-unsure.mjs', 'node tools/avatars.mjs', 'node tools/desk-stills.mjs',
                'python tools/alpha_check.py --margin 12 <bases>', 'python tools/qc_clip.py clips/P-06.mp4 review/P-06.qc.json', 'python tools/contact.py contact-sheet.png', 'python tools/manifest.py'],
}
json.dump(manifest, open(f'{ROOT}/manifest.json', 'w'), ensure_ascii=False, indent=1)
print('assets', len(assets), 'clips', len(clips))
