#!/usr/bin/env python3
"""Builds manifest.json for the rc.2 re-capture of P2/P3: clips (timeline, QC, encode, DOM audits) and every asset (file, size, alpha,
visible text, notes, change vs the first pass in capture/P2P3).  Run with the project venv python (numpy, PIL)."""
import hashlib, json, os
import numpy as np
from PIL import Image

ROOT = '/tmp/space-video-doodle/prod/capture/P2P3-rc2'
OLD = '/tmp/space-video-doodle/prod/capture/P2P3'
BUILD = '/tmp/space-final/dist-pages'
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

def vs_old(p):
    """same-named file of the first pass (capture/P2P3): size then/now, byte-identical?"""
    o = os.path.join(OLD, rel(p))
    if not os.path.exists(o):
        return {'firstPass': None, 'note': 'new in rc.2 (no file of this name in capture/P2P3)'}
    out = {'firstPass': rel(p), 'identicalBytes': sha(o) == sha(p)}
    if not p.endswith('.svg') and not p.endswith('.mp4'):
        a, b = Image.open(o).size, Image.open(p).size
        out['sizeThen'], out['sizeNow'] = list(a), list(b)
        out['sameSize'] = a == b
    return out

checks = {}
for l in open(f'{ROOT}/logs/alpha_check.jsonl'):
    d = json.loads(l); checks[os.path.basename(d['file'])] = d

audits = []          # every DOM-text audit that ran before a capture
assets = {}
WORLDS = [('stills-phone.json', 'phone world S1: fresh, walked like TAKE-P1 (upload 人海那张, wall, exchange, greet 小满, private chat, chat room, World Cup, creation corner with 小满 to the keepsake PNG, recap, memory card)'),
          ('stills-unsure.json', 'phone world S3: fresh, 舞台那张 opened, never saved (TAKE-P2 state)'),
          ('desk-stills.json', 'desktop world D: fresh, CSS 1440x810 @ 8/3')]
for jf, world in WORLDS:
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
                e['verify'] = {'vsOpaqueTwin_blurredDiff_p99': (c.get('blurredDiff') or {}).get('p99'), 'trimmedTo': c.get('trimmedTo'),
                               'note': 're-rendered alone; same pixels up to sub-pixel anti-aliasing and the paper behind translucent parts (the twin may also show overlapping neighbours)'}
            e['vsFirstPass'] = vs_old(f['alpha'])
        elif 'opaque' in f:
            e.update(img_info(f['opaque'])); e['kind'] = 'region still (opaque)'; e['vsFirstPass'] = vs_old(f['opaque'])
        elif 'full' in f:
            e.update(img_info(f['full'])); e['kind'] = 'full-screen still'; e['vsFirstPass'] = vs_old(f['full'])
        if 'clipCss' in it:
            c = it['clipCss']; e['clipCss'] = {k: round(c[k], 1) for k in ('x', 'y', 'width', 'height')}
            e['selectors'] = it.get('sels')
        if it.get('regionText'):
            e['visibleText'] = it['regionText']
        if it.get('audit'):
            e['domAudit'] = {'banned(示例|虚构|本页)': it['audit'].get('banned', 0), 'watchWords': it['audit'].get('watch', []), 'chars': it['audit'].get('chars')}
            audits.append({'asset': it['id'], 'banned': it['audit'].get('banned', 0), 'watch': it['audit'].get('watch', [])})
        fid = os.path.basename(e.get('file', '')).split('_')[0]      # id = file prefix (CUT-04a, POL-03, EXCH-01, CORNER-02 ...)
        if it['id'] == 'CUT-02s':
            e['verify']['note'] = 'the opaque twin also shows the angle switch and the 试穿中 sticker overlapping the orbit/hair; the cut is the figure + orbit alone'
        assets[fid or it['id']] = e

sp = json.load(open(f'{ROOT}/logs/stills-phone.json'))
X = sp['extra']
mc = f'{ROOT}/exports/CUT-08_memory-card.png'
assets['CUT-08'] = {**img_info(mc), 'kind': 'product export (download)', 'storyboard': 'H1, S9 (the real PNG that flies out of the phone), S11',
                    'notes': f"downloaded by the product itself: 回看这一晚 -> 保存我的纪念卡 ↗ -> photo + 带上我的小人 + 确认保存到我的设备 -> 下载纪念卡 PNG; suggested name {X['memoryCard']['suggested']}; "
                             "visitor 阿宁 in 失真, your 人海那张, 「回声现场 / 月台 Livehouse」, 「摄影 / 阿宁」, 「留存 / 阿宁 · 保存于 2026.10.08 · 私人纪念」 (clock 22:40 +08:00 on 2026-10-08); opaque: the product draws the card on its own dotted paper",
                    'world': 'phone world S1', 'vsFirstPass': vs_old(mc)}
kp = f'{ROOT}/exports/CORNER-03_creation-corner-keepsake.png'
assets['CORNER-03'] = {**img_info(kp), 'kind': 'product export (download) - NEW in rc.2', 'storyboard': 'S8 (the finished 双人纪念; new possibility: the cast now joins)',
                       'notes': f"the creation corner's own keepsake, downloaded by the product: 邀请 TA，并展示我的昵称和小人 -> 发出邀请 -> 小满 joins after {X['texts'].get('cornerJoinMs')} ms (autopilot, real time) and writes 「人海这一面，手都举起来了。」 with his 人海 photo -> "
                                f"my part 「返场那首我在人海里，手都举酸了！」 + my 人海那张 (把我的小人、留言和照片给 TA, 保存我的部分) -> 我确认这一版 / 确认这一版本 -> 小满 confirms after {X['texts'].get('cornerBothConfirmMs')} ms -> 把这一版存到我的创作 -> 导出这一版 / 生成纪念图 PNG -> 下载 PNG; "
                                f"suggested name {X['cornerKeepsake']['suggested']}; 1200x1600: 「MUSIC SPACE / TWO SIDES · 同一晚，我们的另一面。」, both avatars (阿宁 失真 / 小满), both lines, both photos 「照片：阿宁」「照片：小满」, 「我们一起做的 · 第 4 版」",
                       'world': 'phone world S1', 'vsFirstPass': vs_old(kp)}
demo = {f['path']: f['sha256'] for f in json.load(open(f'{BUILD}/build.json'))['files']}
for f, n in [('sample-crowd.jpg', 'yours: 人海那张, EXIF time 21:48:10 written in the file'), ('yao-stage.jpg', '阿遥 stage photo on the wall (21:47:20)'), ('sample-stage.jpg', '舞台那张 used in P-06, EXIF time 21:47:50 written in the file')]:
    p = f'{ROOT}/exports/CUT-09/{f}'
    i = img_info(p)
    assets[f'CUT-09/{f}'] = {**i, 'kind': 'build file (copied, unmodified)', 'storyboard': 'M1 collision polaroids', 'notes': n + '; AI-generated image (disclosed once, in the end card credits line)',
                             'matchesBuildJson': i['sha256'] == demo.get(f'demo/{f}'), 'vsFirstPass': vs_old(p)}

# ---- avatars
av = json.load(open(f'{ROOT}/logs/avatars.json'))
names = {'yao': '阿遥', 'man': '小满', 'bei': '北屿', 'lin': '林间'}
for a in av.get('audits', []):
    audits.append({'asset': 'avatars (' + a.get('at', '') + ')', 'banned': len(a.get('banned', [])), 'watch': a.get('watch', [])})
for k, nm in names.items():
    for a in ['front', 'side', 'back', 'quarter']:
        png, svg = f'{ROOT}/avatars/png/cast-{k}-{a}.png', f'{ROOT}/avatars/svg/cast-{k}-{a}.svg'
        note = (f'{nm}, {a} view. ' + ('Rebuilt in the product wardrobe from her definition in the build (preset 脉冲 + skin 0, neutral, no accessory, pose listen); '
                'the same rebuild gives identical drawings for 阿遥/小满/北屿 (same SVG geometry as the chat room), so this is her exact look (she never posts, so no 2D avatar of her appears in the product DOM; she is only drawn in the 3D room)'
                if k == 'lin' else f'Rebuilt in the product wardrobe from the definition in the build; quarter view verified identical to the chat-room drawing ({av["validation"].get(k)})'))
        assets[f'AV-{k}-{a}'] = {**img_info(png), 'svg': img_info(svg), 'kind': 'avatar sticker (product SVG rasterised 4x, alpha)', 'storyboard': 'P3, W4, C1, A5 55:2, A6 76:3 (CUT-10)',
                                 'notes': note + '. 960x2000 canvas = the SVG viewBox 240x500 at 4x: all avatars share scale and baseline (do not trim).', 'vsFirstPass': vs_old(png)}
    if k != 'lin':
        p = f'{ROOT}/avatars/png/cast-{k}-quarter.chatroom.png'
        assets[f'AV-{k}-quarter-chatroom'] = {**img_info(p), 'svg': img_info(p.replace('/png/', '/svg/').replace('.png', '.svg')), 'kind': 'avatar sticker (reference)', 'storyboard': 'CUT-10',
                                             'notes': f'{nm} exactly as the product draws it in the after-show chat room (quarter view); identical geometry to AV-{k}-quarter (rc.2 changed only the SVG title/aria-label 插画分身 -> 小人)', 'vsFirstPass': vs_old(p)}
for a in ['front', 'side', 'back', 'quarter']:
    png, svg = f'{ROOT}/avatars/png/visitor-aning-shizhen-{a}.png', f'{ROOT}/avatars/svg/visitor-aning-shizhen-{a}.svg'
    assets[f'AV-aning-{a}'] = {**img_info(png), 'svg': img_info(svg), 'kind': 'avatar sticker (product SVG rasterised 4x, alpha)', 'storyboard': 'P3, W4, C1, H1, A5 55:2 (CUT-02 alt)',
                               'notes': f'visitor 阿宁, look 失真 (preset 4; skin 0, neutral, pose listen from the rig seed 20261009, identical in every world of this pass and in the clips), {a} view, exported from the wardrobe stand; 960x2000, shared baseline', 'vsFirstPass': vs_old(png)}

# ---- clips
clips = {}
for name, sb, take in [('P-06', 'A3 (33:3 -> 35:1); SHOTS TAKE-P2', 'TAKE-P2 (rc.2)'), ('P-21', 'elastic +4 (2 bars after bar 60): 音乐话题; SHOTS TAKE-P3', 'TAKE-P3 (rc.2)'), ('P-22', 'S8 spare (new): 双人纪念 from the invitation to the finished keepsake', 'TAKE-P4 corner keepsake (rc.2, new)')]:
    tj = json.load(open(f'{ROOT}/clips/{name}.take.json'))
    qc = json.load(open(f'{ROOT}/review/{name}.qc.json'))
    p = f'{ROOT}/clips/{name}.mp4'
    for a in tj.get('audits', []):
        audits.append({'asset': f"{name} ({a['label']})", 'banned': len(a['banned']), 'watch': a['watch']})
    clips[name] = {
        'file': rel(p), 'bytes': os.path.getsize(p), 'sha256': sha(p), 'take': take, 'storyboard': sb,
        'video': f"{qc['codec']} {qc['size']} {qc['fps']} fps {qc['pix_fmt']} {qc['colour']}, x264 CRF 15 preset slow tune animation, no audio",
        'frames': tj['rec']['frames'], 'duration_s': tj['rec']['seconds'], 'clock': tj['clock'], 'build': tj.get('build'), 'beatGrid': f"{tj['workBpm']} BPM = {tj['beatFrames']} frames per beat",
        'timeline': [{k: v for k, v in e.items() if k in ('label', 'frame', 't', 'down', 'up')} for e in sorted(tj['timeline'], key=lambda e: e['frame'])],
        'qc': {'stutter_dupInsideMotion': qc['stutter_dupInsideMotion'], 'blankFrames': qc['blankFrames'], 'holds_over_0.5s': qc['holds_over_0.5s'], 'motionSegments': qc['motionSegments_over_4f'],
               'note': 'holds are the product standing still (static within H.264 noise, the 7 Hz line boil keeps stepping): safe to trim or extend for another tempo'},
        'domAudits': tj.get('audits'),
        'perFrameState': rel(f'{ROOT}/clips/{name}.take.json') + ' (probeRuns) and ' + rel(f'{ROOT}/clips/{name}.rec.json') + ' (frame hashes, per-frame probe)',
        'vsFirstPass': vs_old(p),
    }
clips['P-06']['notes'] = [
    'fresh world, visitor 阿宁 in 失真, never saved (sheet closed with ×, checked: no photo saved)',
    'room: 「月台 Livehouse / 回声现场 / 5 位已加入 · 正在进行」, labels 阿遥 · 可招呼 / 小满 · 可招呼 / 北屿 · 可招呼 / 阿宁 · 我, onboarding card 「第一次来 1/4 · 放一张今晚的照片」 with 人海那张 / 舞台那张 / 用我自己的照片 / 跳过路线',
    'the build answers 「不确定，请选择」 (dashed tag; line 「不确定，请选择，AI 认为更可能是舞台或人海」) with 舞台 and 人海 as dashed suggestions, nothing selected; after the tap the AI line is removed by the product and 舞台 turns yellow with a check',
    'timeline identical to the first pass (tap 舞台那张 f120, AI line on screen f134 = sync point 33:4, tap 舞台 f222 = 3 beats later, end f326): the act A2-A3 timing (fromAt(134, 33:4)) still fits',
    'rc.2 copy in frame: the hint under the chips reads 「配对时用它找另一面，你说了算。」 (the first pass showed 「…AI 在本机判断，照片不上传…」 here); the time row has no sample note any more, so the form is shorter',
    'the AI runs in real time (~0.2 s) while the rig steps virtual time, so the thinking state lasts 2 frames (f120-121, below the fold); the chips and the AI line come into view with the product\'s own jump-scroll when the sheet animation ends (f134)',
    'the doodle tap ring (rig, 0.48 s) stays where the finger touched: f117-f146 it sits over the newly opened form (near the 舞台 chip)',
]
clips['P-21']['notes'] = [
    'fresh world (P1-like: 阿宁 in 失真, entered, waited 9.5 s, onboarding skipped, joined the after-show chat room in real time, not recorded)',
    'the chat room\'s action row is left as the product lays it out (「音乐探索 ↗ · 一起玩 · 音乐话题 · 专辑世界杯」; the first pass scrolled it to hide the Music Map chip, which is now the product\'s own 音乐探索)',
    'content changed on purpose: 音乐名称 晚班列车 (the room\'s own soundscape 「这一晚 · 晚班列车 / 本场原创声景」), 音乐人（可留空） left empty, note 「返场前那段鼓点，你们是不是也在跟着拍手？」 - the first pass typed 纸灯乐队 as the artist, which in the build is the artist of a different card (World Cup 「午夜站台」), i.e. an invented fact',
    'beat plan: b0 tap 音乐话题 (f60), b2 留下我的音乐话题 (f119), b4 晚班列车 on 16ths (f177-f206), b6 note on 32nds (f236-f309), b9 tick 发到聊天室 (f323), b10 发布 (f353 = card on screen), hold to b14 (f470); the first pass had an extra artist step (b6) and ended at b16',
    'posted card: 「成员自填 / 晚班列车 / 返场前那段鼓点，你们是不是也在跟着拍手？ / 阿宁 留下的话题 / 带回聊天室聊 · 撤回这个话题」, status line 「已确认。」 above it',
    'text caret hidden (caret-color: transparent; Chrome blinks it on real time, which frame-stepping turns into flicker), same as TAKE-P1',
    'f60-f118 the half-height topics sheet leaves an empty dotted gap under the 3D header (real layout, as in the first pass); b2 opens the form and the sheet goes full height in one frame (f119)',
    'the ring of the 发布 tap stays over the reset 音乐人 field after the card appears (f350-f379)',
]

clips['P-22']['notes'] = [
    'NEW in rc.2 (the cast now joins 双人纪念). Fresh world, real-time setup not recorded: 阿宁 in 失真 enters, waits 9.5 s, 人海那张 -> 保存这张照片, 同场的人 -> 小满 -> 向 小满 招个手 -> 你们已经是朋友了; recorded from the friend card over the 3D close-up of 小满',
    'marks: f60 tap 邀请共同创作 (sheet slides up f60-f73) · f119 tick 邀请 TA，并展示我的昵称和小人 · f148 发出邀请 -> 「已确认。」 「等 TA 加入。」 · f460 小满 joins (autopilot, 312 frames = 5.2 s virtual, recorded in full): the sheet goes full height with 「MUSIC SPACE / TWO SIDES · 同一晚，我们的另一面。」, 阿宁 · 这一晚，我在这里。 / 小满 · 人海这一面，手都举起来了。 + his photo · f528-f556 scroll to the whole card · f645-f673 scroll to 我们的共同草稿 · f704 tap 我的一句话, f708-f762 「返场那首我在人海里，手都举酸了！」 on 32nds · f792 我的照片 -> 我的照片 1 · 已上墙 · f821 tick 把我的小人、留言和照片给 TA · f850 保存我的部分 -> 版本 4 (card shows my line + my photo) · f880-f908 scroll to the card · f997-f1025 scroll to 我确认这一版 · f1055 tick, f1084 确认这一版本 -> 你已确认 · 对方未确认 · f1396 小满 confirms (312 frames, recorded in full) · f1436-f1464 scroll · f1494 tick 把这一版存到我的创作, f1523 保存到我的创作 -> 「已保存到我的创作。」 · f1553-f1581 scroll · f1611 tick 导出这一版, f1640 生成纪念图 PNG -> f1641 「纪念图做好了。」 + the keepsake preview · f1670-f1698 scroll to the preview · hold to f1816',
    'the keepsake on screen is byte-identical to exports/CORNER-03_creation-corner-keepsake.png (downloaded after the recording in the same world, sha256 compared)',
    'the product orders the two sides per world (random ids); the take was re-run until 阿宁 was listed first (attempt 2), matching CORNER-03..06',
    'my photo is chosen in a native <select>: set the way the picker does it (value + input/change events) because the native picker is not drawn headless; everything else is real taps and typing',
    'scroll jumps at f850 (-> 366), f1084 (-> 505) and f1523 (-> 844) are the product re-rendering the sheet (same numbers in a real-time check); my scrolls are eased with whole-pixel steps (no repeated frame inside a scroll)',
    'capture artefact avoided: only under frame-stepped capture, typing into 我的一句话 while the sheet sits at scrollTop 610 made Chrome jump the sheet 89 px per key (never in real time); the form is placed 70 px lower so it does not happen. Also only under capture, ~3 s after 「纪念图做好了。」 the sheet jumps back up (not seen in real time): the take ends before it',
    'QC: one flagged static run f54-f56 is the 7 Hz line boil step followed by the tap ring (no motion stalls); waits are long holds (5.2 s twice) for the editor to cut',
]

manifest = {
    'what': 'Music Space doodle video, capture pass P2/P3 re-shot on 0.22.0-rc.2 (owner copy revision 2026-10-07: no demo/explanatory copy, Livehouse framing, Doodle 音乐探索): TAKE-P2 (P-06, the honest AI case), TAKE-P3 (P-21, spare 音乐话题) and every RELEASE-NOTES §5 cut-out/export, with the same asset ids as capture/P2P3, plus new: the creation-corner keepsake (CORNER-03 PNG, CORNER-04..06) and TAKE-P4 (P-22, spare footage of 双人纪念 from invitation to keepsake)',
    'build': {'dir': BUILD, 'version': '0.22.0-rc.2', 'commit': '8fa52f0 (HEAD; working tree with the copy revision)', 'builtAt': '2026-10-07T20:18:33Z',
              'served': 'cd /Users/alakazan/workplace/tme/musicSpace && node scripts/pages/serve-prefix.mjs /tmp/space-final/dist-pages /musicSpace/ 48741 (root path, not /preview/)',
              'builtPageCheck': 'index.html: 示例 0, 虚构 0, 本页 0 occurrences (演示 1 and 自动回复 1 = the one About sentence, never filmed here)'},
    'rig': '/tmp/space-video-doodle/capture-test/rec2.mjs (read-only): Chrome headless --use-angle=metal --enable-gpu, Playwright fake clock, 16 ms virtual step per frame labelled 60 fps (product motion plays at 0.96x), lossless PNG frames -> ffmpeg x264 CRF 15 yuv420p BT.709 tv range 60 fps CFR; seeded Math.random 20261009; plus tools/lib.mjs freezeKeep() (existing animations keep their time at freeze, finished ones are not replayed)',
    'clock': '2026-10-08T22:40:00+08:00 (first pass: 2026-10-07 22:40). rc.2 was built 2026-10-08 04:18 +08:00 and the static runtime never lets its clock run earlier than the build, so the old clock would have read 04:18; same time of day one evening later. Chat times read 22:40, the memory card 保存于 2026.10.08. TAKE-P1 rc2 and the desktop rc2 rig use the same clock; TAKE-H keeps its own Friday 2026-10-09.',
    'phone': '390x845 CSS @ 36/13 = 1080x2340', 'desktop': '1440x810 CSS @ 8/3 = 3840x2160',
    'domAudit': {'rule': 'before every recording / still: document.body.innerText + visible aria-label/title/alt/placeholder searched for 示例|虚构|本页 (abort if found) and for softer words 演示|自动回复|不是真人|模拟|未核实|规则判断|不是 AI|在本页运行|没有服务器|只存在这个浏览器 (logged)',
                 'runs': len(audits), 'bannedHits': sum(a['banned'] for a in audits), 'watchHits': sum(len(a['watch']) for a in audits), 'list': audits},
    'honesty': ['real product states only: real taps/typing, no injected product DOM, no edited storage; the only page-level CSS added are the rig tap ring, the hidden text caret (P-21) and, for die-cut stills only, a temporary style that hides every box except the target (removed right after the shot)',
                'rc.2 shows no 示例/虚构 labels anywhere in what was filmed; the cast (阿遥, 小满, 北屿, 林间) and the photos are fictional/AI-generated - said once in the film\'s end-card credits line; albums are 「原创专辑卡」; 晚班列车 is the room\'s own original soundscape (本场原创声景)',
                'no real singer appears in any asset of this pass',
                'NEW: the creation-corner keepsake is a real export now (rc.2 autopilot: 小满 joins, writes his side, confirms the same version) -> CORNER-03 is the product\'s own PNG, CORNER-04/05/06 the real UI states'],
    'clips': clips,
    'assets': assets,
    'contactSheet': 'contact-sheet.png',
    'review': ['review/P-06.qc.json', 'review/P-21.qc.json', 'review/P-22.qc.json', 'review/P-06-frames.png', 'review/P-21-frames.png', 'review/P-21-detail.png', 'review/P-22-frames.png', 'review/P-22-join.png', 'review/stills-phone-fulls.png', 'review/desk-stills.png', 'logs/alpha_check.jsonl'],
    'rebuild': ['node tools/take-p2.mjs P-06', 'node tools/take-p3.mjs P-21', 'tools/run-corner.sh (P-22: WANT_FIRST=阿宁 node tools/take-corner.mjs P-22, retried on side order)', 'node tools/stills-phone.mjs', 'node tools/stills-unsure.mjs', 'node tools/avatars.mjs', 'node tools/desk-stills.mjs',
                'PY tools/alpha_check.py --margin 12 <bases>', 'PY tools/qc_clip.py clips/P-06.mp4 review/P-06.qc.json', 'PY tools/contact.py contact-sheet.png', 'PY tools/manifest.py',
                '(PY = /tmp/space-video-doodle/music-cc0/tools/venv-ana/bin/python; server on 48741 as above, or SPACE_BASE=...; clock CLOCK_START=...)'],
}
json.dump(manifest, open(f'{ROOT}/manifest.json', 'w'), ensure_ascii=False, indent=1)
print('assets', len(assets), 'clips', len(clips), 'audits', len(audits), 'banned', manifest['domAudit']['bannedHits'], 'watch', manifest['domAudit']['watchHits'])
