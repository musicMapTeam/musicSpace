# Music Space · Doodle video · narration script (kinetic typography = the subtitle track)

Draft 1 · 2026-10-07 · for the capture, motion/typography, music and assembly passes.

> **Changed 2026-10-07 (film v2, the owner's decisions; this file was hand-edited — `src/edit_data.py` / `out/timeline.json` still hold
> draft 1, the scenes carry the v2 text as `DM.say(..., { text })` overrides, so this file is the source of truth for v2):**
> 1. **Positioning:** the music community is the **Livehouse's** own — a venue runs Music Space to keep its local music community,
>    which gives it a reason to promote it to its audience. T104–T106 (bars 65–67) now say so; bars 73–76 (T120–T125) tell the
>    venue story over new host-side footage (TAKE-H: 主办方 / 开一个现场 · 场地, the venue's 长期音乐社群, 发布活动预告). The
>    「设想 · QQ音乐、酷狗」 vision sheet is gone (the owner's new positioning replaces it; no platform name appears any more).
> 2. **「去掉那些说明性文字，这个产品必须是完整的」:** every explanatory / disclaimer overlay is gone from the picture — T025 「照片为 AI
>    生成的示例图」 (and its copies in every act), T049 / T094 「示例角色 · 自动回复」, T053 「示例照片 · 拍摄时间为虚构」, T100
>    「原创虚构专辑」, the magnified 「示例站」 footer in W5 and the end-card block T145. **One small credits line** stays on the end
>    card (T146): 「演示角色与照片为虚构，照片由 AI 生成 · 配乐：<track>（CC0）」.
> 3. **Review fixes (v1 → v2):** T021/T022 swapped (you shot the crowd, TA the stage: the same pair the exchange trades in A4),
>    T072 from 42:1, T096 the product's own words 「不接收新招呼。」, T126s / T127s the product's privacy and consent words.
> Rows marked **changed** / **removed** below; reading time, layering and glyphs of the new lines are checked by the film QC
> (`prod/out/qc-v2.json`), not by `make.sh`.

Written against the restyled production build in `/Users/alakazan/workplace/tme/musicSpace/dist-pages` (About panel: 版本 0.22.0-rc.1 · 提交 7cbe4d3 · 构建于 2026-10-06 19:33 UTC; the Doodle restyle is uncommitted working-tree code inside that build). I walked the judge route on it in system Chrome on 2026-10-07 (phone 1080×2340, desktop 1920×1080). Every product string quoted here was read off that build.

**中文摘要（给产品负责人）**：整片约 **2 分 54 秒**（124 BPM 下 90 小节，可加 1 小节尾声到 2:56）。没有配音，**画面里的动态文字就是讲解和字幕**：87 句短句，大多 3–8 个字（最长 12 个字），每句都卡在拍点上，重点词放大、变色。结构：钩子（8 个真实产品画面按拍点拼贴，然后「同一刻，另一面。」）→ 痛点（只有自己那一面／最好看的那张你在陌生人手机里／身边的人还没认识就走散）→ 产品（进同一间 Livehouse、换装、拍照上墙、端侧 AI 判断「人海」、没把握就说「不确定」、规则按拍摄时间配「同一刻」）→ 交换（「同一刻的另一面」、双方同意、**「交换已接受」落在全片最大的鼓点上**）→ 交换之后（招手、私聊、安静的人不被打扰、散场聊天室、专辑世界杯、默契局、社群、创作角、纪念卡、我的空间）→ 为什么值得做（**2026-10-07 改**：Livehouse 开个房，乐迷留在本地社群；下一场的预告直接发给社群；场地有了自己的乐迷，更愿意推广；隐私／同意／好玩；「曲终，人不散。」）→ 片尾（链接 + 二维码 + 一行署名）。**2026-10-07 起画面不再出现任何说明性小字**（AI 示例图、示例角色、虚构时间等标注全部去掉），只在片尾保留一行署名。每句话都有产品依据（第 4 节）；「什么都不会离开你的设备，直到双方同意」这句**不准确**，已换成产品里真实的说法（见第 4 节）。

## 0. In one look

| | |
|---|---|
| Runtime | **90 bars at 124 BPM = 2:54.19** (bar 1.9355 s); optional tail bar 91 → 2:56.13. Brief: 2:50–2:58 ✓ |
| Narration | **87 lines** (kind `title`) + 30 labels, notes and fine print, all burned in as kinetic type; no voice-over. Same text as SRT: `out/narration-124.srt` (QC, optional soft subtitles) |
| Line length | 3–8 characters for 78 of the 87 lines, the longest 12; key word marked 【】 for colour and size |
| Reading time | every narration line ≥ 0.25 s per unit (one Chinese character, or one Latin/number run) and ≥ 0.9 s; max 2 layered titles + 1 plain line on screen at once (checked, §5) |
| Rhythm | every line enters on the beat grid (titles mostly on beats 1 and 3, a few on the music's syncopated hits; stickers on 2/4 or 8ths); the longest gap between visual events is 2.5 beats (1.21 s at 124 BPM) |
| Retime | positions are bar:beat; `retime.py` converts them to seconds for any tempo, a beat map, or a shorter/longer cut (STORYBOARD §5) |

## 1. How to read the tables

- **Position** `bar:beat`, 1-based, 4/4. `33:3` = bar 33 beat 3; `4:4.5` = the 8th after beat 4. `in → out`: the line appears on `in` and is gone on `out`.
- **Seconds at 124 BPM** (first downbeat at 0 s): `t = (bar − 1) × 1.93548 + (beat − 1) × 0.48387`. For another tempo or a real beat map: `python3 retime.py --bpm 118 --offset 0.42` or `--beatmap beatmap.json` (STORYBOARD §5).
- **【 】** = the key word: set it larger (1.4× for 1–2 characters, 1.25× for 3, 1.2× for 4 or more, so long keys still fit) and in a marker colour with an ink outline (recipes `key-pink`, `key-mint`, `key-yellow`), or as a sticker/highlight as the style column says. Everything else in the line stays ink.
- **Line breaks** are part of the design: ` / ` in the tables (and `｜` in the read-through, `\n` in `timeline.json`) is a forced break; every line was checked to fit its layout zone at its size (§5).
- **Fonts** (raw TTFs in `/tmp/music-space-font-cache/`, all OFL/Apache): `D` display.ttf 站酷庆科黄油体 (titles) · `M` marker.ttf 霞鹜漫黑 (plain lines, stickers, chips) · `H` hand.ttf 悠哉 (fine print) · `N` note.ttf 龙藏体 (handwritten notes) · `L` logo.ttf Luckiest Guy (MUSIC SPACE only; it is all caps) · `G` digits.ttf 得意黑 (times, numbers, the link). Sizes are font-size at 1920×1080: XXL 240 · XL 180 · L 128 · M 84 · S 56 · XS 36.
- **Recipes** (STORYBOARD §1.3 has the CSS): `ink-pink` / `ink-mint` / `ink-yellow` = ink text with a hard offset shadow in that colour (the product's `.ds-title`); `st-*` = sticker word (colour fill, ink outline, ink shadow; `.ds-sticker`); `hl-mint` = ink on a mint highlighter band (`.ds-hl`); `ink-dashed` = key word inside a dashed marker outline (mirrors the product's 「不确定」 chip); `digits` = 得意黑 with a yellow highlighter band and pink offset; `stamp-*` = rubber stamp, rotated 6–8°; `chip` = pill label; `note-pink` = handwritten pink note, tilted −4°; `logo` = the product wordmark recipe; `pillar-*` = big sticker word on a coloured card; `link-pill` = paper pill with ink border; `ink` / `fine` = plain.
- **Entrances** (STORYBOARD §1.6 has frame counts): `SLAM` · `POP` · `TYPE` (characters on 16ths) · `STAMP` · `SWIPE` (highlighter) · `DRAW` (marker stroke) · `DROP`. Lines leave on the cut, or pop out in 4 frames.
- **Kinds**: rows marked *(label)*, *(note)*, *(fine)* are small graphic text (stamps, chips, captions, small print) and do not count toward the two-title limit; reading time is checked for titles and notes.

## 2. The narration, act by act

### A0 · HOOK 钩子 — bars 1–8 · 0:00.00–0:15.48

*8-hit collage of real product moments, then the title 「同一刻，另一面。」 and a match cut into the real landing page*

| ID | in → out (bar:beat) | @124 BPM | 文字（【】= 重点词：放大、变色） | 字体 / 字号 / 配方 | 位置 | 入场 | 字数 · 秒/字 |
|---|---|---|---|---|---|---|---|
| T001 | 1:1 → 4:4.5 | 0:00.00–0:07.50 | 进场 *(label)* | M 56px · stamp-yellow | on CUT-01 | STAMP | 2 · 3.75 |
| T002 | 1:3 → 4:4.5 | 0:00.97–0:07.50 | 换装 *(label)* | M 56px · stamp-pink | on CUT-02 | STAMP | 2 · 3.27 |
| T003 | 2:1 → 4:4.5 | 0:01.94–0:07.50 | 上墙 *(label)* | M 56px · stamp-mint | on CUT-03 | STAMP | 2 · 2.78 |
| T004 | 2:3 → 4:4.5 | 0:02.90–0:07.50 | 视角 *(label)* | M 56px · stamp-yellow | on CUT-04 | STAMP | 2 · 2.30 |
| T005 | 3:1 → 4:4.5 | 0:03.87–0:07.50 | 同一刻 *(label)* | M 56px · stamp-pink | on CUT-05 | STAMP | 3 · 1.21 |
| T006 | 3:3 → 4:4.5 | 0:04.84–0:07.50 | 交换 *(label)* | M 56px · stamp-mint | on CUT-06 | STAMP | 2 · 1.33 |
| T007 | 4:1 → 4:4.5 | 0:05.81–0:07.50 | 招手 *(label)* | M 56px · stamp-yellow | on CUT-07 | STAMP | 2 · 0.85 |
| T008 | 4:3.5 → 4:4.5 | 0:07.02–0:07.50 | 留念 *(label)* | M 56px · stamp-pink | on CUT-08 | STAMP | 2 · 0.24 |
| T010 | 5:1 → 8:1 | 0:07.74–0:13.55 | 同一刻， | D 240px · ink-pink | card, left, upper line | SLAM | 3 · 1.94 |
| T011 | 5:3 → 8:1 | 0:08.71–0:13.55 | **【另一面。】** | D 240px · hl-mint | card, left, lower line | SLAM+SWIPE | 3 · 1.61 |
| T012 | 6:1 → 8:1 | 0:09.68–0:13.55 | MUSIC SPACE *(label)* | L 128px · logo | card, right, tilted +4 deg | POP | 2 · 1.94 |
| T013 | 6:2 → 8:1 | 0:10.16–0:13.55 | 和同场的人，**【交换】**彼此的视角。 | M 84px · ink | card, bottom | TYPE | 12 · 0.28 |

### A1 · PAIN 痛点 — bars 9–20 · 0:15.48–0:38.71

*after the show: only your own angle; the best photo of you is on a stranger's phone; the people next to you are gone; turn: what if it could be swapped back?*

| ID | in → out (bar:beat) | @124 BPM | 文字（【】= 重点词：放大、变色） | 字体 / 字号 / 配方 | 位置 | 入场 | 字数 · 秒/字 |
|---|---|---|---|---|---|---|---|
| T020 | 9:1 → 10:1 | 0:15.48–0:17.42 | 散场了。 | D 180px · ink-pink | top centre | SLAM | 3 · 0.65 |
| ~~T025~~ | — | — | ~~照片为 AI 生成的示例图~~ *(fine)* — **removed 2026-10-07** (owner: no explanatory overlays; the end-card credits line T146 carries it) | | | | |
| T021 | 9:3 → 11:1 | 0:16.45–0:19.35 | 你拍了**【人海】**， — **changed 2026-10-07** (v1 「舞台」) | D 128px · ink-pink | top band, left | SLAM | 5 · 0.58 |
| T022 | 10:1 → 11:1 | 0:17.42–0:19.35 | TA 拍了**【舞台】**。 — **changed 2026-10-07** (v1 「人海」) | D 128px · ink-mint | top band, right | SLAM | 5 · 0.39 |
| T023 | 11:1 → 13:1 | 0:19.35–0:23.23 | 每部手机里， | M 84px · ink | bottom left | TYPE | 5 · 0.77 |
| T024 | 11:3 → 13:1 | 0:20.32–0:23.23 | 只有**【自己】**那一面。 | D 128px · ink-pink | bottom | SLAM | 7 · 0.41 |
| T026 | 13:1 → 15:1 | 0:23.23–0:27.10 | 最好看的那张你， | D 128px · ink-pink | top left | SLAM | 7 · 0.55 |
| T027 | 14:1 → 15:3 | 0:25.16–0:28.06 | 在**【陌生人】**的手机里。 | D 128px · ink-pink | top right | SLAM | 8 · 0.36 |
| T028 | 15:3 → 17:1 | 0:28.06–0:30.97 | 散场后， | M 84px · ink | bottom left | TYPE | 3 · 0.97 |
| T029 | 16:1 → 17:1 | 0:29.03–0:30.97 | **【找不回来】**。 | D 180px · ink-pink | bottom | SLAM | 4 · 0.48 |
| T030 | 17:1 → 18:3 | 0:30.97–0:33.87 | 站在你身边的人， | D 128px · ink-pink | top | SLAM | 7 · 0.41 |
| T031 | 18:1 → 19:3 | 0:32.90–0:35.81 | 还没认识，就**【走散】**了。 | D 128px · ink-pink | top, second line | SLAM | 8 · 0.36 |
| T032 | 19:1 → 20:1 | 0:34.84–0:36.77 | 要是…… | M 128px · ink | top left | TYPE | 2 · 0.97 |
| T033 | 19:3 → 21:1 | 0:35.81–0:38.71 | 能把那一面，**【换回来】**？ | D 128px · ink-pink | top | SLAM | 8 · 0.36 |

### A2 · ENTER 入场 — bars 21–28 · 0:38.71–0:54.19

*the product: back into the same livehouse, your illustrated avatar, choose how to take part, see who was there (labelled 示例)*

| ID | in → out (bar:beat) | @124 BPM | 文字（【】= 重点词：放大、变色） | 字体 / 字号 / 配方 | 位置 | 入场 | 字数 · 秒/字 |
|---|---|---|---|---|---|---|---|
| T041 | 21:1 → 23:1 | 0:38.71–0:42.58 | 同场的人， | D 180px · ink-mint | right column, upper | SLAM | 4 · 0.97 |
| T042 | 21:3 → 23:1 | 0:39.68–0:42.58 | 再进**【同一间】** / Livehouse。 | D 128px · ink-mint | right column, lower | SLAM | 6 · 0.48 |
| T043 | 23:1 → 25:1 | 0:42.58–0:46.45 | 带上你的**【小人】**， | D 128px · ink-pink | right column | SLAM | 6 · 0.65 |
| T044 | 24:1 → 25:1 | 0:44.52–0:46.45 | 今晚，我这样。 *(note)* | N 84px · note-pink | next to the phone top, tilted -4 deg | TYPE | 5 · 0.39 |
| T045 | 25:1 → 26:1 | 0:46.45–0:48.39 | 愿意打招呼， | D 128px · ink-pink | right column, with arrow to the option | SLAM | 5 · 0.39 |
| T046 | 25:3 → 27:1 | 0:47.42–0:50.32 | 还是 / **【安静参与】**？ | D 128px · ink-mint | right column | SLAM | 6 · 0.48 |
| T047 | 26:1 → 27:1 | 0:48.39–0:50.32 | **【自己选】**。 | D 128px · st-yellow | right column, sticker | POP | 3 · 0.65 |
| T048 | 27:1 → 29:1 | 0:50.32–0:54.19 | 看看**【谁】**也在。 | D 128px · ink-pink | bottom left on a paper card | SLAM | 5 · 0.77 |
| ~~T049~~ | — | — | ~~示例角色 · 自动回复~~ *(label)* — **removed 2026-10-07** | | | | |

### A3 · PHOTO + AI 照片与端侧 AI — bars 29–40 · 0:54.19–1:17.42

*put a photo on the wall: EXIF time, on-device AI suggests the side (人海), honest 不确定, rules group 同一刻 (<=3 min), not AI*

| ID | in → out (bar:beat) | @124 BPM | 文字（【】= 重点词：放大、变色） | 字体 / 字号 / 配方 | 位置 | 入场 | 字数 · 秒/字 |
|---|---|---|---|---|---|---|---|
| T050 | 29:1 → 30:1 | 0:54.19–0:56.13 | 放一张你的照片。 | D 128px · ink-yellow | left column | SLAM | 7 · 0.28 |
| T051 | 30:1 → 31:1 | 0:56.13–0:58.06 | **【21:48】** | G 240px · digits | left column | POP | 1 · 1.94 |
| T052 | 30:1 → 31:3 | 0:56.13–0:59.03 | 拍摄时间， / 照片**【自己记得】**。 | D 128px · ink-yellow | left column, under the time | SLAM | 10 · 0.29 |
| ~~T053~~ | — | — | ~~示例照片 · 拍摄时间为虚构~~ *(label)* — **removed 2026-10-07** | | | | |
| T054 | 31:1 → 32:1 | 0:58.06–1:00.00 | 拍的是哪一面？ | D 128px · ink-pink | left column | SLAM | 6 · 0.32 |
| T055 | 32:1 → 33:1 | 1:00.00–1:01.94 | **【人海】**。 | D 240px · ink-pink | left column | SLAM | 2 · 0.97 |
| T056 | 32:3 → 33:3 | 1:00.97–1:02.90 | AI 在本机判断， | M 84px · ink | left column, lower | TYPE | 6 · 0.32 |
| T057 | 33:1 → 34:1 | 1:01.94–1:03.87 | 照片**【不上传】**。 | D 128px · ink-mint | left column, with a padlock doodle | SLAM | 5 · 0.39 |
| T058 | 33:3 → 34:3 | 1:02.90–1:04.84 | 没把握的时候， | M 84px · ink | left column | TYPE | 6 · 0.32 |
| T059 | 34:1 → 35:1 | 1:03.87–1:05.81 | 它就说**【不确定】**。 | D 128px · ink-dashed | left column (key word in a dashed outline) | SLAM | 6 · 0.32 |
| T060 | 34:3 → 35:3 | 1:04.84–1:06.77 | **【你】**来选。 | D 128px · st-yellow | left column, sticker | POP | 3 · 0.65 |
| T061 | 35:1 → 36:1 | 1:05.81–1:07.74 | 保存，**【上墙】**。 | D 128px · ink-pink | left column | SLAM | 4 · 0.48 |
| T062 | 36:3 → 37:1 | 1:08.71–1:09.68 | 上墙啦！ *(note)* | N 84px · note-pink | arrow to the new polaroid on the 3D wall | TYPE | 3 · 0.32 |
| T063 | 37:1 → 38:3 | 1:09.68–1:12.58 | 按**【拍摄时间】**， | D 128px · ink-yellow | left column | SLAM | 5 · 0.58 |
| T065 | 38:1 → 39:1 | 1:11.61–1:13.55 | **【3 分钟】**以内， | G 128px · digits | left column, second line | POP | 5 · 0.39 |
| T064 | 38:3 → 39:3 | 1:12.58–1:14.52 | 就是**【同一刻】**。 | D 128px · ink-mint | left column, third line | SLAM | 5 · 0.39 |
| T066 | 39:1 → 40:1 | 1:13.55–1:15.48 | 规则判断，不是 AI。 | M 84px · stamp-mint | left column, rotated 6 deg | STAMP | 7 · 0.28 |
| T067 | 40:1 → 41:1 | 1:15.48–1:17.42 | 看这里！ *(note)* | N 84px · note-pink | arrow to the badge | TYPE | 3 · 0.65 |

### A4 · SAME MOMENT + EXCHANGE 同一刻与交换 — bars 41–54 · 1:17.42–1:44.52

*同一刻的另一面: you shot the crowd, TA shot the stage; request with consent; pending; 交换已接受 payoff; revocable*

| ID | in → out (bar:beat) | @124 BPM | 文字（【】= 重点词：放大、变色） | 字体 / 字号 / 配方 | 位置 | 入场 | 字数 · 秒/字 |
|---|---|---|---|---|---|---|---|
| T070 | 41:1 → 43:1 | 1:17.42–1:21.29 | 你拍**【人海】**， | D 180px · ink-mint | top left (above your polaroid) | SLAM | 4 · 0.97 |
| T071 | 41:3 → 43:1 | 1:18.39–1:21.29 | TA 拍**【舞台】**。 | D 180px · ink-pink | top right (above TA's polaroid) | SLAM | 4 · 0.73 |
| T072 | 42:1 → 43:1 | 1:19.35–1:21.29 | 不到 1 分钟 *(label)* — **changed 2026-10-07** (from 42:1; the polaroids print 21:48:10 / 21:47:20) | G 84px · digits | on the bracket between the times | DRAW | 5 · 0.39 |
| T073 | 43:1 → 45:1 | 1:21.29–1:25.16 | 同一刻的 | D 180px · ink-pink | left column, line 1 | SLAM | 4 · 0.97 |
| T074 | 43:3 → 45:1 | 1:22.26–1:25.16 | **【另一面】**。 | D 180px · st-pink | left column, line 2 | SLAM | 3 · 0.97 |
| T075 | 45:1 → 46:1 | 1:25.16–1:27.10 | 用我拍下的， | D 128px · ink-pink | left column | SLAM | 5 · 0.39 |
| T076 | 45:3 → 46:3 | 1:26.13–1:28.06 | 换 **【TA 看到的】**。 | D 128px · ink-pink | left column | SLAM | 5 · 0.39 |
| T077 | 46:1 → 47:1 | 1:27.10–1:29.03 | 换不换， | M 84px · ink | left column | TYPE | 3 · 0.65 |
| T078 | 46:3 → 47:3 | 1:28.06–1:30.00 | **【你们俩】**说了算。 | D 128px · ink-mint | left column | SLAM | 6 · 0.32 |
| T079 | 47:1 → 48:1 | 1:29.03–1:30.97 | 我同意， | D 128px · ink-mint | left column, with check doodle | SLAM | 3 · 0.65 |
| T080 | 47:3 → 48:3 | 1:30.00–1:31.94 | 交给 TA 确认。 | M 84px · ink | left column, plus a drawn ↗ arrow doodle | TYPE | 5 · 0.39 |
| T081 | 48:1 → 49:1 | 1:30.97–1:32.90 | 还要 **【TA】** / 也同意。 | D 128px · ink-pink | left column | SLAM | 6 · 0.32 |
| T082 | 49:1 → 51:1 | 1:32.90–1:36.77 | 双方同意， | D 180px · ink-mint | left column | SLAM | 4 · 0.97 |
| T083 | 49:3 → 51:1 | 1:33.87–1:36.77 | 才**【交换】**。 | D 180px · ink-pink | left column | SLAM | 3 · 0.97 |
| T084 | 52:1 → 53:3 | 1:38.71–1:41.61 | 同一刻， | D 128px · ink-pink | left column | SLAM | 3 · 0.97 |
| T085 | 52:3 → 53:3 | 1:39.68–1:41.61 | **【两面】** / 都齐了。 | D 180px · ink-mint | left column | SLAM | 5 · 0.39 |
| T086 | 53:3 → 54:3 | 1:41.61–1:43.55 | 随时可以**【撤销】**。 | D 128px · ink-mint | left column | SLAM | 6 · 0.32 |
| T087 | 54:1 → 55:1 | 1:42.58–1:44.52 | 然后呢？ | D 240px · ink-pink | centre (paper card) | DROP | 3 · 0.65 |

### A5 · AFTER THE SWAP 交换之后 — bars 55–72 · 1:44.52–2:19.35

*greet -> friends, private chat, the quiet rule, after-show chat room, album World Cup, 默契局, community, creation corner, memory card, My Space*

| ID | in → out (bar:beat) | @124 BPM | 文字（【】= 重点词：放大、变色） | 字体 / 字号 / 配方 | 位置 | 入场 | 字数 · 秒/字 |
|---|---|---|---|---|---|---|---|
| T090 | 55:1 → 56:3 | 1:44.52–1:47.42 | 先**【招招手】**， | D 128px · ink-yellow | right column | SLAM | 4 · 0.73 |
| T091 | 56:1 → 57:3 | 1:46.45–1:49.35 | 对方愿意， / 才成**【朋友】**。 | D 128px · ink-pink | right column | SLAM | 8 · 0.36 |
| T092 | 57:1 → 58:3 | 1:48.39–1:51.29 | **【私聊】**， | D 180px · ink-pink | right column | SLAM | 2 · 1.45 |
| T093 | 57:3 → 59:1 | 1:49.35–1:52.26 | 从返场那首聊起。 | M 84px · ink | right column | TYPE | 7 · 0.41 |
| ~~T094~~ | — | — | ~~示例角色 · 自动回复~~ *(label)* — **removed 2026-10-07** | | | | |
| T095 | 59:1 → 60:1 | 1:52.26–1:54.19 | 想安静的人， | D 128px · ink-mint | bottom left on a paper card | SLAM | 5 · 0.39 |
| T096 | 59:3 → 60:3 | 1:53.23–1:55.16 | **【不接收新招呼】**。 — **changed 2026-10-07** (the product's own words; v1 「不会被打扰」 promised more) | D 128px · ink-mint | bottom left, second line | SLAM | 6 · 0.32 |
| T097 | 60:1 → 61:3 | 1:54.19–1:57.10 | 散场以后， / **【继续聊】**。 | D 128px · ink-yellow | right column | SLAM | 7 · 0.41 |
| T098 | 61:1 → 62:3 | 1:56.13–1:59.03 | 今晚的 / **【专辑世界杯】**， | D 128px · ink-pink | left column | SLAM | 8 · 0.36 |
| ~~T100~~ | — | — | ~~原创虚构专辑~~ *(label)* — **removed 2026-10-07** | | | | |
| T099 | 62:1 → 63:1 | 1:58.06–2:00.00 | 选一张，一起聊。 | M 84px · ink | left column | TYPE | 6 · 0.32 |
| T101 | 63:1 → 64:1 | 2:00.00–2:01.94 | **【默契局】**： | D 128px · ink-yellow | left column | SLAM | 3 · 0.65 |
| T102 | 63:3 → 65:1 | 2:00.97–2:03.87 | 揭晓前，谁也看不到。 | M 84px · ink | left column | TYPE | 8 · 0.36 |
| T103 | 64:1 → 65:1 | 2:01.94–2:03.87 | **【选到一起】**了！ | D 128px · ink-pink | left column | SLAM | 5 · 0.39 |
| T104 | 65:1 → 66:1 | 2:03.87–2:05.81 | Livehouse 的 / **【长期社群】**， — **changed 2026-10-07** (the venue's community) | D 128px · ink-mint | right column | SLAM | 6 · 0.32 |
| T105 | 65:3 → 67:1 | 2:04.84–2:07.74 | 也给你 / 留一个**【位置】**。 — **changed 2026-10-07** (+给你; on to 67:1, moves to the top slot on 66:1) | M 128px · ink-mint | right column | SLAM | 8 · 0.36 |
| T106 | 66:1 → 67:1 | 2:05.81–2:07.74 | 再见， / 在**【下一场】**。 | D 128px · ink-pink | right column | SLAM | 6 · 0.32 |
| T107 | 67:1 → 68:1 | 2:07.74–2:09.68 | **【创作角】**： | D 128px · ink-mint | right column | SLAM | 3 · 0.65 |
| T108 | 67:3 → 68:3 | 2:08.71–2:10.65 | 对方点头，才开始。 | M 84px · ink | right column | TYPE | 7 · 0.28 |
| T109 | 68:1 → 69:3 | 2:09.68–2:12.58 | 把这一晚， / **【留在手里】**。 | D 128px · ink-pink | right column | SLAM | 8 · 0.36 |
| T110 | 69:3 → 70:3 | 2:12.58–2:14.52 | **【纪念卡】**， | D 128px · ink-yellow | left of the flying card | SLAM | 3 · 0.65 |
| T111 | 70:1 → 71:3 | 2:13.55–2:16.45 | 在你的浏览器里生成。 | M 84px · ink | under the card | TYPE | 9 · 0.32 |
| T112 | 71:1 → 72:3 | 2:15.48–2:18.39 | 散场后， / 仍有**【地方回来】**。 | D 128px · ink-mint | right column | SLAM | 9 · 0.32 |

### A6 · WHY IT MATTERS 为什么值得做 — bars 73–82 · 2:19.35–2:38.71

*(**changed 2026-10-07**) the venue: a Livehouse opens a room, its fans stay in its local community, the next show's preview goes straight to the community, so the venue has its own fans and promotes Music Space; privacy, consent, fun; 「曲终，人不散。」; one person can try it now*

| ID | in → out (bar:beat) | @124 BPM | 文字（【】= 重点词：放大、变色） | 字体 / 字号 / 配方 | 位置 | 入场 | 字数 · 秒/字 |
|---|---|---|---|---|---|---|---|
| T120 | 73:1 → 75:1 | 2:19.35–2:23.23 | Livehouse 开个房， — **changed 2026-10-07** | D 128px · ink-pink (个 from the product's patched Display slice) | top left (phone: 主办方 / 开一个现场, 场地 「月台 Livehouse」) | SLAM | 4 · 0.97 |
| T121 | 73:3 → 75:1 | 2:20.32–2:23.23 | 乐迷留在 / **【本地社群】**。 — **changed 2026-10-07** | D 128px · ink-mint | left column, under T120 (the venue community's 3D header) | SLAM | 8 · 0.36 |
| T122 | 75:1 → 76:2 | 2:23.23–2:25.65 | 下一场的**【预告】**， — **changed 2026-10-07** (was the 设想 label) | D 128px · ink-yellow | top left (phone: 发布新的活动预告) | SLAM | 6 · 0.40 |
| T123 | 75:3 → 77:1 | 2:24.19–2:27.10 | 直接发给社群。 — **changed 2026-10-07** (plain line, the third line allowed) | M 84px · ink | left column, second line | TYPE (32nds) | 6 · 0.48 |
| T124 | 75:4 → 77:1 | 2:24.68–2:27.10 | 场地有了 / **【自己的乐迷】**， — **changed 2026-10-07** | D 128px · ink-pink | left column, third line | SLAM | 9 · 0.27 |
| T125 | 76:2 → 77:1 | 2:25.65–2:27.10 | 更愿意**【推广】**。 — **changed 2026-10-07** | D 128px · ink-mint (yellow marker ring on 推广, 76:3) | left column, bottom | SLAM | 5 · 0.29 |
| T126 | 77:1 → 79:1 | 2:27.10–2:30.97 | **【隐私】** *(label)* | D 180px · pillar-mint | left pillar sticker | POP | 2 · 1.94 |
| T126s | 77:1 → 79:1 | 2:27.10–2:30.97 | AI 在本机判断， / 照片不上传 *(label)* — **changed 2026-10-07** (the product's / brief's privacy words) | M 50px · ink | under the left pillar | TYPE | 10 · 0.39 |
| T127 | 77:2 → 79:1 | 2:27.58–2:30.97 | **【同意】** *(label)* | D 180px · pillar-pink | middle pillar sticker | POP | 2 · 1.69 |
| T127s | 77:2 → 79:1 | 2:27.58–2:30.97 | 双方同意，才交换 *(label)* — **changed 2026-10-07** (the product never says 点头) | M 56px · ink | under the middle pillar | TYPE | 7 · 0.48 |
| T128 | 77:3 → 79:1 | 2:28.06–2:30.97 | **【好玩】** *(label)* | D 180px · pillar-yellow | right pillar sticker | POP | 2 · 1.45 |
| T128s | 77:3 → 79:1 | 2:28.06–2:30.97 | 世界杯 · 默契局 · 创作角 *(label)* | M 56px · ink | under the right pillar | TYPE | 9 · 0.32 |
| T129 | 79:1 → 81:1 | 2:30.97–2:34.84 | 曲终， | D 240px · ink-pink | upper left | SLAM | 2 · 1.94 |
| T130 | 79:3 → 81:1 | 2:31.94–2:34.84 | 人**【不散】**。 | D 240px · ink-pink | upper right | SLAM | 3 · 0.97 |
| T131 | 81:1 → 82:3 | 2:34.84–2:37.74 | 打开链接， | D 128px · ink-yellow | die card bottom-left, line 1 | SLAM | 4 · 0.73 |
| T132 | 81:3 → 83:1 | 2:35.81–2:38.71 | **【一人】** / 就能走完全程。 | D 128px · ink-yellow | die card bottom-left, line 2 | SLAM | 8 · 0.36 |

### A7 · END CARD 片尾 — bars 83–90 · 2:38.71–2:54.19

*「同一刻，另一面。」, MUSIC SPACE, link + QR, disclosure, music credit*

| ID | in → out (bar:beat) | @124 BPM | 文字（【】= 重点词：放大、变色） | 字体 / 字号 / 配方 | 位置 | 入场 | 字数 · 秒/字 |
|---|---|---|---|---|---|---|---|
| T140 | 83:1 → 91:1 | 2:38.71–2:54.19 | 同一刻， | D 240px · ink-pink | left, upper | SLAM | 3 · 5.16 |
| T141 | 83:2.5 → 91:1 | 2:39.44–2:54.19 | **【另一面。】** | D 240px · hl-mint | left, lower | SLAM+SWIPE | 3 · 4.92 |
| T142 | 84:1 → 91:1 | 2:40.65–2:54.19 | MUSIC SPACE *(label)* | L 128px · logo | left, above the title | POP | 2 · 6.77 |
| T143 | 84:2.5 → 91:1 | 2:41.37–2:54.19 | musicmapteam.github.io/musicSpace/ *(label)* | G 84px · link-pill | right, above the QR | TYPE | 1 · 12.82 |
| T144 | 85:1 → 91:1 | 2:42.58–2:54.19 | 浏览器直接打开 · 无需安装 *(label)* | M 56px · ink | under the QR | TYPE | 11 · 1.06 |
| ~~T145~~ | — | — | ~~示例角色与照片为虚构（照片由 AI 生成）· 角色自动回复 · 数据只存在你的浏览器~~ *(fine)* — **removed 2026-10-07** | | | | |
| T146 | 86:1 → 91:1 | 2:44.52–2:54.19 | 演示角色与照片为虚构，照片由 AI 生成 · 配乐：Wax Lyricist《Flipping In》（CC0） *(fine)* — **changed 2026-10-07** (the ONE credits line; the music part follows the chosen map: `DM.credit()` with 「（CC0 1.0 公共领域）」 shortened to 「（CC0）」; the original score keeps 「配乐：团队原创（代码合成，无采样、无第三方录音）」) | H 36px · fine, on a paper strip | bottom centre, one line | TYPE (64ths) | ~27 · 0.36 |

## 3. Read-through (everything on screen, in order, times at 124 BPM; [label]/[fine] = small graphic text)

```text
【HOOK 钩子】
  0:00.00    [label] 进场
  0:00.97    [label] 换装
  0:01.94    [label] 上墙
  0:02.90    [label] 视角
  0:03.87    [label] 同一刻
  0:04.84    [label] 交换
  0:05.81    [label] 招手
  0:07.02    [label] 留念
  0:07.74  同一刻，
  0:08.71  另一面。
  0:09.68    [label] MUSIC SPACE
  0:10.16  和同场的人，交换彼此的视角。

【PAIN 痛点】
  0:15.48  散场了。
  0:16.45  你拍了人海，
  0:17.42  TA 拍了舞台。
  0:19.35  每部手机里，
  0:20.32  只有自己那一面。
  0:23.23  最好看的那张你，
  0:25.16  在陌生人的手机里。
  0:28.06  散场后，
  0:29.03  找不回来。
  0:30.97  站在你身边的人，
  0:32.90  还没认识，就走散了。
  0:34.84  要是……
  0:35.81  能把那一面，换回来？

【ENTER 入场】
  0:38.71  同场的人，
  0:39.68  再进同一间｜Livehouse。
  0:42.58  带上你的小人，
  0:44.52  今晚，我这样。
  0:46.45  愿意打招呼，
  0:47.42  还是｜安静参与？
  0:48.39  自己选。
  0:50.32  看看谁也在。

【PHOTO + AI 照片与端侧 AI】
  0:54.19  放一张你的照片。
  0:56.13  21:48
  0:56.13  拍摄时间，｜照片自己记得。
  0:58.06  拍的是哪一面？
  1:00.00  人海。
  1:00.97  AI 在本机判断，
  1:01.94  照片不上传。
  1:02.90  没把握的时候，
  1:03.87  它就说不确定。
  1:04.84  你来选。
  1:05.81  保存，上墙。
  1:08.71  上墙啦！
  1:09.68  按拍摄时间，
  1:11.61  3 分钟以内，
  1:12.58  就是同一刻。
  1:13.55  规则判断，不是 AI。
  1:15.48  看这里！

【SAME MOMENT + EXCHANGE 同一刻与交换】
  1:17.42  你拍人海，
  1:18.39  TA 拍舞台。
  1:19.35    [label] 不到 1 分钟
  1:21.29  同一刻的
  1:22.26  另一面。
  1:25.16  用我拍下的，
  1:26.13  换 TA 看到的。
  1:27.10  换不换，
  1:28.06  你们俩说了算。
  1:29.03  我同意，
  1:30.00  交给 TA 确认。
  1:30.97  还要 TA｜也同意。
  1:32.90  双方同意，
  1:33.87  才交换。
  1:38.71  同一刻，
  1:39.68  两面｜都齐了。
  1:41.61  随时可以撤销。
  1:42.58  然后呢？

【AFTER THE SWAP 交换之后】
  1:44.52  先招招手，
  1:46.45  对方愿意，｜才成朋友。
  1:48.39  私聊，
  1:49.35  从返场那首聊起。
  1:52.26  想安静的人，
  1:53.23  不接收新招呼。
  1:54.19  散场以后，｜继续聊。
  1:56.13  今晚的｜专辑世界杯，
  1:58.06  选一张，一起聊。
  2:00.00  默契局：
  2:00.97  揭晓前，谁也看不到。
  2:01.94  选到一起了！
  2:03.87  Livehouse 的｜长期社群，
  2:04.84  也给你｜留一个位置。
  2:05.81  再见，｜在下一场。
  2:07.74  创作角：
  2:08.71  对方点头，才开始。
  2:09.68  把这一晚，｜留在手里。
  2:12.58  纪念卡，
  2:13.55  在你的浏览器里生成。
  2:15.48  散场后，｜仍有地方回来。

【WHY IT MATTERS 为什么值得做】
  2:19.35  Livehouse 开个房，
  2:20.32  乐迷留在｜本地社群。
  2:23.23  下一场的预告，
  2:24.19  直接发给社群。
  2:24.68  场地有了｜自己的乐迷，
  2:25.65  更愿意推广。
  2:27.10    [label] 隐私
  2:27.10    [label] AI 在本机判断，｜照片不上传
  2:27.58    [label] 同意
  2:27.58    [label] 双方同意，才交换
  2:28.06    [label] 好玩
  2:28.06    [label] 世界杯 · 默契局 · 创作角
  2:30.97  曲终，
  2:31.94  人不散。
  2:34.84  打开链接，
  2:35.81  一人｜就能走完全程。

【END CARD 片尾】
  2:38.71  同一刻，
  2:39.44  另一面。
  2:40.65    [label] MUSIC SPACE
  2:41.37    [label] musicmapteam.github.io/musicSpace/
  2:42.58    [label] 浏览器直接打开 · 无需安装
  2:44.52    [fine] 演示角色与照片为虚构，照片由 AI 生成 · 配乐：Wax Lyricist《Flipping In》（CC0）
```

## 4. Why every line is true

### 4.1 Product evidence for each line

Lines that quote or paraphrase the product, and where that is in the build (pain lines and pure transitions have no row: they describe the problem, not the product).

| ID | 文字 | 产品依据（界面文字或事实） |
|---|---|---|
| T010 | 同一刻， | product claim; landing title 「同一刻，另一面。」 |
| T011 | 另一面。 | product claim |
| T012 | MUSIC SPACE | product wordmark |
| T013 | 和同场的人，交换彼此的视角。 | what the product does |
| T021 | 你拍了人海， | (changed 2026-10-07) the demo's own pair: your sample photo is 「人海 · 示例照片」 (sample-crowd.jpg), 阿遥·示例's is the stage (yao-stage.jpg); A4's reason 「你拍人海，TA 拍舞台」 |
| T022 | TA 拍了舞台。 | (changed 2026-10-07) as T021 |
| T042 | 再进同一间 / Livehouse。 | the 3D room 「回声现场 · 示例场」 at 「月台 Livehouse（虚构场地）」 |
| T043 | 带上你的小人， | entry panel 「带上小人，进入示例现场」 |
| T044 | 今晚，我这样。 | wardrobe title 「今晚，我这样。」 |
| T045 | 愿意打招呼， | entry option 「愿意打招呼」 |
| T046 | 还是 / 安静参与？ | entry option 「安静参与」 |
| T050 | 放一张你的照片。 | route card 「放一张你的照片」 |
| T051 | 21:48 | 「拍摄于 21:48 · 来自照片自带的信息」 |
| T052 | 拍摄时间， / 照片自己记得。 | EXIF (DateTimeOriginal) read before compression |
| T054 | 拍的是哪一面？ | form section 「我拍的这一面」 |
| T055 | 人海。 | chip 「AI 判断：人海」 |
| T056 | AI 在本机判断， | form hint 「AI 在本机判断，照片不上传……」 |
| T057 | 照片不上传。 | form hint (static demo: nothing is uploaded at all) |
| T059 | 它就说不确定。 | chip 「不确定，请选择」 |
| T060 | 你来选。 | 「选择永远由你做」 (About) |
| T063 | 按拍摄时间， | rule line 「按拍摄时间分组」 |
| T064 | 就是同一刻。 | group header 「21:47 · 同一刻 · 3 个视角」 |
| T065 | 3 分钟以内， | 「相差不超过 3 分钟」 (SAME_MOMENT_MS) |
| T066 | 规则判断，不是 AI。 | rule line 「规则判断，不是 AI」 |
| T070 | 你拍人海， | reason 「你拍人海，TA 拍舞台」 |
| T071 | TA 拍舞台。 | reason |
| T072 | 不到 1 分钟 | reason 「相差不到 1 分钟」 |
| T073 | 同一刻的 | badge 「同一刻的另一面」 |
| T075 | 用我拍下的， | compose 「用我拍下的，换 阿遥·示例 看到的。」 |
| T077 | 换不换， | 「要不要交换，仍由你和对方决定。」 |
| T079 | 我同意， | tick 「我同意提供选中照片的预览，并在对方接受后分享这张原图」 |
| T080 | 交给 TA 确认。 | button 「把这两张交给对方确认 ↗」 |
| T081 | 还要 TA / 也同意。 | 「等待本人回应」 |
| T082 | 双方同意， | landing 「双方同意才交换」 |
| T085 | 两面 / 都齐了。 | accepted: 「双方已明确同意」, both photos readable |
| T086 | 随时可以撤销。 | button 「撤销这次交换的在线访问」 |
| T090 | 先招招手， | person card 「先招个手，对方愿意回应后，你们才会成为朋友。」 |
| T091 | 对方愿意， / 才成朋友。 | person card |
| T092 | 私聊， | 「和 小满·示例 私聊 ↗」 |
| T093 | 从返场那首聊起。 | reply 「今晚的返场太好听了。」 |
| T095 | 想安静的人， | 「TA 选择安静参与，不接收新招呼。」 |
| T097 | 散场以后， / 继续聊。 | recap 「散场以后，继续聊。」 |
| T098 | 今晚的 / 专辑世界杯， | 「今晚的专辑世界杯」 |
| T099 | 选一张，一起聊。 | 「这一晚，选张专辑来聊」 |
| T101 | 默契局： | 「音乐偏好默契局」 |
| T102 | 揭晓前，谁也看不到。 | 「揭晓前只显示你自己的选择。」 |
| T103 | 选到一起了！ | reveal 「2 人选择 · 本轮有共同选择」 |
| T104 | Livehouse 的 / 长期社群， | (changed 2026-10-07) list header 「主办方的长期空间。每次加入都由你选择；不订阅营销，不扩大照片权限。」; the host's 「我的长期音乐社群」; filmed as the community 「月台 Livehouse」 (TAKE-H H-02) |
| T105 | 也给你 / 留一个位置。 | community header 「散场以后，也留一个位置」 (Marker font: contains 个) |
| T106 | 再见， / 在下一场。 | recap 「再见，在下一场。」 |
| T107 | 创作角： | 「TWO SIDES / 两个人的创作角」 |
| T108 | 对方点头，才开始。 | 「对方本人选择参与后才进入共同草稿」 |
| T109 | 把这一晚， / 留在手里。 | recap 「把这一晚，留在手里。」 |
| T111 | 在你的浏览器里生成。 | PNG drawn in the page; 「不会上传或自动公开」 |
| T112 | 散场后， / 仍有地方回来。 | My Space 「现场是认识的起点，散场后仍有地方回来。」 |
| T120 | Livehouse 开个房， | (changed 2026-10-07) entry button 「我是主办方，开个房」; create sheet 「主办方 / 开一个现场 · 今晚叫什么名字？」 with the fields 场次名称 and **场地** (filmed: 场地 「月台 Livehouse」, TAKE-H H-01) |
| T121 | 乐迷留在 / 本地社群。 | (changed 2026-10-07) the host's long-term community (「本场主办方的长期社群」, host form 「绑定我维护的长期空间」); joining is each member's own choice (「每次加入都由你选择」) |
| T122 | 下一场的预告， | (changed 2026-10-07) SPACE 「让下一次见面有个地方」 · 「发布新的活动预告」 (活动名称 / 场地 / 时间 / 给成员的话) -> 「活动预告 · 尚未开现场」 (TAKE-H H-03); 「活动预告是主办方自填信息」 |
| T123 | 直接发给社群。 | (changed 2026-10-07) consent 「确认向本社群成员发布活动资料」 + 「发布活动预告」: published to the community's members, no marketing push (「不订阅营销」), no automatic entry (「每人仍需同意入场」) |
| T124 | 场地有了 / 自己的乐迷， | (changed 2026-10-07) the owner's positioning (why a venue promotes Music Space); members join by choice |
| T125 | 更愿意推广。 | (changed 2026-10-07) the owner's positioning (a claim about motivation, not a product feature) |
| T126 | 隐私 | 「AI 在本机判断」 |
| T126s | AI 在本机判断， / 照片不上传 | (changed 2026-10-07) form hint 「AI 在本机判断，照片不上传……」 (the brief's wording) |
| T127 | 同意 | 「双方同意才交换」 |
| T127s | 双方同意，才交换 | (changed 2026-10-07) landing 「双方同意才交换」 (the brief's wording; A4 T082/T083) |
| T128s | 世界杯 · 默契局 · 创作角 | 专辑世界杯 / 默契局 / 创作角 exist in the build |
| T132 | 一人 / 就能走完全程。 | single-visitor demo; About 「没有服务器，没有账号」 |
| T143 | musicmapteam.github.io/musicSpace/ | the judged link (root, not /preview/) |
| T146 | 演示角色与照片为虚构，照片由 AI 生成 · 配乐：…（CC0） | (changed 2026-10-07) the one credits line: the cast and sample photos are fictional (README / About), the photos AI-generated (web/assets/image-provenance.json); the music credit from the chosen track's licence proof (CC0), or music-original/PROVENANCE.txt for the original score |

### 4.2 What the video deliberately does not say

- **「什么都不会离开你的设备，直到双方同意」 is not used.** It is not accurate: in the online example nothing is uploaded at all (the room service runs inside the page, About: 「没有服务器，没有账号，什么都不会上传」), and in the room version a saved photo goes to the room service and, if shared, room members see it; when you send an exchange request the other person can already see a small preview (「发送后，阿遥·示例 可以看并保存我的小图预览。TA 明确接受后，我们才能通过这次交换继续查看两张原图」). What is true and what the video says instead: 「AI 在本机判断，照片不上传」 (the AI step, product copy), 「双方同意，才交换」 / 「还要 TA 也同意」 (originals open only after acceptance), 「随时可以撤销」 (revoke button), and on the end card 「数据只存在你的浏览器」 (true of the online example).
- **AI is never credited with pairing.** AI only suggests the side (舞台/人海/身边/细节) and can say 「不确定」; time, grouping, pairing, reasons and the cast's accept/decline are rules (T066 stamp 「规则判断，不是 AI。」 sits on screen while the rule line is zoomed).
- **No accuracy number, no "smart matching", no real users, no launch, no real-phone or WeChat claim, no cross-device exchange on the link.** The example is one browser; the people in it are fictional and answer automatically (T049, T094, the chat bubble itself, end card).
- **No platform names (changed 2026-10-07):** v1 showed QQ音乐 / 酷狗 as plain type under a 「设想」 sticker (W2); the owner's venue story replaced that sheet, so no platform name, TME logo or app screenshot appears anywhere.
- **The venue story claims only what the build does (added 2026-10-07):** a host opens a room with a 场地; the room can be linked to the host's long-term community; the host publishes the next show's preview to the community's members (「确认向本社群成员发布活动资料」, 「活动预告是主办方自填信息」) and can provide invite codes, but every member still decides to join (「每人仍需同意入场」); members join by choice, 「不订阅营销，不扩大照片权限」. The video never says push marketing, ads, automatic entry, or that members get old photos. 「更愿意推广」 is the owner's reason why venues adopt it, not a product feature.
- **The creation corner is shown only at its real state in the example:** the invitation and 「等待朋友本人明确参与。你不能替对方同意…」. The example cast never joins a corner, so no finished co-creation is shown (the old `corner-mock` screenshots are mock-ups and must not be used).
- **Music Map (音乐探索) is left out:** it is still the old night-sakura art and shows real musicians' names; it would break the Doodle look and add third-party names.
- **Photos:** all photos on screen are the repo's two AI-generated images or the build's crops of them (`web/assets/image-provenance.json`); the sample photos' capture times are fictional. Since v2 (owner, 2026-10-07) this is said once, in the end card's credits line T146 (v1 repeated it at T025, T053, T100 and T145).
- **The QR on the end card is a link to the website**, not a room invite (the product has no QR, NFC or invite link in the example; AGENTS rule 10).

### 4.3 Where each disclosure is on screen

| Disclosure | Where |
|---|---|
| photos are AI-generated examples | (changed 2026-10-07) the end card's one credits line T146 (86–90); cover footnote |
| cast is fictional | (changed 2026-10-07) the end card's one credits line T146; the product's own labels 「·示例」 still show in the room footage (to be re-captured after the product copy revision) |
| sample capture time is fictional | (changed 2026-10-07) no overlay; the form's own note 「示例照片 · 虚构的拍摄时间 21:48，写在文件里」 still shows in the A3 footage (30–31; to be re-captured) |
| AI only suggests, may be unsure, runs on the device | T056–T060 (32–35) |
| pairing is a rule, ≤ 3 minutes | T063–T066 (37–39), the product rule line zoomed (38) |
| both must agree; revocable | T078–T083, T086 (46–54) |
| fictional albums | (removed 2026-10-07: the T100 chip; the cup card's own 「原创虚构专辑」 may show in the S5 footage) |
| ~~vision, not integration~~ | (removed 2026-10-07 with the 设想 sheet: no platform is named) |
| everything runs in your browser | (removed 2026-10-07: v1 circled the product footer in W5 and said it in T145) |

## 5. Checks

`sh make.sh` runs `src/build.py` (structure, reading time, layering, Display-font traps, gaps, line widths per layout zone — measured in Chrome by `src/measure_widths.cjs` — and runtime) and `src/glyph_check.cjs` (every character exists in the raw TTF of its font role):

```text
PASS  last shot ends at 91:1 (expected 91:1)
PASS  reading time of every title/note >= 0.25 s per unit and >= 0.9 s
PASS  max layered titles on screen at once = 2 (limit 2, doodle.md §2.2)
PASS  max narration lines on screen at once = 3 (limit 3)
PASS  no 入 / 个 / · in Display-font lines
PASS  longest gap between visual events = 2.5 beats = 1.21 s at 124 BPM (after 84:2.5); limit 4 beats (1.94 s) < 2.5 s
PASS  every narration line fits its layout zone (L1 960 / L2 980 / L4 die card 1100 / L6-L7 1680 px; per line; measured in Chrome; tightest 98%: T050 「放一张你的照片。」 960/980px)
PASS  runtime 90 bars = 174.19 s (2:54.19); with the tail bar 176.13 s (2:56.13); target 2:50-2:58
glyph check (raw TTFs, canvas comparison): M 139 chars, missing none, D 177 chars, missing none, L 8 chars, missing none, H 53 chars, missing none, N 18 chars, missing none, G 31 chars, missing none
```

Font traps found and avoided: raw 站酷庆科黄油体 draws 「入」 like 「几」 and 「个」 like 「卜」 and has no 「·」 (doodle.md §1), so no Display line uses them (「一个位置」 is set in Marker; 「招个手」 became 「招招手」); raw 霞鹜漫黑 has no 「↗」 (T080 draws the arrow as a doodle); raw 得意黑 has no 「≤」 (T065 says 「3 分钟以内」).

## 6. Files

| File | What |
|---|---|
| `SCRIPT.md` | this script |
| `STORYBOARD.md` | the beat-based storyboard (visual language, rhythm grammar, music/SFX, shot by shot, elastic retime) |
| `SHOTS.md` | the capture list for the restyled build |
| `FORM-DRAFT.md` | form field 04 text (counted) and the cover concept |
| `out/timeline.json` | machine-readable edit: acts, shots (motion + SFX events), text events, elastic plan; positions in bar:beat plus seconds at 124 BPM |
| `retime.py` | retime to any tempo / beat map / cut length; writes JSON, CSV and SRT |
| `out/retimed-124.json`, `out/retimed-124.csv`, `out/narration-124.srt` | the 124 BPM version |
| `src/edit_data.py`, `src/form_text.py` | the single sources of truth for the edit and the form text (edit them, then run `sh make.sh`) |
| `make.sh`, `src/build.py`, `src/measure_widths.cjs`, `src/glyph_check.cjs`, `src/compose.py`, `src/*.tmpl.md` | the build: generator + checks, real line widths, glyph check, document composer and templates |
| `frames/out/*.png` | rendered style frames F1–F5 and the cover concept (see STORYBOARD §1.7) |
| `probe/shots/*.png` | screenshots of the restyled build taken while writing this (reference for SHOTS.md) |
