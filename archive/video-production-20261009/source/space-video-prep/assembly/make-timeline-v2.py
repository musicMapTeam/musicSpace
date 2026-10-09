#!/usr/bin/env python3
"""Generate assembly/timeline.v2.json (hook-first cut, 165 s on a 2.5 s bar grid at 96 BPM) from one readable shot table.
Status tags: FINAL = asset is final quality; REHEARSAL = RC4 footage (real product, older build) standing in; TO CAPTURE = slate until the Route B build can be recorded.
Run:  python3 make-timeline-v2.py [--no-m3] [--s1-static]   (--no-m3 drops the optional two-device insert: 155 s; --s1-static = S1 recorded on the static build, no two-device note)"""
import json, sys
NO_M3 = '--no-m3' in sys.argv
S1_DUO = '--s1-static' not in sys.argv      # rehearsal: S1 is the RC4 two-device clip; FINAL: S1 is the static build (cast answers), pass --s1-static
BAND = 'band'
def card(p): return f'../cards/out/{p}.mp4'
def clip(i): return f'../clips/final/{i}.mp4'
S = []   # (id, title, src, dur, extra)
def add(id, title, src, dur, **kw): S.append(dict(id=id, title=title, src=src, dur=dur, **kw))

add('H0', 'HOOK: 3D livehouse tour (cinema grade) + title lockup', clip('S00'), 12.5, layout='full', grade='cinema', status='REHEARSAL (RC4 room; final = Route B cast)', mode='STATIC-capable, single viewer')
add('P1', 'Pain 1: you shot the stage, she remembers the crowd', card('card-b-pain'), 5, layout='full', status='CARD (final)', footage=False, transition_in=dict(type='fade', dur=0.5))
add('P2', 'Pain 2: group album, 99+ shots, no way to tell the same moment', card('card-b2-groupalbum'), 5, layout='full', status='CARD (final)', footage=False)
add('P3', 'Pain 3: no safe way to say hi', card('card-b3-noopening'), 5, layout='full', status='CARD (final)', footage=False)
add('Q', 'What if: the other side comes back, by consent', card('card-d-whatif'), 5, layout='full', status='CARD (final)', footage=False, transition_in=dict(type='fade', dur=0.3))
add('E1', 'Landing: presence card + enter button', clip('RB-E1'), 5, fallback='../stills/er-entry.png', status='TO CAPTURE (Route B landing)', mode='STATIC', note='Open the Pages link; status line, presence card 「同一刻，另一面。」, button 「进入示例现场」. Director zoom on the card.')
add('E2', 'Entry: avatar + wardrobe + one consent tick', clip('S04'), 10, speed=0.96, status='REHEARSAL (RC4 wardrobe; final = 带上小人，进入示例现场 panel)', mode='STATIC')
add('E3', 'In the room: cast (·示例), tour card', clip('S01'), 5, status='REHEARSAL (RC4 tour; final = cast + tour card 1/4)', mode='STATIC')
add('A1', 'Wall grouped by moment: 21:47 · 同一刻 · 3 个视角', clip('S08'), 10, status='REHEARSAL (RC4 wall list; no grouping UI)', mode='STATIC')
add('A2a', 'Pick 人海·示例照片 -> 拍摄于 21:48 + 「AI 判断：人海」 -> 保存', clip('S05'), 7.5, status='REHEARSAL (RC4 upload; no AI chip)', mode='STATIC')
add('A2b', 'Saved: photo joins the 21:47 group', clip('S07'), 2.5, status='REHEARSAL (RC4)', mode='STATIC', transition_in=dict(type='slideleft', dur=0.3))
add('A3', 'The honest case: 「不确定，请选择」', clip('S06'), 5, status='REHEARSAL (RC4 upload; no AI chip)', mode='STATIC')
add('M1', '「同一刻的另一面」 badge + reason + 和 TA 交换这个视角', clip('S09'), 10, speed=10.417/10, status='REHEARSAL (RC4 request flow; no reveal UI)', mode='STATIC')
add('M2', 'Compose (推荐 pre-selected) + consent + send + 交换已接受', clip('S10'), 15, speed=19.033/15, status='REHEARSAL (RC4 two-device consent)', mode='STATIC final / NODE x2 rehearsal', transition_in=dict(type='slideleft', dur=0.4))
if not NO_M3:
    add('M3', 'OPTIONAL insert: two real people, two devices (full version)', clip('S03'), 10, speed=12.033/10, status='REHEARSAL (RC4 duo)', mode='NODE x2 (label: 完整版 · 本机双浏览器演示)', transition_in=dict(type='slideleft', dur=0.4))
add('S1', 'Greeting -> accepted -> private chat -> reply', clip('S12'), 15, status='REHEARSAL (RC4 duo greeting/chat)', mode='STATIC final (小满·示例) / NODE x2 rehearsal', transition_in=dict(type='slideleft', dur=0.4))
add('S2', 'Quiet rule: 林间·示例 does not take new greetings', clip('RB-S2'), 2.5, status='TO CAPTURE (Route B)', mode='STATIC', note='Open 林间·示例 (3D person or 同场的人): 「TA 选择安静参与，不接收新招呼」.')
add('S3a', 'After-show room: album cup', clip('S14b'), 5, speed=0.5, status='REHEARSAL (RC4 world cup)', mode='STATIC')
add('S3b', 'After-show room: preference game', clip('S14c'), 5, speed=0.5, status='REHEARSAL (RC4 games)', mode='STATIC')
add('K1a', 'Recap -> save memory card -> PNG preview', clip('S13'), 6, speed=8.2/6, status='REHEARSAL (RC4 recap + card)', mode='STATIC')
add('K1b', 'The real exported PNG flies in (card K)', card('card-k-memory'), 4, layout='full', status='CARD (final layout; PNG = RC4 export)', footage=False, transition_in=dict(type='fade', dur=0.3))
add('K2', 'Music Map round trip (音乐探索)', clip('S14d'), 5, speed=0.5, status='REHEARSAL (RC4 Map flip)', mode='STATIC')
add('C', 'End card: Music Space · 同一刻，另一面。· link · QR', card('card-c-end'), 10, layout='full', status='CARD (final)', footage=False, transition_in=dict(type='fade', dur=0.5))

# start times on the programme timeline
t = 0.0; starts = {}
for s in S:
    starts[s['id']] = t; t += s['dur']
TOTAL = t
def at(id, a, b): return starts[id] + a, starts[id] + b

subs = []
def band(id, a, b, text, chip=None):
    st, en = at(id, a, b); d = dict(start=round(st, 2), end=round(en, 2), text=text, style='band')
    if chip: d['chip'] = chip
    subs.append(d)
def note(start, end, text, style='bandnote'): subs.append(dict(start=round(start, 2), end=round(end, 2), text=text, style=style))

# hook: one honesty note, no band
subs.append(dict(start=0.9, end=5.2, text='示例角色与照片均为虚构（AI 生成）', style='note'))
# product captions (Chinese, honest: AI only suggests the viewpoint; rules do the pairing; the cast is 示例 and automatic)
band('E1', 0.4, 4.8, '打开链接就能进，不用安装。')
band('E2', 0.4, 9.6, '带上自己的二维手绘小人入场，随时能换装。')
band('E3', 0.3, 4.8, '真正的三维 Livehouse；同场的朋友是**示例角色**。')
band('A1', 0.5, 9.6, '照片按拍摄时间分成「**同一刻**」：规则判断，不是 AI。')
band('A2a', 0.4, 7.4, '拍摄时间来自照片自带的信息；**AI 在本机判断视角**：人海。')
band('A2b', 0.2, 2.4, '照片不上传。')
band('A3', 0.4, 4.8, '没把握，它就说「不确定」，**选择权在你**。')
band('M1', 0.5, 5.0, '**同一刻的另一面**：按拍摄时间配对，理由写得明明白白。')
band('M1', 5.2, 9.6, '配对和理由是规则算的，**不是 AI**。')
band('M2', 0.5, 7.0, '要换，就指定具体的**两张**照片，并明确同意。')
band('M2', 7.4, 14.6, '对方同意，才会交换；示例角色会自动回应。')
if not NO_M3:
    band('M3', 0.4, 9.6, '完整版：真实房间里，两个人各自的设备。')
band('S1', 0.5, 7.2, '愿意认识，才继续聊：先招手，**对方同意**，才能私聊。')
band('S1', 7.6, 14.6, '示例角色的回应是自动的，不会学习。')
band('S2', 0.2, 2.3, '想安静的人，不会被打扰。')
band('S3a', 0.3, 4.8, '散场以后，聊天室里还有专辑杯……')
band('S3b', 0.3, 4.8, '……和默契局。')
band('K1a', 0.4, 5.6, '散场了，把这一晚**留在手里**。')
band('K2', 0.3, 4.8, '还可以去「音乐探索」，沿真实的合唱关系找音乐。')
# persistent disclosure on every product shot (bottom-right of the caption band).  Never two notes at the same time: the two-device shots get one combined note.
STD = '示例现场 · 角色与照片为虚构 · 照片不上传'
DUO = '演示：同一台电脑上的两个独立浏览器身份 · 非 Pages 在线版'
duo = []                                                    # time ranges of two-device (Node) footage
if not NO_M3: duo.append((starts['M3'], starts['M3'] + 10))
if S1_DUO: duo.append((starts['S1'], starts['S1'] + 15))
merged = []
for a, b in sorted(duo):
    if merged and abs(merged[-1][1] - a) < 1e-6: merged[-1] = (merged[-1][0], b)
    else: merged.append((a, b))
cursor = starts['E1']
for a, b in merged:
    if a > cursor: note(cursor, a, STD)
    note(a, b, DUO); cursor = b
note(cursor, starts['C'] - 0.3, STD)

tl = dict(title='Music Space - 同一刻，另一面。', output='out/space-v2-rehearsal.mp4', size=[1920, 1080], fps=60, crf=18, preset='slow', band_color='#182d26',
          music=dict(file='../music/original-v2/space-original-v2_-16LUFS_48k24.wav', start=0, delay=0, fade_in=0.6, fade_out=3.5, target_lufs=-16),
          sfx=[], shots=S, subtitles=subs,
          overlays=[dict(id='h-shade', kind='still', src='../cards/out/h-shade.png', start=9.9, dur=3.1, fade_in=0.6, fade_out=0, shot='H0'),
                    dict(id='h-lockup', kind='video', src='../cards/out/h-lockup.mov', start=10.0, shot='H0')],
          meta=dict(total_s=TOTAL, grid='2.5 s bars at 96 BPM', note='generated by make-timeline-v2.py'))
out = 'timeline.v2.noM3.json' if NO_M3 else 'timeline.v2.json'
if NO_M3: tl['output'] = 'out/space-v2-rehearsal-noM3.mp4'
json.dump(tl, open(out, 'w'), indent=1, ensure_ascii=False)
print(out, 'total', TOTAL, 'shots', len(S), 'subs', len(subs))
for s in S: print(f"{starts[s['id']]:7.1f}  {s['dur']:5.1f}  {s['id']:4s} {s['title']}")
