#!/usr/bin/env python3
"""Plan A cut: the LIVE 0.16 page (main@54f3e6e, https://musicmapteam.github.io/musicSpace/), recorded from a byte-identical local mirror.
Generates assembly/timeline.planA.json on the same 96 BPM / 2.5 s bar grid as the Route B cut (score: music/gen_original_v2.py with music/score-config.planA.json).
Take marks (clips/planA/*.marks.json) give the exact in-points of the sub-shots cut from the long takes PA-M and PA-L.
Run:  python3 make-timeline-planA.py [--no-hook-shade]
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
def marks(n): return json.load(open(os.path.join(HERE, '..', 'clips', 'planA', n + '.marks.json')))
M, L = marks('PA-M'), marks('PA-L')
def card(p): return f'../cards/out/{p}.mp4'
def clip(i): return f'../clips/planA/{i}.mp4'
S = []
def add(id, title, src, dur, **kw): S.append(dict(id=id, title=title, src=src, dur=dur, **kw))
FINAL = 'FINAL (live 0.16 page)'
add('H0', 'HOOK: the courtyard at dusk, real camera glides (photo wall -> desk -> record shelf) + title lockup', clip('PA-H0'), 12.5, layout='full', status=FINAL)
add('P1', 'Pain 1: you shot the stage, she remembers the crowd', card('card-b-pain-dusk'), 5, layout='full', status='CARD (final)', footage=False, transition_in=dict(type='fade', dur=0.5))
add('P2', 'Pain 2: group album, 99+ shots, no way to tell the same moment', card('card-b2-groupalbum-dusk'), 5, layout='full', status='CARD (final)', footage=False)
add('Q', 'What if: the other side comes back, by consent', card('card-d-whatif-dusk'), 5, layout='full', status='CARD (final)', footage=False, transition_in=dict(type='fade', dur=0.3))
add('A1', 'Front door -> 体验示例 -> demo room on the 3D photo wall', clip('PA-A1'), 10, status=FINAL)
add('A2', 'Own photo: capture time from EXIF + 「AI 判断：舞台」 + song + save', clip('PA-A2'), 22.5, status=FINAL, transition_in=dict(type='slideleft', dur=0.4))
add('A3', 'The honest case: 「不确定，请选择」', clip('PA-A3'), 7.5, status=FINAL, transition_in=dict(type='slideleft', dur=0.4))
add('M1', '「同一刻的另一面」 + reason (rules, not AI)', clip('PA-M'), 7.5, **{'in': M['m1']}, status=FINAL, transition_in=dict(type='slideleft', dur=0.4))
add('M2', 'Send -> 切到阿遥 -> reason flips -> 同意交换', clip('PA-M'), 12.5, **{'in': M['m2']}, status=FINAL, transition_in=dict(type='slideleft', dur=0.4))
add('D1', 'Double-ticket ceremony -> 保存双联图片 -> 1600x1800 PNG', clip('PA-M'), 7.5, **{'in': M['d1']}, status=FINAL)
add('K1', 'The real exported ticket PNG flies in', card('card-k-ticket-A'), 5, layout='full', status='CARD (real PNG from the live page)', footage=False, transition_in=dict(type='fade', dur=0.3))
add('L1', '那晚的歌单 (QQ 音乐搜索 link, not playback)', clip('PA-L'), 7.5, **{'in': L['l1']}, status=FINAL, transition_in=dict(type='slideleft', dur=0.4))
add('K2', '收藏: the stored duet memory on the 3D shelf', clip('PA-L'), 5, **{'in': L['k2']}, status=FINAL)
add('AB', '关于: what is real, what is fictional', clip('PA-L'), 2.5, **{'in': L['about']}, status=FINAL)
add('C', 'End card: Music Space · 同一刻，另一面。· link · QR', card('card-c-end-A'), 10, layout='full', status='CARD (final)', footage=False, transition_in=dict(type='fade', dur=0.5))

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
subs.append(dict(start=0.9, end=5.2, text='示例角色与照片均为虚构（AI 生成）', style='note'))
band('A1', 0.5, 9.6, '打开链接就能进，不用安装；先用示例走完整个流程。')
band('A2', 0.5, 4.8, '做一张现场卡：选一张自己的照片。')
band('A2', 5.0, 9.8, '拍摄时间从照片里读出来；**AI 在本机判断视角**：舞台。')
band('A2', 10.0, 14.2, '照片不上传（首次要下载约 10 MB 的小模型）。')
band('A2', 14.6, 18.6, '歌名选填，会排进「那晚的歌单」。')
band('A2', 18.9, 22.3, '现场卡默认私藏，只有自己看得到。')
band('A3', 0.3, 7.2, '没把握，它就说「不确定」，**选择权在你**。')
band('M1', 0.3, 4.6, '**同一刻的另一面**：按拍摄时间配对，理由写得明明白白。')
band('M1', 4.9, 7.3, '配对和理由是规则，**不是 AI**。')
band('M2', 0.3, 6.2, '申请指向具体的**两张**卡；Lin 与阿遥是虚构角色。')
band('M2', 6.6, 12.3, '对方本人同意，才会交换。')
band('D1', 0.3, 7.2, '两人署名的双联票根，在你的浏览器里生成。')
band('L1', 0.3, 7.2, '歌单按拍摄时间排；QQ 音乐链接只是搜索，不是站内播放。')
band('K2', 0.3, 4.8, '记忆只存在这台设备的浏览器里。')
band('AB', 0.1, 2.4, '示例是虚构的；AI 只建议视角。')
STD = '示例现场 · Lin 与阿遥为虚构角色 · 照片不上传'
note(starts['A1'], starts['C'] - 0.3, STD)

tl = dict(title='Music Space - 同一刻，另一面。 (Plan A: live 0.16 page)', output='out/space-planA.mp4', workdir='work-planA', size=[1920, 1080], fps=60, crf=18, preset='slow',
          band_color='#17133a', theme=dict(accent='#f2a2c1'),
          music=dict(file='../music/original-planA/space-original-v2_-16LUFS_48k24.wav', start=0, delay=0, fade_in=0.6, fade_out=3.5, target_lufs=-16),
          sfx=[], shots=S, subtitles=subs,
          overlays=[dict(id='h-shade', kind='still', src='../cards/out/h-shade-A.png', start=9.9, dur=3.1, fade_in=0.6, fade_out=0, shot='H0'),
                    dict(id='h-lockup', kind='video', src='../cards/out/h-lockup-A.mov', start=10.0, shot='H0')],
          meta=dict(total_s=TOTAL, grid='2.5 s bars at 96 BPM', note='generated by make-timeline-planA.py', starts=starts))
json.dump(tl, open(os.path.join(HERE, 'timeline.planA.json'), 'w'), indent=1, ensure_ascii=False)
print('timeline.planA.json total', TOTAL, 'shots', len(S), 'subs', len(subs))
for s in S: print(f"{starts[s['id']]:7.1f}  {s['dur']:5.1f}  {s['id']:4s} {s['title']}")
