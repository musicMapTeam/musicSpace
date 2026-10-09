#!/usr/bin/env python3
"""TAKE-P1 rc2 post-processing (build 0.22.0-rc.2): take.json (+ the encoded clips) -> manifest.json + qc/qc.json.

- action times per clip: taps (finger down = ring appears, click = first frame that can show the effect), keys, scrolls,
  and state changes read from the per-frame DOM probe (exact first frames: chip, 交换已接受, reply, ...)
- QC per clip: ffprobe stream facts; exact-duplicate analysis on the lossless grabs (PNG md5 per frame) with a strict check
  that every frame inside a motion interval (scroll, product camera move, typing/tap reaction window) is unique;
  decoded-video frozen spans (mean |dI| < 0.15 on 1/4-scale grey), clip-vs-master frame identity spot check.
- rc2: copy scan per clip (every readable DOM string, probed before and after each grab, for demo / old rc.1 copy), sync frames
  refined with the post-grab probe + frame hashes, measured UI boxes (device px, clip frames) for the edit.
usage: post.py [take.json]
"""
import json, os, subprocess, sys
import numpy as np

DIR = '/tmp/space-video-doodle/prod/capture/P1-rc2'
BUILD_DIR = '/tmp/space-final/dist-pages'
DPR = 36 / 13
FF, FP = '/opt/homebrew/bin/ffmpeg', '/opt/homebrew/bin/ffprobe'
take = json.load(open(sys.argv[1] if len(sys.argv) > 1 else f'{DIR}/take.json'))
FPS = take['fps']
states, hashes, events = take['states'], take['hashes'], take['events']
states2 = take.get('states2') or states
N = take['frames']
T = lambda f: round(f / FPS, 3)

STORY = {  # storyboard shot -> (clip, anchor, storyboard position of the anchor, note); anchor = sync key | tap/scroll label | grid:<name>@<beat>
    'E1': ('P-01', 'tap 进入现场 (#join)', '22:3', 'phone first screen; the tap ring lands on 22:3, entry panel 「带上小人，进入现场」 from 22:4'),
    'E2': ('P-02', 'grid:wardrobe presets + angles@0', '23:1', 'presets 23:1-23:4 (断拍/循迹/回声/失真), angles 24:1-24:4, save 24:4.5 = grid beats 0-7.5'),
    'E3': ('P-03', 'grid:entry form@0', '25:1', 'scroll beat 1 (25:2), tick beat 4 (26:1), 进入现场 beat 6 (26:3), room right after'),
    'A1': ('P-05', 'tap 人海那张', '29:3', 'P-04 has the room + onboarding card 「第一次来 1/4 · 放一张今晚的照片」 before it; the form appears on the next frames, 拍摄于 21:48 · 来自照片自带的信息'),
    'A2': ('P-05', 'ai_chip_on_screen', '31:3', 'chime: the product jumps to the photo and the chip 「✦ AI 判断：人海」 + hint 「配对时用它找另一面，你说了算。」 are on screen (rc.2: the hint no longer says 「AI 在本机判断，照片不上传」)'),
    'A4': ('P-07', 'tap 保存这张照片', '35:1', 'toast 「已分享给本场成员」 + wall panel right after (35:2)'),
    'A5': ('P-08', 'wall_badge_first_frame', '37:1', 'header, 21:47 · 同一刻 · 3 个视角, note 「3 分钟内拍下」 and the badge are all on the first wall screen (no pipeline ribbon in rc.2); then the slow scroll'),
    'M2': ('P-08', 'wall_badge_first_frame', '43:1', 'badge card 「同一刻的另一面」 + reason + 和 TA 交换这个视角 (also CUT-05); punch in'),
    'M3': ('P-09', 'grid:exchange@0', '45:1', 'tap 和 TA 交换这个视角 = beat 0, compose slides in; rc.2: the compose fits one screen, nothing scrolls on beat 4 (46:1)'),
    'M4': ('P-09', 'grid:exchange@8', '47:1', 'no scroll on beat 8 in rc.2 (47:1), tick 我同意先给小图，TA 接受后再给原图 beat 9 (47:2), send beat 10 (47:3), 等待对方回应 (48:1, P-10)'),
    'M5': ('P-10', 'pending_等待对方回应', '48:1', 'the real wait (cut it in the edit); 有效至 10/9 22:40 + 等 TA 接受后，就能互看原图。'),
    'M6': ('P-11', 'accepted_交换已接受', '51:1', 'first frame of 「交换已接受」 = the payoff hit'),
    'M7': ('P-11', 'accepted_交换已接受', '53:1', 'same screen: 「和 阿遥 的两张照片」, 「散场后也能在「照片交换」里看。」 + 撤销这次交换 (rc.2 copy; no fine print); use from +2 bars'),
    'S1': ('P-12', 'tap 向 小满 招个手', '55:3', 'toast 招呼已送达，等待对方回应 (55:4), cut the wait to 你们已经认识了 (56:1, sync friends_你们已经认识了), ♡ 2 just after'),
    'S2': ('P-13', 'grid:chat typing 16ths + send@0', '57:3', '16 characters on 16ths (4 beats) then send on beat 4; storyboard gives typing 2 beats (57:3-58:1): play the typing at 2x or cut; reply = reply_今晚的返场太好听了 (58:3, cut the wait)'),
    'S4': ('P-14', 'messages_first_frame', '60:1', 'chat room with the 3D header and the seeded lines (阿遥 「大家好，我是月台的阿遥。…」, no disclosure suffix in rc.2); chip row slides to 专辑世界杯, then the slow message scroll (60:3)'),
    'S5': ('P-15', 'grid:world cup@0', '61:1', 'VS card at beat 0, 选《午夜站台》 beat 2 (61:3), tick 投出后不能改 beat 4 (62:1), 投票 beat 5 (62:2), 2票 · 你选了这张 scroll beat 6 (62:3)'),
    'S6': ('P-16', 'reveal_本轮有共同选择', '64:1', 'the round, 我选「午夜站台」, tick 就选它，提交后不能改 + 提交 before; cut the waits'),
    'S7': ('P-17', 'grid:venue community@0', '65:1', 'rc2 (spare: the v2 cut uses H-02): 这家 Livehouse 的乐迷社群 beat 0, tick 我愿意加入这个乐迷社群 beat 2 (65:3), 加入，继续聊 beat 3 (65:4), the venue community room 「月台 Livehouse 乐迷社群」 after (66:1), then 下一场预告 「回声现场 Vol.2」'),
    'S8': ('P-18', 'grid:corner@0', '67:1', 'corner sheet at beat 0, tick 邀请 TA，并展示我的昵称和小人 beat 1 (67:2), 发出邀请 beat 2 (67:3), 「已确认。」 + 「等 TA 加入。」 right after (rc.2: 「你不能替对方同意，」 is gone)'),
    'S9': ('P-19', 'grid:memory card@0', '68:1', 'recap card at beat 0, 保存我的纪念卡 beat 2 (68:3), ticks beats 4-6 (69:1-69:3), download beat 7 (69:4) → 「已开始下载。」; CUT-08 = the downloaded PNG for 70:1'),
    'S10': ('P-20', 'my_space_first_frame', '71:1', 'MY SPACE / 长期留在这里, tiles 我的乐迷社群 / 我的现场与回顾 / 好友与新招呼 / 私聊 / 共同记忆, then a slow scroll (我的乐迷社群: 月台 Livehouse 乐迷社群 · 已加入)'),
}
PRIMARY = {  # clip -> (first main action, last main action/state) used for the handle check (>= 1 s each side)
    'P-01': ('tap 进入现场 (#join)', 'entry_panel_first_frame'), 'P-02': ('tap 现在换个造型', 'toast_小人已保存'),
    'P-03': ('tap 进入现场 (#join, again)', 'room_first_frame'), 'P-04': ('tap 人海那张', 'ai_chip_on_screen'),
    'P-05': ('tap 人海那张', 'scroll to 可见范围'), 'P-07': ('tap 保存这张照片', 'wall_badge_first_frame'),
    'P-08': ('wall_badge_first_frame', 'wall scroll back to the badge'), 'P-09': ('tap 和 TA 交换这个视角', 'pending_等待对方回应'),
    'P-10': ('tap 把这两张交给对方确认', 'accepted_交换已接受'), 'P-11': ('accepted_交换已接受', 'accepted_交换已接受'),
    'P-12a': ('tap × (close exchange)', 'person_card_小满'), 'P-12': ('tap 小满', 'inbox_♡2'),
    'P-13': ('tap 和 小满 私聊', 'reply_今晚的返场太好听了'), 'P-14': ('tap 散场聊天室', 'slow scroll through the messages'),
    'P-15': ('tap 专辑世界杯', 'scroll to 「2票'), 'P-16': ('tap × (close world cup)', 'reveal_本轮有共同选择'),
    'P-17': ('tap 设置与管理', 'next_show_回声现场_Vol.2'), 'P-18': ('tap 小满', 'invited_等_TA_加入'),
    'P-19': ('tap 回看这一晚', 'scroll to the preview'), 'P-20': ('tap 我的空间', 'slow scroll my space'),
    'P-SP1': ('tap 照片墙', 'photos_view_settled'),
}
CUTS = {
    'CUT-04': ['CUT-04-ai-tag.png', 'CUT-04-chips-ai-hint.png', 'CUT-04-full.png'],
    'CUT-05': ['CUT-05-badge.png', 'CUT-05-wall-top-full.png'],
    'CUT-06': ['CUT-06-accepted.png', 'CUT-06-accepted-full.png'],
    'CUT-07': ['CUT-07-chat-bubbles.png', 'CUT-07-full.png'],
    'CUT-08': ['CUT-08-memory-card.png'],
    'CUT-11': ['CUT-11-consent-send.png', 'CUT-11-full.png'],
    'CUT-12': ['CUT-12-worldcup-vs.png', 'CUT-12-full.png'],
    'CUT-13': ['CUT-13-phone-first-screen.png'],
    'CUT-02 (bonus)': ['CUT-02-wardrobe-stand-shizhen-3q.png', 'CUT-02-wardrobe-full.png'],
}

REFINED = {}   # (a, b, f) -> how the frame was resolved

def first(a, b, pred):
    """first frame whose image shows the state.  pre-grab probe = states[i], post-grab probe = states2[i].  A change seen first by the
    post-grab probe of frame i-1 landed during grab i-1 (async page work): it belongs to image i-1 if image i-1 == image i, or if the
    screen was still before i-1 and image i-1 changed; otherwise frame i (where the pre-grab probe already sees it), flagged ambiguous."""
    f = None
    for i in range(max(a, 0), min(b, N)):
        if pred(states[i] or {}): f = i; break
    if f is None: return None
    g = f - 1
    if g >= max(a, 0) and g >= 0 and pred(states2[g] or {}) and not pred(states[g] or {}):
        h = hashes
        if h[g] and h[g] == h[f]: REFINED[(a, b, f)] = 'image of frame-1 already shows it (identical to the frame)'; return g
        if g >= 2 and h[g] != h[g - 1] and h[g - 1] == h[g - 2]: REFINED[(a, b, f)] = 'still screen, image of frame-1 changed'; return g
        REFINED[(a, b, f)] = 'ambiguous by one frame (state landed during the previous grab)'
    return f

def changes(a, b, key):
    out, prev = [], None
    for i in range(max(a, 0), min(b, N)):
        v = (states[i] or {}).get(key)
        if i > a and v != prev: out.append((i, prev, v))
        prev = v
    return out

def sync_points(cid, a, b):
    """curated state-change frames (master frame numbers) for each clip"""
    S = {}
    def put(name, f, note=''):
        if f is not None: S[name] = {'master_frame': f, 'note': note} if note else {'master_frame': f}
    if cid == 'P-01':
        put('entry_panel_first_frame', first(a, b, lambda s: s.get('entry') == 1))
    if cid == 'P-02':
        put('wardrobe_first_frame', first(a, b, lambda s: bool(s.get('wd'))))
        for i, (f, o, v) in enumerate(changes(a, b, 'nick')):
            if v: put(f'nickname_{v}', f)
        k = 0
        for f, o, v in changes(a, b, 'wd'):
            if o and v: k += 1; put(f'figure_change_{k}', f, 'outfit/angle change visible')
        put('toast_小人已保存', first(a, b, lambda s: '小人已保存' in (s.get('toast') or '')))
    if cid == 'P-03':
        put('entry_panel_first_frame', first(a, b, lambda s: s.get('entry') == 1 and s.get('pnl')))
        put('consent_ticked', first(a, b, lambda s: s.get('ec') == 1))
        put('room_first_frame', first(a, b, lambda s: s.get('entry') == 0 and bool(s.get('tour')) and s.get('pnl') == ''))
    if cid == 'P-04' and (states[a] or {}).get('nmem', 5) < 5:
        put('linjian_joined_header_5_people', first(a, b, lambda s: s.get('nmem', 0) >= 5), '林间 joins: the 3D header turns 「5 位已加入 · 正在进行」')
    if cid in ('P-04', 'P-05'):
        put('upload_form_first_frame', first(a, b, lambda s: s.get('up') == 1))
        put('ai_thinking_frame', first(a, b, lambda s: s.get('think') == 1), 'AI 在本机判断视角… (below the fold, only if the model was not ready)')
        put('ai_selected', first(a, b, lambda s: s.get('sel') == 'crowd'), '人海 card turns yellow + ✓ (AI pre-selection, visible)')
        put('ai_chip_in_dom', first(a, b, lambda s: 'AI 判断' in (s.get('ai') or '')), 'chip exists but is below the fold')
        put('ai_chip_on_screen', first(a, b, lambda s: 'AI 判断' in (s.get('ai') or '') and s.get('aiy') is not None and 60 < s['aiy'] < 700), 'the form jumps to the photo (product auto-scroll): chip + hint on screen = the 31:3 chime')
    if cid == 'P-07':
        put('toast_已分享给本场成员', first(a, b, lambda s: '已分享给本场成员' in (s.get('toast') or '')))
        put('wall_badge_first_frame', first(a, b, lambda s: s.get('badge') == 1))
    if cid == 'P-08':
        put('wall_badge_first_frame', first(a, b, lambda s: s.get('badge') == 1))
    if cid == 'P-09':
        put('compose_first_frame', first(a, b, lambda s: s.get('x') == 1 and not s.get('xst')))
    if cid in ('P-09', 'P-10'):
        put('consent_ticked', first(a, b, lambda s: s.get('xc') == 1))
        put('pending_等待对方回应', first(a, b, lambda s: (s.get('xst') or '').startswith('等待对方回应')))
    if cid in ('P-10', 'P-11'):
        put('accepted_交换已接受', first(a, b, lambda s: (s.get('xst') or '').startswith('交换已接受')), '= 51:1, the payoff hit; the sticker pops and the two polaroids drop in over the next ~10 frames')
    if cid == 'P-12a':
        put('people_list', first(a, b, lambda s: s.get('pnl') == '看看同场的人'))
    if cid in ('P-12', 'P-12a'):
        put('person_card_小满', first(a, b, lambda s: s.get('view') == 'person' and s.get('pnl') not in ('', '看看同场的人')))
        put('toast_招呼已送达', first(a, b, lambda s: '招呼已送达' in (s.get('toast') or '')))
        put('greet_waiting', first(a, b, lambda s: s.get('greet') == 'waiting'))
        put('friends_你们已经认识了', first(a, b, lambda s: s.get('greet') == 'friends'))
        put('inbox_♡1', first(a, b, lambda s: '1' in (s.get('inbox') or '')))
        put('inbox_♡2', first(a, b, lambda s: '2' in (s.get('inbox') or '')))
    if cid == 'P-13':
        put('chat_open', first(a, b, lambda s: s.get('chat', -1) >= 2))
        put('my_bubble', first(a, b, lambda s: s.get('chat', -1) >= 3))
        put('reply_今晚的返场太好听了', first(a, b, lambda s: s.get('chat', -1) >= 4))
    if cid == 'P-14':
        put('join_card', first(a, b, lambda s: 'music-community' in (s.get('comm') or '') and 'conversation-l' not in (s.get('comm') or '')))
        put('messages_first_frame', first(a, b, lambda s: 'conversation-l' in (s.get('comm') or '')))
    if cid == 'P-15':
        put('cup_panel', first(a, b, lambda s: s.get('cupst', -1) >= 0))
        put('vs_card', first(a, b, lambda s: '午夜站台' in (s.get('cup') or '')))
        put('vote_form', first(a, b, lambda s: '|form' in (s.get('cup') or '')))
        put('vote_ticked', first(a, b, lambda s: '+c' in (s.get('cup') or '')))
        f = first(a, b, lambda s: '你选了这张' in (s.get('cup') or ''))
        if f is None:
            e = next((e for e in events if a <= e['frame'] < b and e['label'].startswith('voted')), None)
            f = e['frame'] - 1 if e else None
        put('voted_2票_你选了这张', f, '2票 + 「你选了这张」 under 午夜站台 (the form closes; the card is above the fold until the beat-6 scroll)')
    if cid == 'P-16':
        put('games_panel', first(a, b, lambda s: bool(s.get('game'))))
        put('join_form', first(a, b, lambda s: 'join' in (s.get('game') or '')))
        put('round_starts', first(a, b, lambda s: '进行中' in (s.get('game') or '')))
        put('answer_form', first(a, b, lambda s: 'answer' in (s.get('game') or '')))
        put('reveal_本轮有共同选择', first(a, b, lambda s: '|reveal' in (s.get('game') or '')))
    if cid == 'P-17':
        put('settings_menu_open', first(a, b, lambda s: s.get('menu') == 1))
        put('venue_join_card', first(a, b, lambda s: 'music-community' in (s.get('comm') or '') and 'conversation-l' not in (s.get('comm') or '') and '月台' in (s.get('comm') or '')), '「月台 Livehouse 乐迷社群 · 散场后，乐迷留在这里；下一场的预告也发在这里。」 + 我愿意加入这个乐迷社群')
        put('venue_community_room', first(a, b, lambda s: 'conversation-l' in (s.get('comm') or '') and '月台' in (s.get('comm') or '')), 'the venue community room: 3D header MUSIC SPACE / 乐迷社群 · 月台 Livehouse 乐迷社群 · 2 位乐迷')
        put('next_show_回声现场_Vol.2', first(a, b, lambda s: '|next' in (s.get('space') or '')), 'LIVEHOUSE / 下一场见: 下一场预告 · 回声现场 Vol.2 · 月台 Livehouse · 时间待定')
    if cid == 'P-18':
        put('corner_sheet', first(a, b, lambda s: s.get('corner') == 'open'))
        put('corner_ticked', first(a, b, lambda s: s.get('corner') == 'ticked'))
        put('invited_等_TA_加入', first(a, b, lambda s: s.get('corner') == 'invited'), '「已确认。」 + 「等 TA 加入。」')
    if cid == 'P-19':
        put('memory_form', first(a, b, lambda s: bool(s.get('mem'))))
        for f, o, v in changes(a, b, 'mem'):
            if o and v and o != v: put(f'memory_{v}', f)
    if cid == 'P-20':
        put('my_space_first_frame', first(a, b, lambda s: s.get('my', -1) >= 0))
    if cid == 'P-SP1':
        put('photos_view_settled', first(a, b, lambda s: s.get('view') == 'photos' and s.get('mv') == 0))
    return S

def ffprobe(path):
    j = json.loads(subprocess.run([FP, '-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries',
        'stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,avg_frame_rate,nb_read_frames,color_range,color_space,color_primaries,color_transfer,duration',
        '-show_entries', 'format=size,duration', '-of', 'json', path], capture_output=True, text=True).stdout)
    st = j['streams'][0]; fm = j['format']
    return {'codec': f"{st['codec_name']} {st.get('profile', '')}", 'size': f"{st['width']}x{st['height']}", 'pix_fmt': st['pix_fmt'], 'fps': st['r_frame_rate'],
            'frames': int(st['nb_read_frames']), 'duration_s': float(fm['duration']), 'bytes': int(fm['size']),
            'colour': f"{st.get('color_primaries')}/{st.get('color_transfer')}/{st.get('color_space')}/{st.get('color_range')}"}

def gray_diffs(path, w=270, h=585):
    raw = subprocess.run([FF, '-v', 'error', '-i', path, '-vf', f'scale={w}:{h}:flags=area,format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
    f = np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.int16)
    return np.abs(np.diff(f, axis=0)).mean(axis=(1, 2)), f

def gray_at(path, n, w=270, h=585):
    """decoded frame n (0-based, CFR 60) as a small grey array: accurate seek to just before its timestamp, first frame out"""
    raw = subprocess.run([FF, '-v', 'error', '-ss', f'{max(0, (n - 0.25) / FPS):.6f}', '-i', path, '-frames:v', '1', '-vf', f'scale={w}:{h}:flags=area,format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(h, w).astype(np.int16) if len(raw) == w * h else None

def master_alignment(file, a, b, master_file):
    """clip frame k must be master frame a+k: compare 3 sample frames against master a+k-1, a+k, a+k+1 (mean |dI|, grey 1/4 scale)"""
    if not (file and master_file and os.path.exists(file) and os.path.exists(master_file)): return None
    n = b - a; out = []
    for k in sorted({min(n - 1, max(0, x)) for x in (n // 5, n // 2, (4 * n) // 5)}):
        c = gray_at(file, k)
        if c is None: continue
        d = {}
        for off in (-1, 0, 1):
            m = gray_at(master_file, a + k + off)
            if m is not None: d[off] = round(float(np.abs(c - m).mean()), 3)
        disc = bool(d) and 0 in d and max(v for o, v in d.items() if o != 0) - d[0] > 0.3      # the neighbours differ: the sample can tell offsets apart
        out.append({'clip_frame': k, 'mean_abs_diff_vs_master_offset': d, 'discriminative': disc})
    # aligned: offset 0 is never worse than a neighbour (+0.02 grey levels of encoder noise); on still screens all three are equal
    ok = all(0 in x['mean_abs_diff_vs_master_offset'] and x['mean_abs_diff_vs_master_offset'][0] <= min(x['mean_abs_diff_vs_master_offset'].values()) + 0.02 for x in out)
    return {'samples': out, 'aligned': ok, 'discriminative_samples': sum(1 for x in out if x['discriminative'])}

def frame_png(path, n, out):
    subprocess.run([FF, '-v', 'error', '-y', '-i', path, '-vf', f'select=eq(n\\,{n})', '-fps_mode', 'passthrough', '-frames:v', '1', out], check=True)

def runs(mask):
    out, i = [], 0
    while i < len(mask):
        if mask[i]:
            j = i
            while j < len(mask) and mask[j]: j += 1
            out.append((i, j - i)); i = j
        else: i += 1
    return out

manifest_clips, qc_all, motion_viol_total = {}, {}, 0
ev_by_frame = sorted(events, key=lambda e: e['frame'])
for c in take['clips']:
    cid, a, b = c['id'], c['start'], c['end']
    file = c.get('file')
    acts = []
    for e in ev_by_frame:
        if not (a <= e['frame'] < b) and not (e.get('type') == 'scroll' and a <= e['frame'] + e.get('frames', 0) and e['frame'] < b): continue
        k = e.get('type', 'state')
        if k == 'grid':
            acts.append({'kind': 'beat-grid', 'label': e['label'], 'beat0_frame': e['beat0'] - a, 'beat0_t': T(e['beat0'] - a)}); continue
        item = {'kind': k, 'label': e['label'], 'frame': e['frame'] - a, 't': T(e['frame'] - a)}
        if k == 'tap': item.update({'finger_down_frame': e['down'] - a, 'click_frame': e['frame'] - a, 'xy_css': [e['x'], e['y']]}); item.pop('frame'); item['t'] = T(e['frame'] - a)
        if k == 'scroll': item.update({'end_frame': e['frame'] + e['frames'] - a, 'from_px': e['from'], 'to_px': e['to']})
        if 'target' in e: item['on_grid'] = e['target'] == e['frame']
        acts.append(item)
    sync = {}
    for k, v in sync_points(cid, a, b).items():
        item = {**v, 'frame': v['master_frame'] - a, 't': T(v['master_frame'] - a)}
        mf = v['master_frame']
        why = REFINED.get((a, b, mf)) or REFINED.get((a, b, mf + 1))
        if why: item['resolved'] = why
        if why and why.startswith('ambiguous') and file and os.path.exists(file) and item['frame'] >= 2:
            # pixel test: the state landed during the grab of frame-1; the bigger image change (frame-2 -> frame-1 vs frame-1 -> frame) shows where
            fq = item['frame']; g0, g1, g2 = gray_at(file, fq - 2), gray_at(file, fq - 1), gray_at(file, fq)
            if g0 is not None and g1 is not None and g2 is not None:
                d_before, d_at = float(np.abs(g1 - g0).mean()), float(np.abs(g2 - g1).mean())
                if d_before > 0.5 and d_before > 2 * d_at:
                    item.update({'frame': fq - 1, 't': T(fq - 1), 'master_frame': mf - 1, 'resolved': f'pixel test: image change {d_before:.2f} on frame-1 vs {d_at:.2f} on the frame -> frame-1'})
                elif d_at > 0.5 and d_at > 2 * d_before:
                    item['resolved'] = f'pixel test: image change {d_at:.2f} on the frame vs {d_before:.2f} on frame-1 -> the frame'
                else:
                    item['resolved'] = f'ambiguous by one frame (pixel test inconclusive: {d_before:.2f} / {d_at:.2f})'
        sync[k] = item
    # ---- QC on the lossless grabs (hash per frame) ----
    hs = hashes[a:b]
    same = [hs[i] == hs[i - 1] for i in range(1, len(hs))]
    still_runs = [(s + 1, n + 1) for s, n in runs(same)]
    DPR = 36 / 13
    def ease(t): return 4 * t * t * t if t < .5 else 1 - ((-2 * t + 2) ** 3) / 2
    checked, viol, edge = 0, [], 0
    for e in events:
        if e.get('type') != 'scroll' or e['to'] == e['from']: continue
        f0, n, D = e['frame'], e['frames'], e['to'] - e['from']
        for i in range(1, n):
            f = f0 + i
            if not (a < f < b): continue
            step_px = abs(D * (ease((i + 1) / n) - ease(i / n))) * DPR
            if step_px >= 3:
                checked += 1
                if hashes[f] == hashes[f - 1]: viol.append(f - a)
            elif hashes[f] == hashes[f - 1]: edge += 1
    cam_same = sum(1 for i in range(max(a, 1), b) if (states[i] or {}).get('mv') == 1 and (states[i - 1] or {}).get('mv') == 1 and hashes[i] == hashes[i - 1])
    motion_viol_total += len(viol)
    q = {'lossless_grabs': {'frames': len(hs), 'unique': len(set(hs)), 'identical_consecutive': int(sum(same)),
                            'longest_identical_run_s': T(max([n for _, n in still_runs], default=1)),
                            'identical_runs_over_1s': [f'{T(s)}s+{T(n)}s' for s, n in still_runs if n >= FPS],
                            'scroll_frames_checked': checked, 'duplicates_inside_motion': [T(i) for i in viol][:20],
                            'info_identical_at_scroll_ease_edges': edge, 'info_identical_while_camera_settles': cam_same},
         'probe_errors': sum(1 for i in range(a, b) if 'err' in (states[i] or {}) or 'err' in (states2[i] or {}))}
    hits = [(i, (states[i] or {}).get('ban') or (states2[i] or {}).get('ban')) for i in range(a, b)]
    hits = [(i, h) for i, h in hits if h]
    q['copy_scan'] = {'frames_scanned': b - a, 'probes_per_frame': 2,
                      'pattern': '示例|虚构|本页|模拟|演示|自动回复|不是真人|在本页运行|没有服务器|只存在这个浏览器 + rc.1 copy (等待本人回应, 示例路线, 长期音乐社群, 我的社群, 明确加入, 先保留我的选择, 创建共同创作邀请, 等待朋友本人明确参与, 已发起下载, 在线访问, 规则判断, 试试组合示例, 关于这个示例, 示例站)',
                      'frames_with_hits': len(hits), 'samples': [{'frame': i - a, 'hit': h} for i, h in hits[:5]]}
    if file and os.path.exists(file):
        q['stream'] = ffprobe(file)
        d, g = gray_diffs(file)
        froz = d < 0.15
        fr = [(s + 1, n + 1) for s, n in runs(froz)]
        q['decoded'] = {'mean_abs_diff': round(float(d.mean()), 3), 'longest_static_s': T(max([n for _, n in fr], default=1)),
                        'static_spans_over_1s': [f'{T(s)}s+{T(n)}s' for s, n in fr if n >= FPS]}
        q['frame_count_matches_take'] = q['stream']['frames'] == (b - a)
        q['master_alignment'] = master_alignment(file, a, b, (take.get('master') or {}).get('file'))
    qc_all[cid] = q
    handles = {}
    pr = PRIMARY.get(cid)
    if pr:
        def locate(key, end=False):
            if key in sync: return sync[key]['frame']
            for x in acts:
                if x['kind'] in ('tap', 'key', 'scroll', 'state') and key in x['label']:
                    if end and x['kind'] == 'scroll': return x['end_frame']
                    return x.get('finger_down_frame', x.get('frame')) if not end else x.get('click_frame', x.get('frame'))
            return None
        f0 = locate(pr[0]); fl = None
        for x in (acts if pr[1] not in sync else []):
            if pr[1] in x['label']: fl = x.get('end_frame', x.get('click_frame', x.get('frame')))
        if pr[1] in sync: fl = sync[pr[1]]['frame']
        if f0 is not None and fl is not None:
            handles = {'main_action_first': pr[0], 'main_action_last': pr[1], 'before_s': T(f0), 'after_s': T((b - a) - 1 - fl)}
    def mm(st):   # rc.2: the chip reads 「音乐探索 ↗」 (x 20..119 of the action row, above the message list): on screen while the row is scrolled < 119 px
        st = st or {}
        return 'conversation-l' in (st.get('comm') or '') and not st.get('cup') and not st.get('game') and not st.get('space') and 0 <= st.get('row', -1) < 119
    mm_spans, i = [], a
    while i < b:
        if mm(states[i]):
            j = i
            while j < b and mm(states[j]): j += 1
            mm_spans.append([T(i - a), T(j - a)]); i = j
        else: i += 1
    q['music_map_chip_on_screen_s'] = mm_spans
    bx = {}
    for m in take.get('measures', []):
        if a <= m['frame'] < b:
            bx[m['name']] = {'frame': m['frame'] - a, 't': T(m['frame'] - a),
                             'boxes_px': {k: ([round(x * DPR) for x in v] if v else None) for k, v in m['boxes'].items()},
                             'texts': m.get('texts', {})}
    manifest_clips[cid] = {'file': file, 'feeds': c['meta'].get('feeds'), 'what': c['meta'].get('what'), 'master_in_frame': a, 'master_out_frame': b,
                           'master_in_s': T(a), 'master_out_s': T(b), 'frames': b - a, 'seconds': T(b - a), 'handles': handles,
                           'sync': sync, 'actions': acts, 'boxes': bx}

def storyboard_map():
    out = {}
    for shot, (cid, anchor, pos, note) in STORY.items():
        c = manifest_clips.get(cid); f = None
        if c:
            if anchor.startswith('grid:'):
                name, beat = anchor[5:].rsplit('@', 1)
                g = next((g for g in take['grids'] if g['name'] == name), None)
                if g: f = round(g['beat0'] + float(beat) * g['fpb']) - c['master_in_frame']
            elif anchor in c['sync']: f = c['sync'][anchor]['frame']
            else:
                for x in c['actions']:
                    if anchor in x['label']: f = x.get('click_frame', x.get('frame')); break
        out[shot] = {'clip': cid, 'anchor': anchor, 'anchor_frame': f, 'anchor_t': T(f) if f is not None else None, 'lands_on': pos, 'note': note}
    return out

master = take.get('master') or {}
build = json.load(open(f'{BUILD_DIR}/build.json'))
stills = {k: [f'{DIR}/stills/{f}' for f in v if os.path.exists(f'{DIR}/stills/{f}')] for k, v in CUTS.items()}
still_meta = {r['name']: {'master_frame': r['frame'], 'clip_css': r['clip_css']} for r in take['stills']}
man = {
    'take': 'TAKE-P1 rc2 (SHOTS.md §3): the continuous phone judge route in one world, re-shot on 0.22.0-rc.2 (same shot ids, beat grids and choreography as capture/P1; P-17 follows the venue framing)',
    'build': {'served_dir': BUILD_DIR, 'version': build.get('version'), 'commit': build.get('commit'), 'builtAt': build.get('builtAt'),
              'url': take['base'] + ' (scripts/pages/serve-prefix.mjs, site root under /musicSpace/, not /preview/)'},
    'world': {'context': 'one Chrome context = one world for the whole take (IndexedDB never reset); cast 阿遥 (房主, 「月台的阿遥」), 小满, 北屿, 林间 in 「回声现场」 at 「月台 Livehouse」',
              'visitor': '阿宁, look preset 失真 (data-preset=4), participation 愿意打招呼',
              'clock': take['clock'] + ' (Playwright fake clock; rc.2 was built 2026-10-08 04:18 +08:00 and its runtime clock never runs before the build, so the take runs one evening later than TAKE-P1: chat 22:41, 有效至 10/9 22:40, memory card 2026.10.08; photo times 21:47/21:48 come from the photos)',
              'seed': 'Math.random seeded (rec2 default 20261009)'},
    'rig': {'recorder': 'rig/rec2.mjs (byte copy of capture-test/rec2.mjs) + p1lib.mjs (multi-sink, probe, load settling)', 'browser': 'Chrome headless --use-angle=metal --enable-gpu (real GPU)',
            'phone': '390x845 CSS @ 36/13 = 1080x2340, isMobile + hasTouch, zh-CN, Asia/Shanghai',
            'timing': 'frame-stepped: every output frame advances the page clock by 16 ms (rAF/timers/CSS+WAAPI synced) and is grabbed losslessly (CDP PNG); encoded as 60 fps CFR, so product motion plays at 0.96x real speed; waits are real product waits measured in frames',
            'encode': 'libx264 High, CRF 15 preset slow tune animation (clips) / CRF 16 medium (master), yuv420p, BT.709 limited range, +faststart',
            'cursor': 'no arrow cursor; taps show the rig doodle tap ring (yellow ring, ink outline, pink offset, 480 ms) at the finger; the text caret is hidden (CSS caret-color: transparent) because its real-time blink would flicker in frame-stepped capture',
            'loads': 'before every grab the recorder waits (real time) until visible <img> are decoded and fonts are loaded; all 18 doodle font faces preloaded at boot',
            'probe': 'DOM state probed before and after every grab (states / states2 in take.json); sync frames use the pre-grab probe, moved one frame earlier when the post-grab probe of the previous frame already saw the change and the frame hashes prove that image shows it (sync.<key>.resolved)',
            'copy_scan': 'every readable DOM string (body innerText incl. scrolled-off text, visible field values/placeholders, selected options) scanned twice per frame for 示例/虚构/本页 and the other demo words of the copy plan plus rc.1 strings; also logged at every clip in/out (take.json ban_checks)'},
    'beat_grid': {'bpm': take['bpm'], 'frames_per_beat': round(take['fpb'], 4), 'grids': take['grids'],
                  'rule': '♩ rows: each tap is pressed 3 frames early so its click (= first frame that can show the effect) lands on round(beat0 + k * frames_per_beat). To fit another tempo, play the clip at rate = track_bpm / %s (e.g. 124 BPM: 1.0081, 130: 1.0569, 110: 0.8943) or cut between taps.' % take['bpm']},
    'master': {'file': master.get('file'), 'frames': take['frames'], 'seconds': T(take['frames']), 'note': 'the whole take as shot (all waits included); clips are cut from the same frames (no second encode generation)'},
    'clips': manifest_clips,
    'storyboard_map': storyboard_map(),
    'stills': stills, 'stills_meta': still_meta,
    'warnings': take['warnings'], 'page_errors': take['errors'], 'console': take['console'],
    'measures': take.get('measures', []),
    'notes_for_the_edit': [
        'Clean plates: every clip is the full unzoomed 1080x2340 screen (no baked push or punch-in, also not on P-01) so the hand-drawn phone frame and DM punch-ins (sharp up to 2.5x) work on them.',
        'Same ids as capture/P1: tools/serve.mjs resolves a capture id by basename across prod/capture/** (exact name, then directory rank, then the LARGER file), so P1/clips/P-xx.mp4 and P1-rc2/clips/P-xx.mp4 compete; retire capture/P1 (or alias the ids in dm/assets.json) before rendering with this take. The stills (CUT-xx-*.png) have the same names as P1 too.',
        'Speed: 16 ms of product time per output frame at 60 fps = 0.96x real speed; all times in this manifest are output times.',
        'Beat taps: the ♩ rows put the click on exact frames of a 123 BPM grid (beats.json of Flipping In); for another track retime with rate = track_bpm / 123 or cut between taps.',
        'Boxes: clips.<id>.boxes holds measured UI boxes in device px of the 1080x2340 frame (x, y, w, h) at the given clip frame, with the text found there (the scenes address footage by source px: re-measure every act comment against these; top-level measures = the same in CSS px at master frames).',
        'Wardrobe (E2): the wardrobe opens on the 3/4 angle; presets 断拍 → 循迹 → 回声 → 失真 change the figure on every beat, then 正面 / 侧面 / 背面 / 3/4; the nickname 阿宁 is typed in the wardrobe (the entry form shows it read-only afterwards). The preset list is labelled 「试试现成搭配」 in rc.2.',
        'Entry (E3): rc.2 entry form 「月台 Livehouse · 回声现场 / 带上小人，进入现场」; the participation options, the consent 「我愿意向本场成员展示我的昵称和小人」 and 「进入现场」 are all on screen after the beat-1 scroll (boxes: P-03).',
        'AI (A2): rc.2 hint under the chip reads 「配对时用它找另一面，你说了算。」 — the visible upload form no longer says 「AI 在本机判断，照片不上传」 (that sentence is only the chip\'s tooltip now). Any shot that circles or quotes those words from the phone (A3 31:x, W3 77:1 CUT-04c) needs another source or must drop the quote; 「AI 在本机给你一个视角建议」 is on the lobby card (P-01).',
        'Wall (A5/M2): no pipeline ribbon in rc.2, the group shows 「21:47 · 同一刻 · 3 个视角：舞台 · 人海 · 细节」 + 「3 分钟内拍下」 and the badge 107 px higher than rc.1; the scroll stops were moved up by 107 px (313 / 713 / 1163 / back to 13) to frame the same content.',
        'Exchange (M3-M7): the compose sheet fits one screen in rc.2, so nothing scrolls on beats 4 and 8 (the beats are kept: tick on 9, send on 10); 等待对方回应 appears on the send click; the accepted screen holds 「和 阿遥 的两张照片」, 「散场后也能在「照片交换」里看。」 and 撤销这次交换 (no fine print).',
        'Chat (S2): 16 characters on 16ths take 4 beats before the send; the storyboard gives 2 beats, so play the typing at 2x or cut into it. Welcome bubbles are 「嗨，欢迎来到「回声现场」！」 and 「你拍到的是哪一面？」 (no 我是示例角色 line).',
        'Chat room (S4): seeded lines without the disclosure suffix; the action row is 「音乐探索 ↗ · 一起玩 · 音乐话题 · 专辑世界杯」 (the Music Map chip is now 「音乐探索 ↗」, Doodle like the rest; qc.music_map_chip_on_screen_s lists when it is on screen).',
        'Venue community (S7, P-17): rc2 shows the fan side of the owner\'s framing instead of a fan-created community: 设置与管理 → 这家 Livehouse 的乐迷社群 → join 「月台 Livehouse 乐迷社群」 → 下一场预告 「回声现场 Vol.2」. The v2 cut uses H-02 for S7; P-17 is a spare. My Space (P-20) therefore lists 「月台 Livehouse 乐迷社群 · 已加入」 instead of a community 阿宁 hosts.',
        'Corner (S8): rc.2 says 「等 TA 加入。」 after 「发出邀请」; the quote 「你不能替对方同意，」 that S8 die-cuts from P-18 f330 no longer exists in the product.',
        'Memory card (S9): 「已开始下载。」 then the preview 你的纪念卡; CUT-08 is the real PNG (保存于 2026.10.08).',
        'Static holds: 2D panels do not move between actions (identical frames by design; 3D views boil at the product 7 Hz); add PUSH/BOIL in the edit.',
        'Tap ring: rig doodle ring (yellow, ink outline, pink offset) on finger down, fades in 0.48 s at the finger position even when the screen changes under it.',
        'Text caret hidden by harness CSS (caret-color: transparent): Chrome blinks it on real time, which would flicker in frame-stepped capture. No other DOM, state or storage was touched.',
    ],
    'rebuild': [
        'cd /Users/alakazan/workplace/tme/musicSpace && node scripts/pages/serve-prefix.mjs /tmp/space-final/dist-pages /musicSpace/ 47871   (background; stop afterwards)',
        'cd /tmp/space-video-doodle/prod/capture/P1-rc2 && node take-p1.mjs   (~15 min, background; DRY=1 for a 1-min flow test; BPM=124 to choreograph to another grid; CLOCK=<iso> must stay after the build time)',
        '/tmp/space-video-prep/tools/venv/bin/python post.py && node sheet-p1.mjs',
    ],
}
os.makedirs(f'{DIR}/qc', exist_ok=True)
json.dump(qc_all, open(os.environ.get('QCOUT', f'{DIR}/qc/qc.json'), 'w'), ensure_ascii=False, indent=1)
for cid, q in qc_all.items(): manifest_clips[cid]['qc'] = q
json.dump(man, open(os.environ.get('MANOUT', f'{DIR}/manifest.json'), 'w'), ensure_ascii=False, indent=1)
print('clips', len(manifest_clips), 'motion duplicate violations', motion_viol_total)
for cid, m in manifest_clips.items():
    q = m['qc']
    print(f"{cid:6} {m['seconds']:6.2f}s  handles {m['handles'].get('before_s')}/{m['handles'].get('after_s')}  uniq {q['lossless_grabs']['unique']}/{q['lossless_grabs']['frames']}  motion-dups {len(q['lossless_grabs']['duplicates_inside_motion'])}  longest-static {q.get('decoded', {}).get('longest_static_s')}  frames-ok {q.get('frame_count_matches_take')}  copy-hits {q['copy_scan']['frames_with_hits']}")
