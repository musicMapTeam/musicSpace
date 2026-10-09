# Music Space · Doodle video · narration script (kinetic typography = the subtitle track)

Draft 1 · 2026-10-07 · for the capture, motion/typography, music and assembly passes.
Written against the restyled production build in `/Users/alakazan/workplace/tme/musicSpace/dist-pages` (About panel: 版本 0.22.0-rc.1 · 提交 7cbe4d3 · 构建于 2026-10-06 19:33 UTC; the Doodle restyle is uncommitted working-tree code inside that build). I walked the judge route on it in system Chrome on 2026-10-07 (phone 1080×2340, desktop 1920×1080). Every product string quoted here was read off that build.

**中文摘要（给产品负责人）**：整片约 **2 分 54 秒**（124 BPM 下 90 小节，可加 1 小节尾声到 2:56）。没有配音，**画面里的动态文字就是讲解和字幕**：87 句短句，大多 3–8 个字（最长 12 个字），每句都卡在拍点上，重点词放大、变色。结构：钩子（8 个真实产品画面按拍点拼贴，然后「同一刻，另一面。」）→ 痛点（只有自己那一面／最好看的那张你在陌生人手机里／身边的人还没认识就走散）→ 产品（进同一间 Livehouse、换装、拍照上墙、端侧 AI 判断「人海」、没把握就说「不确定」、规则按拍摄时间配「同一刻」）→ 交换（「同一刻的另一面」、双方同意、**「交换已接受」落在全片最大的鼓点上**）→ 交换之后（招手、私聊、安静的人不被打扰、散场聊天室、专辑世界杯、默契局、社群、创作角、纪念卡、我的空间）→ 为什么值得做（每一场演出之后多一层；「设想」QQ音乐、酷狗；隐私／同意／好玩；「曲终，人不散。」）→ 片尾（链接 + 二维码 + 说明）。每句话都有产品依据（第 4 节）；「什么都不会离开你的设备，直到双方同意」这句**不准确**，已换成产品里真实的说法（见第 4 节）。

## 0. In one look

| | |
|---|---|
| Runtime | **90 bars at 124 BPM = 2:54.19** (bar 1.9355 s); optional tail bar 91 → 2:56.13. Brief: 2:50–2:58 ✓ |
| Narration | **87 lines** (kind `title`) + 30 labels, notes and fine print, all burned in as kinetic type; no voice-over. Same text as SRT: `out/narration-124.srt` (QC, optional soft subtitles) |
| Line length | 3–8 characters for 78 of the 87 lines, the longest 12; key word marked 【】 for colour and size |
| Reading time | every narration line ≥ 0.25 s per unit (one Chinese character, or one Latin/number run) and ≥ 0.9 s; max 2 layered titles + 1 plain line on screen at once (checked, §5) |
| Rhythm | every line enters on the beat grid (titles mostly on beats 1 and 3, a few on the music's syncopated hits; stickers on 2/4 or 8ths); the longest gap between visual events is {{max_gap}} |
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
{{script_table}}

## 3. Read-through (everything on screen, in order, times at 124 BPM; [label]/[fine] = small graphic text)

```text
{{narration_plain}}
```

## 4. Why every line is true

### 4.1 Product evidence for each line

Lines that quote or paraphrase the product, and where that is in the build (pain lines and pure transitions have no row: they describe the problem, not the product).

{{sources_table}}

### 4.2 What the video deliberately does not say

- **「什么都不会离开你的设备，直到双方同意」 is not used.** It is not accurate: in the online example nothing is uploaded at all (the room service runs inside the page, About: 「没有服务器，没有账号，什么都不会上传」), and in the room version a saved photo goes to the room service and, if shared, room members see it; when you send an exchange request the other person can already see a small preview (「发送后，阿遥·示例 可以看并保存我的小图预览。TA 明确接受后，我们才能通过这次交换继续查看两张原图」). What is true and what the video says instead: 「AI 在本机判断，照片不上传」 (the AI step, product copy), 「双方同意，才交换」 / 「还要 TA 也同意」 (originals open only after acceptance), 「随时可以撤销」 (revoke button), and on the end card 「数据只存在你的浏览器」 (true of the online example).
- **AI is never credited with pairing.** AI only suggests the side (舞台/人海/身边/细节) and can say 「不确定」; time, grouping, pairing, reasons and the cast's accept/decline are rules (T066 stamp 「规则判断，不是 AI。」 sits on screen while the rule line is zoomed).
- **No accuracy number, no "smart matching", no real users, no launch, no real-phone or WeChat claim, no cross-device exchange on the link.** The example is one browser; the people in it are fictional and answer automatically (T049, T094, the chat bubble itself, end card).
- **QQ音乐 / 酷狗 appear only as plain type under a 「设想」 sticker** (W2). There is no integration; no TME logo or app screenshot appears anywhere.
- **The creation corner is shown only at its real state in the example:** the invitation and 「等待朋友本人明确参与。你不能替对方同意…」. The example cast never joins a corner, so no finished co-creation is shown (the old `corner-mock` screenshots are mock-ups and must not be used).
- **Music Map (音乐探索) is left out:** it is still the old night-sakura art and shows real musicians' names; it would break the Doodle look and add third-party names.
- **Photos:** all photos on screen are the repo's two AI-generated images or the build's crops of them (`web/assets/image-provenance.json`); the sample photos' capture times are fictional. Said on screen at T025 (pain cards), T053 (the 21:48 moment), T100 (fictional albums) and the end card T145.
- **The QR on the end card is a link to the website**, not a room invite (the product has no QR, NFC or invite link in the example; AGENTS rule 10).

### 4.3 Where each disclosure is on screen

| Disclosure | Where |
|---|---|
| photos are AI-generated examples | T025 (bars 9–12), cover footnote, end card T145 |
| cast is fictional and auto-replies | product labels 「·示例」 in every room shot; T049 stamp (27:3–29:1); chat bubble 「我是示例角色，由这个页面自动回复。」 + T094 (57–58); group chat 「（示例角色的自动回复：我不是真人。）」 (S4); end card T145 |
| sample capture time is fictional | T053 chip + the form's own 「示例照片 · 虚构的拍摄时间 21:48，写在文件里」 (30–31) |
| AI only suggests, may be unsure, runs on the device | T056–T060 (32–35) |
| pairing is a rule, ≤ 3 minutes | T063–T066 (37–39), the product rule line zoomed (38) |
| both must agree; revocable | T078–T083, T086 (46–54) |
| fictional albums | T100 (61–62) |
| vision, not integration | T122 「设想」 (75–76) |
| everything runs in your browser | product footer 「示例站 · 数据只存在这个浏览器」 circled in W5 (82); end card T145 |

## 5. Checks

`sh make.sh` runs `src/build.py` (structure, reading time, layering, Display-font traps, gaps, line widths per layout zone — measured in Chrome by `src/measure_widths.cjs` — and runtime) and `src/glyph_check.cjs` (every character exists in the raw TTF of its font role):

```text
{{checks}}
glyph check (raw TTFs, canvas comparison): {{glyphs}}
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
