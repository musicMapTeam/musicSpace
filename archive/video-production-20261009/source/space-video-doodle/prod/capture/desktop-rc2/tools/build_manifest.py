#!/usr/bin/env python3
"""Collect the rig's rec.json files + qc/*.qc.json into prod/capture/desktop-rc2/manifest.json (action timestamps, element boxes, files,
QC, visible-text audits) for the rc2 re-capture, in the same shape as ../desktop/manifest.json (rc1), plus per-clip differences against
the rc1 manifest (timing and measured boxes), so the scenes that address footage by source pixels know what moved."""
import json, os, hashlib

ROOT = '/tmp/space-video-doodle/prod/capture/desktop-rc2'
RC1 = '/tmp/space-video-doodle/prod/capture/desktop/manifest.json'
BUILD = '/tmp/space-final/dist-pages/build.json'
ORDER = ['D-01-landing', 'D-02-room-hero', 'D-03a-wall-before', 'D-03s-wall-save', 'D-03b-wall-after', 'D-04-linjian-quiet', 'D-05-exchange', 'D-06-greet-chat']
STILLS = {
    'D-01-landing.png': 'D-01 first frame: the landing page, clean (H2 -> H3 match cut reference; title boxes in D-01 marks)',
    'CUT-01-room-overview.png': 'CUT-01 (H1 collage, S11): the 3D room overview, all five present, route card skipped',
    'D-03a-wall-4-photos.png': 'D-03a: 3D photo wall with the cast\'s four photos',
    'D-03s-saved-wall-panel.png': 'D-03s: after saving 「人海那张」: wall panel (21:47 同一刻, 3 分钟内拍下, the pink badge) beside the re-framed 3D wall',
    'CUT-03-wall-5-photos.png': 'CUT-03 (H1 collage): 3D photo wall with five photos (yours included)',
    'D-04-linjian-card.png': 'D-04 last frame: 林间 close-up + her card 「TA 选择安静参与，不接新招呼。」',
    'D-05-exchange-accepted.png': 'D-05: 「交换已接受」 with both polaroids (desktop)',
    'D-06-chat-reply.png': 'D-06 last frame: ONE TO ONE chat with your line and the reply 「今晚的返场太好听了。」',
}
PATTERN = '示例|虚构|本页|演示|自动回复|不是真人|没有服务器|只存在这个浏览器|模拟|本地体验版|在线访问|等待本人回应'


def sha(path, n=1 << 20):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        while True:
            b = f.read(n)
            if not b: break
            h.update(b)
    return h.hexdigest()


def box_diff(old_marks, new_marks, tol=4):
    """per mark label (matched by order of occurrence) and box name: rc1 box -> rc2 box when any edge moved more than tol master px;
    boxes that exist on one side only are listed as added / removed"""
    out, seen, om = [], {}, {}
    for m in old_marks:
        k = m['label']; seen[k] = seen.get(k, 0) + 1; om[(k, seen[k])] = m
    seen = {}
    for m in new_marks:
        k = m['label']; seen[k] = seen.get(k, 0) + 1; o = om.get((k, seen[k]))
        if o is None: out.append(dict(mark=k, change='mark not in rc1')); continue
        if o.get('frame') != m.get('frame'): out.append(dict(mark=k, change='frame', rc1=o.get('frame'), rc2=m.get('frame')))
        ob, nb = o.get('boxes_master_px') or {}, m.get('boxes_master_px') or {}
        for name in sorted(set(ob) | set(nb)):
            a, b = ob.get(name), nb.get(name)
            if a is None and b is None: continue
            if name not in ob: out.append(dict(mark=k, box=name, change='added', rc2=b)); continue
            if name not in nb: out.append(dict(mark=k, box=name, change='removed (element no longer in the product)', rc1=a)); continue
            if a is None or b is None: out.append(dict(mark=k, box=name, change='missing on one side', rc1=a, rc2=b)); continue
            if max(abs(a[0] - b[0]), abs(a[1] - b[1]), abs(a[0] + a[2] - b[0] - b[2]), abs(a[1] + a[3] - b[1] - b[3])) > tol:
                out.append(dict(mark=k, box=name, change='moved/resized', rc1=a, rc2=b))
        op, np_ = o.get('people_master_px') or [], m.get('people_master_px') or []
        for a, b in zip(op, np_):
            if max(abs(u - v) for u, v in zip(a['label'], b['label'])) > tol:
                out.append(dict(mark=k, person=b['name'], change='label moved/resized', rc1=a['label'], rc2=b['label']))
    return out


def main():
    build = json.load(open(BUILD))
    rc1 = {c['id']: c for c in json.load(open(RC1))['clips']} if os.path.exists(RC1) else {}
    clips = []
    for cid in ORDER:
        rp = f'{ROOT}/master/{cid}.rec.json'
        if not os.path.exists(rp): continue
        r = json.load(open(rp)); q = json.load(open(f'{ROOT}/qc/{cid}.qc.json')) if os.path.exists(f'{ROOT}/qc/{cid}.qc.json') else {}
        taps = [dict(t=round(e['t'], 3), frame=e.get('frame'), dom_click_frame=(e.get('frame') or 0) + 3, label=e.get('label'), xy_master=[e.get('x'), e.get('y')]) for e in r['events'] if e.get('type') == 'tap']
        presses = [dict(t=round(e['t'], 3), frame=e.get('frame'), label=e.get('label'), selector=e.get('selector')) for e in r['events'] if str(e.get('type', '')).startswith('press')]
        marks = []
        for m in r['marks']:
            mm = {k: v for k, v in m.items() if k not in ('boxes', 'people')}
            if m.get('boxes'): mm['boxes_master_px'] = {k: v for k, v in m['boxes'].items()}
            if m.get('people'): mm['people_master_px'] = m['people']
            marks.append(mm)
        c = dict(id=cid, take=r.get('take'), storyboard=r.get('storyboard'), what=r.get('what'),
                 files=dict(master=r['file'], edit=r['edit'], rec=rp, qc=f'{ROOT}/qc/{cid}.qc.json'),
                 frames=r['frames'], seconds=r['seconds'], duration_tc=f"{int(r['seconds'] // 60)}:{r['seconds'] % 60:06.3f}",
                 bytes=dict(master=r['bytes'], edit=r['editBytes']), sha256=dict(master=sha(r['file']), edit=sha(r['edit'])),
                 marks=marks, taps=taps, presses_without_ring=presses)
        if r.get('grid'): c['beat_grid'] = r['grid']
        if cid == 'D-02-room-hero' and os.path.exists(f'{ROOT}/tools/figures.json'):
            fj = json.load(open(f'{ROOT}/tools/figures.json'))
            c['figures_overview_master_px'] = dict(valid_for='every overview hold (D-02 0-8 s, 15-17 s, 24-26 s; D-04 0-1 s): the overview camera is the same position in all of them (rig camera probe)',
                                                   method=fj['source'] + '; overlay boxes masked out, split by label column; accurate to about 10 master px',
                                                   people=[dict(name=x['name'], figure=x['figure'], label=x.get('label')) for x in fj['people']])
        if r.get('warp'): c['camera_glide_speed'] = f"product camera moves recorded at rAF warp {r['warp']} (half speed)"
        ta, tb = r.get('textAudit') or {}, r.get('auditBefore') or {}
        c['text_audit'] = dict(pattern=PATTERN,
                               before_first_frame=('clean' if not tb.get('hits') else tb['hits']) + f" ({tb.get('chars')} characters of visible text)",
                               while_recording=f"{ta.get('runs')} checks (every {ta.get('every')} frames): " + ('clean' if not ta.get('hits') else json.dumps(ta['hits'], ensure_ascii=False)))
        if q:
            c['qc'] = dict(master=q['master']['video'] + ' ' + q['master']['colour'] + f" {q['master']['bitrate_mbps']} Mb/s", edit=q['edit']['video'] + ' ' + q['edit']['colour'] + f" {q['edit']['bitrate_mbps']} Mb/s",
                           audio_streams=q['master']['audio_streams'], frames_master=q['master_frames'], frames_edit=q['frames_decoded'], same_frame_count=q['master_edit_same_frame_count'],
                           longest_still=q['longest_still'], still_over_1s=q['still_over_1s'], stutters=q['stutters']['count'], camera_glides=q['camera_glides'],
                           change_gap_histogram=q['change_gap_histogram'], capture_ms_per_frame=r.get('msPerFrame'), wall_s_per_video_s=r.get('wallPerVideoSecond'))
        if cid in rc1:
            o = rc1[cid]
            c['vs_rc1'] = dict(frames=dict(rc1=o['frames'], rc2=r['frames']),
                               taps_same_frames=[t['frame'] for t in o.get('taps', [])] == [t['frame'] for t in taps],
                               taps=dict(rc1=[[t['label'], t['frame']] for t in o.get('taps', [])], rc2=[[t['label'], t['frame']] for t in taps]),
                               changes=box_diff(o.get('marks', []), marks))
        clips.append(c)
    stills = []
    for f, what in STILLS.items():
        p = f'{ROOT}/stills/{f}'
        if os.path.exists(p): stills.append(dict(file=p, what=what, bytes=os.path.getsize(p)))
    man = dict(
        what='Music Space Doodle video: desktop takes re-captured on build 0.22.0-rc.2 (same shot ids as ../desktop/manifest.json: D-01..D-04 + desktop spares D-03s, D-05 exchange, D-06 chat)',
        made='2026-10-08',
        replaces='/tmp/space-video-doodle/prod/capture/desktop/manifest.json (rc1 footage, build 0.22.0-rc.1, old explanatory copy)',
        build=dict(path='/tmp/space-final/dist-pages', version=build.get('version'), commit=build.get('commit'), builtAt=build.get('builtAt'),
                   served='node scripts/pages/serve-prefix.mjs /tmp/space-final/dist-pages /musicSpace/ 48931 (root route, like GitHub Pages), 127.0.0.1:48931, stopped after capture'),
        capture=dict(
            rig=f'{ROOT}/tools/rig.mjs (copy of ../desktop/tools/rig.mjs; same recorder: Playwright fake clock, 16 ms of virtual time per frame, CSS/WAAPI animations pinned to the same clock, one CDP PNG screenshot per frame (lossless), seeded Math.random 20261009; plus a visible-text audit every 12 recorded frames); takes: {ROOT}/tools/takes.mjs',
            browser='system Google Chrome, headless, --use-angle=metal --enable-gpu (real GPU), --force-color-profile=srgb, --hide-scrollbars',
            viewport='CSS 1440x810, deviceScaleFactor 8/3 -> 3840x2160 device px; locale zh-CN, Asia/Shanghai',
            clock_start='2026-10-08T22:40:00+08:00 = the first evening after the rc2 build (SHOTS.md: "an evening after the build time"). The static runtime clamps its clock to the build time (createClock, buildAtMs = 2026-10-08 04:18 +08:00), so rc1\'s 2026-10-07 22:40 would print 04:19 on screen. On-screen times: chat 22:40, 有效至 10/9 22:40 (rc1: 10/8 22:40)',
            visitor='nickname 阿宁, look preset 失真 ([data-preset="4"], the wardrobe group is now 「试试现成搭配」), participation 愿意打招呼, consent ticked; fresh browser context (= fresh world) per take, D-04 in D-02\'s world as SHOTS.md asks',
            playback_speed='virtual time advances 16 ms per frame and the files are 60 fps: playback is 4 % slower than real time (62.5 -> 60), as in every clip made with this rig; all times here are video times (frame / 60)',
            pointer='no cursor: the rig\'s doodle tap ring (yellow ring, ink outline, pink offset; 30 frames) marks each UI tap; camera glides are started with a plain element.click() on the product\'s own nav button / person label (no ring)',
            three_d_resolution='the product renders its 3D canvas at 2x CSS (its own cap), so in the 3840x2160 master the 3D layer is a 1.33x upscale while all DOM/type is native 4K; punch-ins on the 3D up to 1.5x of the 1080 frame stay at native 3D resolution',
            ai_timing='the on-device AI runs in real time while the virtual clock is stepped frame by frame, so the chip 「AI 判断：人海」 lands a few frames after the tap in the video; the result itself is the model\'s real answer',
            text_audit=f'before the first frame of every clip and every 12 frames while recording: document.body.innerText (rendered text only) + title/aria-label/placeholder/alt/value of rendered elements grepped for {PATTERN}; a hit fails the take. The 3D canvas (stage sign, prints) cannot be grepped and was checked by eye on the stills and contact sheet.',
        ),
        encoding=dict(master='H.264 High, CRF 15, preset slow, tune animation, yuv420p, BT.709 primaries/transfer/matrix, limited range, 60 fps CFR, +faststart, no audio, 3840x2160',
                      edit='same settings, 1920x1080, Lanczos downscale (accurate_rnd, full_chroma_int) made from the same lossless PNG frames in the same ffmpeg pass (not from the H.264 master)',
                      folders=dict(master=f'{ROOT}/master', edit=f'{ROOT}/1080', stills=f'{ROOT}/stills', qc=f'{ROOT}/qc', tools=f'{ROOT}/tools', review=f'{ROOT}/review', probe=f'{ROOT}/probe', logs=f'{ROOT}/logs')),
        conventions=dict(time='seconds of video time from the first frame of the file (frame / 60)', boxes='[x, y, w, h] in master pixels (3840x2160); divide by 2 for the 1080 edit copy',
                         taps='frame = the ring appears (mousedown); dom_click_frame = frame + 3 (mouseup, the product reacts from here)',
                         beat_grid='taps that follow each other are placed on a 123 BPM grid (Flipping In): beat k at frame zero + round(k * 29.268); other tempos: re-time by cutting between taps',
                         people='per person: label box in master px; the figure stands below the label stem (about 80 x 170 CSS px = 213 x 453 master px at the overview camera)',
                         vs_rc1='per clip: frame counts, tap frames and every mark box that moved more than 4 master px (or was added/removed) compared with the rc1 manifest; scenes that address rc1 footage by source pixels should re-read these'),
        clips=clips, stills=stills,
        contact_sheet=f'{ROOT}/contact-desktop.png',
    )
    notes_p = f'{ROOT}/tools/notes.json'
    if os.path.exists(notes_p): man.update(json.load(open(notes_p)))
    json.dump(man, open(f'{ROOT}/manifest.json', 'w'), indent=1, ensure_ascii=False)
    print(f'{ROOT}/manifest.json', len(clips), 'clips', len(stills), 'stills')


if __name__ == '__main__':
    main()
