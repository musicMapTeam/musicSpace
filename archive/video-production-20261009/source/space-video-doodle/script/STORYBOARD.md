# Music Space · Doodle video · storyboard (beat-based, tempo-agnostic)

Draft 1 · 2026-10-07. Companion of `SCRIPT.md` (the words) and `SHOTS.md` (the capture list). The edit is written in **bars and beats**; seconds are given for the reference tempo **124 BPM** (bar = 1.9355 s, beat = 0.4839 s, 8th = 0.2419 s; at 60 fps a beat is 29.03 frames, a bar 116.1 frames). Source of truth: `src/edit_data.py` → `out/timeline.json`.

What the owner asked for, and how this answers it:

| Brief | Here |
|---|---|
| about three minutes | 90 bars = **2:54.2** at 124 BPM (+1 optional tail bar = 2:56.1); elastic to other tempos (§5) |
| 文字解说融进视频画面里 | all narration is kinetic type inside the composition (titles beside the phone, stickers on the photos, stamps on the UI); no lower-third subtitle band |
| 足够有节奏感 | every shot, cut, line, sticker and UI tap sits on a beat; titles on 1 and 3, pops on 2 and 4 or on 8ths; transitions start on the "and" of 4; max 2.5 beats (1.21 s at 124 BPM) between visual events (checked) |
| 视觉表现要丰富有冲击力 / 很强烈的艺术风格 | one consistent Doodle kit taken from the product's own tokens: paper + dots, ink, hard offset shadows, pink/mint/yellow markers, stickers, tape, polaroids, layered lettering with huge size contrast; style frames rendered in `frames/out/` |
| 主要是展示产品的美 / 不要那么抽象 | 31 of 39 shots (68 % of the running time) are real footage or real cut-outs of the restyled build (3D doodle livehouse, wardrobe, upload with the AI chip, photo wall, badge, exchange, 交换已接受, chat, World Cup, game, community, corner, memory card PNG); the other 8 are type cards built from the product's own photos, avatars, doodle shapes and typefaces |
| previous rehearsal had six frozen holds > 3 s | longest stretch without a visual event: 2.5 beats (1.21 s at 124 BPM); every shot also has a continuous push/drift and 4 fps line boil |

## 0. At a glance

| Act | bars | @124 BPM | what it does | music |
|---|---|---|---|---|
| A0 HOOK 钩子 | 1–8 (8) | 0:00.00–0:15.48 | 8-hit collage of real product moments, then the title 「同一刻，另一面。」 and a match cut into the real landing page | cold open, full band from the first frame; unison stab on 4:3.5 then silence; IMPACT on 5:1 (title); tagline pop 6:1; chord rings to 8:4 |
| A1 PAIN 痛点 | 9–20 (12) | 0:15.48–0:38.71 | after the show: only your own angle; the best photo of you is on a stranger's phone; the people next to you are gone; turn: what if it could be swapped back? | half-time and sparse from 9:1 (kick on 1, snare on 3); build 19-20 (four-on-the-floor, snare roll, riser) into 21:1 |
| A2 ENTER 入场 | 21–28 (8) | 0:38.71–0:54.19 | the product: back into the same livehouse, your illustrated avatar, choose how to take part, see who was there (labelled 示例) | DROP on 21:1: full groove when the product appears; sticker-pop dings on beat 4 of every other bar |
| A3 PHOTO + AI 照片与端侧 AI | 29–40 (12) | 0:54.19–1:17.42 | put a photo on the wall: EXIF time, on-device AI suggests the side (人海), honest 不确定, rules group 同一刻 (<=3 min), not AI | thinner groove; riser into the AI CHIME on 31:3, groove back from the chime; stamp-thud accent on 39:1 |
| A4 SAME MOMENT + EXCHANGE 同一刻与交换 | 41–54 (14) | 1:17.42–1:44.52 | 同一刻的另一面: you shot the crowd, TA shot the stage; request with consent; pending; 交换已接受 payoff; revocable | reveal sting on 41:1; build 41-50 (snare 8ths then 16ths, rising bass, riser) into a one-beat silence on 50:4; PAYOFF hit on 51:1; second groove from 51 |
| A5 AFTER THE SWAP 交换之后 | 55–72 (18) | 1:44.52–2:19.35 | greet -> friends, private chat, the quiet rule, after-show chat room, album World Cup, 默契局, community, creation corner, memory card, My Space | second groove proper from 55:1, highest energy; sticker-pop dings on beat 4 of every other bar; 8th-note fill in 72 |
| A6 WHY IT MATTERS 为什么值得做 | 73–82 (10) | 2:19.35–2:38.71 | one more layer after every live show (vision: QQ音乐 / 酷狗, labelled 设想); privacy, consent, fun; 「曲终，人不散。」; one person can try it now | stop-time break 73-74 (hits on 1, 2.5, 3.5) + tom fill; final LIFT chorus from 75:1, a whole step up; 「曲终，」 on 79:1, the lift's fifth bar |
| A7 END CARD 片尾 | 83–90 (8) | 2:38.71–2:54.19 | 「同一刻，另一面。」, MUSIC SPACE, link + QR, disclosure, music credit | stop-time tag 83-84 (hits on 1, 1.75, 2.5); BIG END CHORD on 85:1 (the QR lands on it); final ding 88:1; ring out by 91:1 |

Shot list (39 shots; details in §4):

| Shot | bars | @124 BPM | layout | source | one line |
|---|---|---|---|---|---|
| H1 | 1:1→5:1 (4) | 0:00.00–0:07.74 | L7 | CUT-01..08 | A collage builds on the paper: 8 real product moments land one per half-bar, each with a rubber stamp |
| H2 | 5:1→8:1 (3) | 0:07.74–0:13.55 | L6 | GFX type card | Pure type on dot-grid paper: 「同一刻，」 / 「另一面。」 huge, the MUSIC SPACE logo sticker, the one-line subtitle. |
| H3 | 8:1→9:1 (1) | 0:13.55–0:15.48 | L4 | D-01 desktop landing | MATCH CUT: the title type flies into the real landing page, where the same words 「同一刻，另一面。」 sit on the paper card nex… |
| P1 | 9:1→13:1 (4) | 0:15.48–0:23.23 | L6 | GFX + web/assets/stage-scene.png, crowd-scene.png | Two polaroids: the stage photo (left) and the crowd photo (right) |
| P2 | 13:1→17:1 (4) | 0:23.23–0:30.97 | L6 | GFX + crowd-scene.png | The crowd photo big; a marker circle around one raised arm: 「你！」 |
| P3 | 17:1→21:1 (4) | 0:30.97–0:38.71 | L6 | GFX + CUT-10 avatar SVGs exported from the build | Five illustrated avatars stand in a row (the cast looks + yours) |
| E1 | 21:1→23:1 (2) | 0:38.71–0:42.58 | L1 | P-01 phone landing | The phone (hand-drawn frame) bounces up from the bottom showing the real first screen: the doodle 3D stage, 「进到同一个现场」… |
| E2 | 23:1→25:1 (2) | 0:42.58–0:46.45 | L1 | P-02 wardrobe | The wardrobe 「MY ALTER EGO / 今晚，我这样。」: outfits flip on every beat (留白 -> 断拍 -> 循迹 -> 失真), then the avatar turns on ev… |
| E3 | 25:1→27:1 (2) | 0:46.45–0:50.32 | L1 | P-03 entry form | Entry form 「带上小人，进入示例现场」: nickname 「阿宁」 types in, the two choices 「愿意打招呼」 / 「安静参与」, the consent tick, 「进入示例现场」. |
| E4 | 27:1→29:1 (2) | 0:50.32–0:54.19 | L4 | D-02 desktop 3D room overview, all five present, route card s… | The doodle 3D livehouse full-bleed: pink curtain, SIDE BY SIDE poster, mint stage, ink outlines; 阿遥·示例, 小满·示例, 北屿·示例,… |
| A1 | 29:1→31:1 (2) | 0:54.19–0:58.06 | L2 | P-04 room + route card, then P-05 upload form | Phone: the room with the route card 「示例路线 1/4 · 放一张你的照片」; tap 「人海 · 示例照片」; the upload form with the polaroid and 「拍摄于… |
| A2 | 31:1→33:3 (2.5) | 0:58.06–1:02.90 | L2 | P-05 upload form, AI line | The panel scrolls to 「我拍的这一面」; the chip 「✦ AI 判断：人海」 appears and 人海 is pre-selected; hint 「配对时，用它来找互补的那一面。AI 在本机判断，照片… |
| A3 | 33:3→35:1 (1.5) | 1:02.90–1:05.81 | L2 | P-06 the honest case | The stage sample: 「拍摄于 21:47」; the AI line says 「✦ 不确定，请选择」, two dashed suggestions (舞台, 人海) with sparkles, nothing s… |
| A4 | 35:1→37:1 (2) | 1:05.81–1:09.68 | L2 -> L4 | P-07 save + wall opens | Tap 「保存这张照片」; toast 「已分享给本场成员」; the wall panel 「这一晚，大家看到了什么？」 slides up |
| A5 | 37:1→41:1 (4) | 1:09.68–1:17.42 | L2 | P-08 wall panel: group header, rule line, badge | 「21:47 同一刻 · 3 个视角：舞台 · 人海 · 细节」, the rule 「按拍摄时间分组（相差不超过 3 分钟），规则判断，不是 AI」, then the scroll reveals the pink badge 「… |
| M1 | 41:1→43:1 (2) | 1:17.42–1:21.29 | L6 | GFX + dist-pages/demo/sample-crowd.jpg | Two big polaroids slam in from both sides and collide in the centre: yours (crowd) and 阿遥's (stage); they bounce apar… |
| M2 | 43:1→45:1 (2) | 1:21.29–1:25.16 | L2 | P-08 badge + reason | The real badge card on the phone: 「同一刻的另一面」 / 「同一刻 · 21:47，相差不到 1 分钟；你拍人海，TA 拍舞台」 / 「和 TA 交换这个视角」. |
| M3 | 45:1→47:1 (2) | 1:25.16–1:29.03 | L2 | P-09 exchange compose | Tap 「和 TA 交换这个视角」 -> 「交换一个视角」: 「用我拍下的，换 阿遥·示例 看到的。」, the two polaroids with ⇄, the select 「我的第 1 张 · 已上墙 · 同一刻的另一面（推荐… |
| M4 | 47:1→49:1 (2) | 1:29.03–1:32.90 | L2 | P-09 consent + send, P-10 pending | The agreement 「发送后，阿遥·示例 可以看并保存我的小图预览。TA 明确接受后，我们才能通过这次交换继续查看两张原图…」, the tick 「我同意提供选中照片的预览，并在对方接受后分享这张原图」, 「把这两张交给对方… |
| M5 | 49:1→51:1 (2) | 1:32.90–1:36.77 | L2 | P-10 pending | 「等待本人回应」 with the two polaroids; the wait before 阿遥·示例 answers. |
| M6 | 51:1→53:1 (2) | 1:36.77–1:40.65 | L2 | P-11 交换已接受 | DROP: the real mint sticker 「交换已接受」 with the star, 「和 阿遥·示例 的两张照片」, both polaroids (我提供的 / 阿遥·示例提供的). |
| M7 | 53:1→55:1 (2) | 1:40.65–1:44.52 | L2 -> L6 | P-11 accepted, bottom part | 「双方已明确同意。退出房间后，还能从「照片交换」回来查看。」 and the button 「撤销这次交换的在线访问」 with 「任一方撤销，会同时结束本次两张照片的在线访问；原件仍归各自。」 Then the phone slid… |
| S1 | 55:1→57:1 (2) | 1:44.52–1:48.39 | L1 | P-12 person card 小满·示例, greet, accepted | The 3D close-up of 小满·示例 above the card; tap 「向 小满·示例 招个手」; toast 「招呼已送达，等待对方决定」; (wait cut) 「你们已经认识了」 with 「和 小满·示例 … |
| S2 | 57:1→59:1 (2) | 1:48.39–1:52.26 | L1 | P-13 private chat | ONE TO ONE 小满·示例: the welcome bubbles 「嗨，欢迎来到「回声现场」。我是示例角色，由这个页面自动回复。」 「你拍到的是哪一面？」; you send 「返场那首我在人海里，手都举酸了！」; the … |
| S3 | 59:1→60:1 (1) | 1:52.26–1:54.19 | L4 | D-04 林间·示例 3D close-up + her card | The 3D close-up of 林间·示例 in front of the stage (「林间·示例 · 近景 / 认识一下」), then her card: 「TA 选择安静参与，不接收新招呼。仍可查看 TA 已分享给本场… |
| S4 | 60:1→61:1 (1) | 1:54.19–1:56.13 | L1 | P-14 散场聊天室 | The after-show chat room with the 3D header 「回声现场 · 示例场」 and the seeded lines, each ending 「（示例角色的自动回复：我不是真人。）」 |
| S5 | 61:1→63:1 (2) | 1:56.13–2:00.00 | L2 | P-15 album World Cup | 「今晚的专辑世界杯」: the VS card 午夜站台 / 纸灯乐队 vs 樱花电波 / 薄荷收音机 (labelled 原创虚构专辑); tap 「选《午夜站台》」; confirm; 「2票 · 你选了这张」. |
| S6 | 63:1→65:1 (2) | 2:00.00–2:03.87 | L2 | P-16 默契局 「今晚谁和你同一首」 | Round 1: four original fictional albums; tap 「我选「午夜站台」」; submit (「先保留我的选择」); (wait cut) the reveal 「2 人选择 · 本轮有共同选择」. |
| S7 | 65:1→67:1 (2) | 2:03.87–2:07.74 | L1 | P-17 long-term community | 「音乐社群」: type 「周五散场以后」, tick 「创建长期空间，展示我的昵称、小人与发言」, 「创建我的社群」 -> the community room with the 3D header 「周五散场以后」 and 「1 … |
| S8 | 67:1→68:1 (1) | 2:07.74–2:09.68 | L1 | P-18 creation corner invitation | 「TWO SIDES / 两个人的创作角 · 一起留张纪念。」 -> tick -> 「创建共同创作邀请」 -> 「等待朋友本人明确参与。你不能替对方同意，也不会自动分享照片。」 (the example cast never joi… |
| S9 | 68:1→71:1 (3) | 2:09.68–2:15.48 | L1 -> L6 | P-19 recap + memory card form | Recap 「把这一晚，留在手里。」 -> 「保存我的纪念卡 ↗」 -> ticks (photo, avatar, confirm) -> 「下载纪念卡 PNG」 -> the real 1080x1440 PNG flies ou… |
| S10 | 71:1→72:1 (1) | 2:15.48–2:17.42 | L1 | P-20 我的空间 | 「MY SPACE / 长期留在这里」: your avatar, 「阿宁」, 「现场是认识的起点，散场后仍有地方回来。」 and the tiles 我的音乐社群 / 我的现场与回顾 / 好友与新招呼 / 私聊回访 / 共同记忆 /… |
| S11 | 72:1→73:1 (1) | 2:17.42–2:19.35 | L7 | CUT-01..08 again | Drum-roll recap: the eight cut-outs slap onto the paper on every 8th note, then all fly off. |
| W1 | 73:1→75:1 (2) | 2:19.35–2:23.23 | L6 | CUT-13 | Calmer paper: a hand-drawn ticket stub 「演出」, a paper card 「散场」 slaps over it, then the real phone first screen (CUT-1… |
| W2 | 75:1→77:1 (2) | 2:23.23–2:27.10 | L6 | GFX | The yellow sticker 「设想」 stays in the corner the whole shot |
| W3 | 77:1→79:1 (2) | 2:27.10–2:30.97 | L6 | CUT-04, CUT-11, CUT-12 | Three polaroids of real UI in a row, each under a big pillar sticker: the AI chip 「AI 判断：人海」 (隐私, mint), the consent … |
| W4 | 79:1→81:1 (2) | 2:30.97–2:34.84 | L6 | GFX + CUT-10 avatar SVGs | 「曲终，」 「人不散。」 huge; the avatars (cast + you) stand in a row below and bob on the beats; hearts pop. |
| W5 | 81:1→83:1 (2) | 2:34.84–2:38.71 | L4 | D-02 desktop 3D room | The 3D room again (the five on stage); the footer 「示例站 · 数据只存在这个浏览器 · 关于这个示例」 gets a circle. |
| C1 | 83:1→91:1 (8) | 2:38.71–2:54.19 | L6 | GFX end card + QR | 「同一刻，」 「另一面。」, MUSIC SPACE logo, the link pill, the QR (taped, tilted -3 deg) with 「浏览器直接打开 · 无需安装」, the avatars peek… |

**Key sync points** (the music must hit these; the cut is built around them): `4:3.5` unison stab, the last collage card lands, then silence · `5:1` title impact · `6:1` tagline pop (logo) · `9:1` half-time pain · `19:1`–`20:4` build · `21:1` drop: the product appears · `31:3` chime when the AI chip appears · `39:1` stamp thud 「规则判断，不是 AI。」 · `41:1` reveal sting: the two polaroids collide · `49:1`–`50:3` riser, **one beat of silence on `50:4`** · **`51:1` payoff: 「交换已接受」** · `55:1` second groove (social montage) · `72` 8th-note fill · `73:1 · 73:2.5 · 73:3.5 · 74:1 · 74:2.5 · 74:3.5` stop-time hits (W1 slaps) · `75:1` final lift chorus · `79:1` 「曲终，」 · `83:1 · 83:1.75 · 83:2.5` tag hits (end-card title) · `85:1` big end chord (QR) · `88:1` final ding · ring out by `91:1`. These are exactly the hits of the team's original score once it is re-rendered with the section lengths in §3.1.

## 1. Visual language: the Doodle video kit

The video uses the product's own design system (`docs/design/doodle.md`, `web/event-room/doodle/tokens.css`, `type.css`, `kit.css`), scaled up for a 1920×1080 frame. `frames/kit-video.css` imports those three files read-only and adds the video components below; the style frames are built with it, so motion designers can copy real CSS.

### 1.1 Palette (hex from tokens.css; no new colours)

| Token | Hex | Use in the video |
|---|---|---|
| paper | `#f7efdf` | every background; dots `rgba(28,27,26,.17)` 1.7 px every 32 px (the product's `--ds-dots`, scaled ×1.33) |
| paper-card | `#fffaf0` | polaroid frames, die cards, QR card, link pill |
| ink | `#1c1b1a` | all outlines (4–6 px), text, hard shadows, phone bezel |
| pink | `#ff5c8a` | key words (problem, swap, payoff), title shadows, scribble wipes, marker circles |
| mint | `#5fdcc0` | consent, rules, "good" words; highlighter under 「另一面。」; 「交换已接受」 |
| yellow | `#ffd447` | time and numbers (highlighter under digits), tape, stars, the logo fill |
| soft tints | pink-soft `#ffd0dd`, mint-soft `#c9f3e8`, yellow-soft `#fff0b8` | chips and pillar cards only |
| sky `#74b9ff`, night `#23212b` | — | not used (keep three markers) |

Per act: HOOK yellow+pink · PAIN ink + one pink accent (the photos bring the colour) · ENTER mint · PHOTO+AI yellow (time) + pink (key) · EXCHANGE pink, payoff mint · AFTER all three, alternating per shot · WHY ink + yellow, then pink for 「曲终，人不散。」 · END all three. Rule from doodle.md §2.4: at most two marker colours in one component; small text on a marker fill is always ink.

### 1.2 Fonts

All six are free (OFL / Apache, licences next to the TTFs in `/tmp/music-space-font-cache/*-license.txt`). Load them with `@font-face` under the product's role names so the product's recipes work unchanged:

```css
@font-face{font-family:"Doodle Display";src:url("file:///tmp/music-space-font-cache/display.ttf")}  /* 站酷庆科黄油体: titles */
@font-face{font-family:"Doodle Marker";src:url("file:///tmp/music-space-font-cache/marker.ttf")}   /* 霞鹜漫黑: plain lines, stickers, chips */
@font-face{font-family:"Doodle Hand";src:url("file:///tmp/music-space-font-cache/hand.ttf")}       /* 悠哉: captions, fine print */
@font-face{font-family:"Doodle Note";src:url("file:///tmp/music-space-font-cache/note.ttf")}       /* 龙藏体: handwritten notes */
@font-face{font-family:"Doodle Logo";src:url("file:///tmp/music-space-font-cache/logo.ttf")}       /* Luckiest Guy: MUSIC SPACE (all caps) */
@font-face{font-family:"Doodle Digits";src:url("file:///tmp/music-space-font-cache/digits.ttf")}   /* 得意黑: 21:47, 2 票, the link */
```

Traps (all avoided in SCRIPT.md, keep avoiding them in any new text): raw Display draws 「入」 like 「几」, 「个」 like 「卜」 and has no 「·」 → never use those three in Display text (or put the product's patched slices first: `dist-pages/fonts/doodle/fonts.css` defines the same family names with the fixed glyphs for product characters). Raw Marker lacks ↗ ✓ ♡ ♫ ✦ ✧ (draw them as doodles, or load the product's `marker-symbols.woff2`). Raw Digits lacks ≤. Logo is caps-only: never set the link in it. Always `await document.fonts.ready` before rendering a frame.

Size tiers at 1080p: XXL 240 · XL 180 · L 128 · M 84 · S 56 · XS 36 (minimum for anything that must be read; fine print 26–36). Hero/body ratio stays ≥ 3× (doodle.md asks for "大小" contrast).

### 1.3 Type recipes (CSS)

```css
/* product recipes, used as-is */ .ds-title .ds-sticker .ds-hl .ds-key .ds-note .ds-logo   (web/event-room/doodle/type.css)
.ink-pink   { font-family:var(--ds-font-display); color:var(--ds-ink); text-shadow:.055em .055em 0 var(--ds-pink) }   /* mint / yellow variants */
.key-pink   { color:var(--ds-pink); -webkit-text-stroke:.045em var(--ds-ink); paint-order:stroke fill; text-shadow:.05em .06em 0 var(--ds-ink) }
.hl-mint    { background:linear-gradient(transparent 58%,var(--ds-mint) 58%,var(--ds-mint) 93%,transparent 93%); padding:0 .12em }
.digits     { font-family:var(--ds-font-digits); text-shadow:.05em .05em 0 var(--ds-pink); background: yellow highlighter band 55%–95% }
.stamp      { font-family:var(--ds-font-ui); border:5px solid currentColor; border-radius:14px 6px 16px 8px; transform:rotate(-7deg); opacity:.92 } /* colour #e9396b / #1f9f83 / ink */
.chip       { font-family:var(--ds-font-ui); border:4px solid var(--ds-ink); border-radius:999px; background:paper-card|mint|yellow|pink-soft; box-shadow:6px 6px 0 var(--ds-ink) }
.ink-dashed { the key word inside a hand-drawn dashed rounded box, 4 px ink dashes 14/10 (mirrors the product's 「不确定，请选择」 chip) }
.note-pink  { font-family:var(--ds-font-note); color:var(--ds-pink); transform:rotate(-4deg) }
```

### 1.4 Objects

| Object | Spec (1080p) |
|---|---|
| **Paper** | `#f7efdf` + dots (§1.1) + faint fibre grain (17° hairlines, 3.5% ink, multiply). The paper is one infinite canvas: pans between compositions are allowed (X2). |
| **Hand-drawn phone frame** | body 480×986, ink fill, irregular radius `64px 58px 66px 60px/60px 66px 58px 64px`, 24 px bezel, screen 432×936 with 40 px radius (the 1080×2340 capture at 0.4), a 92×9 speaker pill, one side button; hard shadow `16px 18px 0` in the act colour; tilt ±2°; outline boils at 4 fps. Punch-ins scale the screen content inside the frame (up to ×2.5 stays sharp with a 1080×2340 capture). |
| **Desktop frame (L4)** | footage 1856×1044 inside a 32 px paper margin, 6 px ink outline, `14px 15px 0` ink shadow, two tape strips on the top corners. Kinetic type sits on a **die card** (paper-card, 5 px ink border, `10px 10px 0` ink shadow, irregular radius) so it never fights the 3D scene. |
| **Polaroid** | `#fffdf6` frame, padding 18/18/70 px, 4 px ink border, inner photo 3 px ink border, `12px 13px 0` ink shadow, tilt ±1.5–5°, one tape strip (190×52, torn ends = the product's `--ds-svg-tape` mask, colours `--ds-tape*`), handwritten caption in Hand 34 px. Photos are never filtered (doodle.md §3). |
| **Die-cut sticker** | the cut-out on a 10 px paper-card margin + 5 px ink outline + `10px 10px 0` ink shadow; 0.6–1.0 of its natural size; ±3° tilt. |
| **Swap sticker** | 150–180 px pink circle, 6 px ink ring, `8px 8px 0` ink shadow, the product's ⇄ arrows in ink. |
| **Doodles** | the product's masks from `kit.css`: star (two-tone), sparkle, plus, heart (two-tone), squiggle, scribble, arrow, music note, check, dot, tape. Max 2–3 per area, never over text or the UI being shown. |
| **Marker strokes** | SVG paths, round caps, 7–9 px, pink/mint/yellow/ink; circles are open loops that overshoot their start (hand-drawn), drawn with stroke-dashoffset. |
| **Confetti (payoff only)** | 12–16 doodles (star/heart/plus/sparkle) in the three markers, burst from behind the phone on `51:1`, fall and settle by `52:3`, then twinkle. |
| **QR** | `frames/assets/qr.svg` (ink modules on paper-card, 4-module quiet zone, ECC M, 29×29) — decodes to `https://musicmapteam.github.io/musicSpace/` (checked with `decode-qr.mjs` on the rendered end frame). Tilt the card, not the modules beyond −3°; keep it ≥ 380 px. |

### 1.5 Layout templates

| ID | Name | Geometry at 1920×1080 | Type zone |
|---|---|---|---|
| L1 | phone-left | phone at x≈230, y≈47, tilt −2° | right column x 840–1800 (960 px): L 7 chars/line, XL 5 |
| L2 | phone-right | phone at x≈1290, y≈52, tilt +2° (F2) | left column x 120–1100 |
| L4 | desktop-full | taped ink frame, footage 1856×1044 | die card bottom-left (≤ 900×300) or circles/stamps on the footage |
| L6 | type-card | paper only | safe area x 120–1800, y 80–1000; left-aligned at x 150 unless stated |
| L7 | collage | free; cut-outs 360–760 px wide, tilts ±5° | stamps on the cut-outs |

Title-safe margin 5% (96/54 px). Never cover the UI element a line talks about; point at it (arrow/circle) instead.

### 1.6 Motion vocabulary (frame counts at 60 fps; halve at 30 fps)

| Name | What happens |
|---|---|
| SLAM | f0 scale 1.60 rot −3° → f3 0.95 → f6 1.00 rot 0°; the coloured shadow layer arrives 2 frames late (layered lettering "printing"); XXL/XL also shake the frame 4 px for 3 frames |
| POP | f0 scale 0 → f5 1.15 → f8 1.00; rotation wobble ±4° settling by f12 (product easing `cubic-bezier(.34,1.56,.64,1)`) |
| TYPE | one character per 16th note (7.3 frames at 124 BPM); each character pops 0.6→1.0 in 3 frames; long lines (> 10 units) use 32nds |
| STAMP | f0 scale 1.30 rot −12° → f4 1.00 rot −7°; ink texture; 2-frame shake |
| SWIPE | highlighter band grows left→right over 1 beat, ease-out, ragged right edge |
| DRAW | marker stroke via stroke-dashoffset over 1 beat (2 for long paths), ease-in-out; then boils |
| DROP | falls from −120 px with ease-out-back, 10 frames |
| exit | on the cut; or POP-OUT (scale → 0 in 4 frames); or slide out with the object it belongs to |
| BOIL | all drawn line art re-jitters at 4 fps (every 15 frames): ±0.6 px / ±0.8° (the product's `ds-boil`), or a re-seeded displacement; never static |
| PUSH | every shot drifts: scale 1.00 → 1.04–1.10 over its length (ease-in-out) plus a few px of pan |
| PUNCH | zoom to a target on the beat in 4 frames ease-out, then keep drifting; pull back in 6 frames |

Transitions: **X1 scribble wipe** (a thick marker zigzag fills the frame in 4 frames starting on the "and" of 4, holds 2, then erases off in the stroke direction from the downbeat in 6 frames) · **X2 paper pan** (the camera slides along the paper canvas for 1 beat; pain section) · **X4 match cut** (video type ↔ the product's same title, H2→H3) · **X5 screen swap** (phone frame stays, screen hard-cuts on the beat) · **X7 hard cut** on the downbeat · **X9 page flip** (hides a real wait inside a take, S1). No full-frame white flashes (photosensitivity; max 3 flashes/s).

### 1.7 Style frames (rendered references, real fonts, real product captures)

`frames/out/CONTACT-style-frames.png` shows all six. Each is a static key moment; the HTML next to it is the layout to copy (`frames/*.html`, CSS `frames/kit-video.css`, render with `node frames/render.cjs`).

| Frame | Storyboard moment | File |
|---|---|---|
| F1 | H2 at `7:3`, title card | `frames/out/f1-title.png` |
| F2 | A2 at `32:3`, L2 phone + 「人海。」 + AI chip circled | `frames/out/f2-ai.png` |
| F3 | M1 at `42:4`, the collision card (key frame of the film) | `frames/out/f3-collide.png` |
| F4 | M6 at `52:3`, payoff with confetti | `frames/out/f4-payoff.png` |
| F5 | C1 at `88:x`, end card (QR decodes) | `frames/out/f5-end.png` |
| Cover | form field 07 concept | `frames/out/cover-concept-1920x1080.png` (see FORM-DRAFT.md) |

## 2. Rhythm grammar

| Beat position | What lands there |
|---|---|
| beat 1 (downbeat) | cuts; the first title of a pair (SLAM); punch-ins; section hits (5:1, 21:1, 41:1, **51:1**, 55:1, 73:1, 79:1, 83:1) |
| beat 3 | the second title of a pair; secondary cuts (A3 at `33:3`) |
| beats 2 and 4 (backbeat) | sticker pops, stamps, chips, checkbox ticks, UI taps, circles on people |
| 8th notes ("and") | type-on characters, the collage cut-outs (S11), avatar pops (P3), dots |
| "and" of 4 | transitions start (X1), anticipation squash (`50:4.5`) |

Rules: (1) a title pair = line 1 on beat 1, line 2 on beat 3, both stay to the next bar line or longer (reading time is checked in SCRIPT.md); (2) **UI actions are choreographed in the capture to land on beats** (SHOTS.md: wardrobe presets on 23:1–23:4, angles on 24:1–24:4, the three memory-card ticks on 69:1–69:3, the send on 47:3) — the rig steps a virtual clock, so a click can be placed at an exact time; (3) real waits inside the product (AI 0.3 s, 阿遥 accepting 3.8 s, 小满 greeting 3.9 s, chat reply 4.2 s, game reveal 2.2 s) are **cut**, never shown as dead time, and the cut lands on a beat (X5 / X9); (4) energy follows the music: the pain section uses 4-bar compositions with events every 2 beats inside them, the chorus cuts every 1–2 bars with events on every beat; (5) every shot keeps moving (PUSH + BOIL) even between events.

Tempo-agnostic notation: everything is bar:beat. To fit a track: run `beatmap.py` on it (`/tmp/space-video-prep/music/beatmap.py track.wav beatmap.json`), check the downbeat by ear once, then `python3 retime.py --beatmap beatmap.json [--first-bar N] [--bars N] --out retimed.json --csv retimed.csv --srt narration.srt`. If the chosen track's sections do not sit on these bars, keep the cuts on its bars and move the section hits (§0 key sync points) to its nearest section changes; the payoff `51:1` must be the biggest hit in the track (choose the start offset `--first-bar` so a drop lands there).

## 3. Music and sound

**Licence rule (hard):** only CC0 / public-domain music with a saved licence proof in the `MUSIC.md` format (source URL, licence line as shown, retrieval date, sha256, page screenshot), or original music (e.g. `/tmp/space-video-prep/music/gen_original_v2.py` re-tuned to 124 BPM). No commercial recordings, no lyrics, no samples from them (the owner's request for the Beatles was refused for copyright). The same rule applies to every sound effect: synthesize them or use CC0 with proof.

What the track should do (by bar): see the acts table in §0 (column "music") and the key sync points. In short: cold open with a stab and a silence at `4:3.5` → `5:1` title impact → `9:1` half-time pain → `19–20` build → `21:1` drop (product) → `29` thinner groove, chime `31:3` → `41:1` reveal sting, build → one beat of silence `50:4` → **`51:1` payoff, the biggest hit** → `55–72` second groove → `73–74` stop-time break → `75:1` final lift chorus (key up), `79:1` 「曲终，」 → `83–84` stop-time tag → `85:1` big end chord → ring out by `91:1`. A CC0 track will not have all of these; place the cut's section changes on its section changes and keep `51:1` on its biggest hit. Integrated loudness −16 LUFS (QC accepts −14…−18), true peak ≤ −1 dBTP; fade the last 2 beats.

### 3.1 Fitting the team's original score (`/tmp/space-video-doodle/music-original`)

A parallel pass delivered an original 124 BPM score, *Same Moment, Other Side* (`space-doodle-score_124bpm_48k24.wav`, `beats.json`, `PROVENANCE.txt`: fully synthesized, no samples). Its default form is 91 bars and puts the drop at 15, the reveal at 39 and the payoff at 47, so **as rendered it does not match this storyboard**. Its generator takes section lengths (`SCORE_CONFIG`, see the header of its `src/score.py`); with the config below every one of its hits lands on this storyboard's sync points (computed from its section map; re-render, then compare its new `beats.json` `hits` with the list above):

```json
{"bars": {"TITLE": 4, "PAIN": 10, "GROOVE_A": 8, "AI": 12, "REVEAL": 10, "GROOVE_B": 22, "LIFT": 8, "END": 6},
 "ai_chime_bar": 3, "ai_chime_beat": 2, "total_s": 176.13}
```

| Score section | Default bars | With the config | Storyboard |
|---|---|---|---|
| HOOK (cold open, stab 4:3.5, silence) | 1–4 | 1–4 | H1 collage |
| TITLE (impact, tagline pop on its 2nd bar) | 5–6 | 5–8 | H2 title card + H3 match cut |
| PAIN (half-time, sparse) | 7–12 | 9–18 | P1, P2, first half of P3 |
| WHATIF (build, riser) | 13–14 | 19–20 | P3 「要是……」, the swap |
| GROOVE_A (drop: product appears) | 15–30 | 21–28 | E1–E4 (sticker dings on 22:4, 24:4, 26:4, 28:4) |
| AI (thin groove, chime) | 31–38, chime 35:1 | 29–40, chime **31:3** | A1–A5 |
| REVEAL (sting, build, one-beat gap) | 39–46, gap 46:4 | 41–50, gap **50:4** | M1–M5 |
| GROOVE_B (payoff hit, second groove from its 5th bar) | 47–66 | 51–72, payoff **51:1**, groove 55:1 | M6–M7, S1–S11 (dings on 56:4, 58:4, 60:4, 62:4) |
| BREAK (stop-time hits) | 67–68 | 73–74 | W1 |
| LIFT (final chorus, a whole step up) | 69–84 | 75–82 | W2–W5, 「曲终，人不散。」 on 79:1 |
| TAG (stop-time hits 1, 1.75, 2.5) | 85–86 | 83–84 | C1 title + logo + link |
| END (big chord, reprise, final ding on its 4th bar) | 87–91 | 85–90 (+ tail bar 91) | C1 QR on 85:1, heart on the ding 88:1 |

`total_s` 176.13 keeps one ring-out bar after 90 (2:56.1); use 174.19 for a hard end at 2:54.2. The bar grid is exact (`first_downbeat_s` 0), so `python3 retime.py --bpm 124` is already the right timing; `--beatmap <its beats.json>` gives the same numbers. With this score, its glock "sticker_pop" dings and the AI chime are part of the music: do not stack SFX on them (keep SFX for UI taps, slaps, tape and scribbles). Re-rendering is the music pass's call (about a minute of CPU; do not run it while a capture is recording).

SFX palette (all synthesizable; keep them 8–14 dB under the music, never more than two at once):

| SFX | Recipe | Where |
|---|---|---|
| pop | sine blip 600→1200 Hz, 40 ms, + click | stickers, chips, avatars |
| paper slap | 30 ms noise burst band-passed 1–4 kHz + 90 Hz thump 60 ms | polaroids landing, collage |
| stamp thud | 70 Hz sine 120 ms + 20 ms noise | stamps (H1, T049, T066) |
| tape rip | 180 ms noise, band-pass sweep 2→6 kHz, 40 Hz flutter | tape strips |
| marker squeak | narrow-band noise at 2.5 kHz (Q 8) with ±200 Hz wobble, 150–300 ms | circles, underlines, highlighters |
| whoosh | pink noise 250 ms, band-pass sweep 400→3000 Hz | wipes, slides |
| click / tick | 5 ms filtered click / 1 kHz 8 ms | UI taps / checkboxes |
| chime | bell partials (1, 2.76, 5.4) on C6, 1.2 s decay | **31:3 the AI chip** |
| heartbeat | two 60 Hz thumps (lub-dub) | 49–50 waiting |
| confetti crackle | ~30 short clicks over 600 ms | **51:1** |
| heart boop | sine 440→660 Hz glide 120 ms | friends, hearts |
| chat blips | sine 880 / 1320 Hz, 60 ms | bubbles |
| vinyl scratch | noise through a fast pitch-modulated band-pass, 300 ms | 61:1 World Cup |

## 4. Shot by shot

Each shot: position, layout, the product state or graphic (`P-xx`/`D-xx`/`CUT-xx` refer to SHOTS.md), the doodle treatment, every event on its beat, the text IDs (words in SCRIPT.md) and the SFX. `✂` marks bars that the elastic plan may remove (§5).

### A0 · HOOK 钩子 — bars 1–8 (0:00.00–0:15.48)

Music: cold open, full band from the first frame; unison stab on 4:3.5 then silence; IMPACT on 5:1 (title); tagline pop 6:1; chord rings to 8:4.

#### H1 · 1:1 → 5:1 · 4 bars · 0:00.00–0:07.74 · layout L7

- **Source:** CUT-01..08 (real product cut-outs) on dot-grid paper
- **We see:** A collage builds on the paper: 8 real product moments land one per half-bar, each with a rubber stamp. Order: 3D room (CUT-01), your avatar (CUT-02), 3D photo wall (CUT-03), AI chip (CUT-04), 同一刻的另一面 badge (CUT-05), 交换已接受 (CUT-06), chat bubbles (CUT-07), memory card PNG (CUT-08).
- **Doodle treatment:** polaroids (white frame, tape) for CUT-01/03/08, die-cut stickers (white edge + ink outline + hard shadow) for CUT-02/04/05/06/07; each lands with 6 px shake, tilt alternates -4/+3 deg; paper scale 1.12 -> 1.00 over 4 bars (the collage "grows"); line art boils at 4 fps
- **On the beat:** `1:1` CUT-01 slaps in centre-left · `1:3` CUT-02 sticker top-right · `2:1` CUT-03 polaroid bottom-left · `2:3` CUT-04 sticker · `3:1` CUT-05 sticker centre · `3:3` CUT-06 sticker · `4:1` CUT-07 sticker · `4:3.5` CUT-08 polaroid top-left, on the unison stab · `4:4.5` scribble wipe (pink zigzag) covers everything in 4 frames, inside the silence before the title
- **Text:** T001 「进场」 `1:1`, T002 「换装」 `1:3`, T003 「上墙」 `2:1`, T004 「视角」 `2:3`, T005 「同一刻」 `3:1`, T006 「交换」 `3:3`, T007 「招手」 `4:1`, T008 「留念」 `4:3.5`
- **SFX:** `1:1` paper slap + stamp thud (repeat on every landing, pitch steps up 1 semitone each time) · `2:1` tape rip · `4:3.5` tape rip on the stab · `4:4.5` marker whoosh (alone in the silence)

#### H2 · 5:1 → 8:1 · 3 bars · 0:07.74–0:13.55 · layout L6

- **Source:** GFX type card
- **We see:** Pure type on dot-grid paper: 「同一刻，」 / 「另一面。」 huge, the MUSIC SPACE logo sticker, the one-line subtitle.
- **Doodle treatment:** layered lettering: ink + pink offset shadow; 「另一面。」 gets the mint highlighter swipe (product recipe .ds-hl); logo = Luckiest Guy, yellow fill, ink outline, pink offset; 3 doodle stars twinkle; whole card pushes 1.00 -> 1.06
- **On the beat:** `5:1` SLAM 「同一刻，」 · `5:3` SLAM 「另一面。」 + mint swipe · `6:1` logo POP (+4 deg) · `6:3` subtitle types on (16ths) · `7:1` 3 stars POP · `7:3` pink wavy underline DRAWS under 「交换」 · `7:4.5` type starts to shrink toward the landing card position
- **Text:** T010 「同一刻，」 `5:1`, T011 「另一面。」 `5:3`, T012 「MUSIC SPACE」 `6:1`, T013 「和同场的人，交换彼此的视角。」 `6:2`
- **SFX:** `5:1` impact (low boom + paper snap) · `5:3` marker squeak (highlighter) · `6:1` pop · `6:3` soft typewriter ticks · `7:3` marker squeak

#### H3 · 8:1 → 9:1 · 1 bar · 0:13.55–0:15.48 · layout L4 · ✂ cut-6

- **Source:** D-01 desktop landing (real page)
- **We see:** MATCH CUT: the title type flies into the real landing page, where the same words 「同一刻，另一面。」 sit on the paper card next to the 3D stage; left column 「这一晚的另一个视角，就在你身边。」 and the handwritten 「就是这一刻！」.
- **Doodle treatment:** the video type scales/moves onto the product's own title (2 beats) and crossfades to it; slow push toward the card; pink hand-drawn circle around 「就是这一刻！」
- **On the beat:** `8:1` type lands on the product title (match cut) · `8:2` crossfade done; push-in continues · `8:3` pink circle DRAWS around 「就是这一刻！」 · `8:4.5` ink scribble wipe
- **Text:** —
- **SFX:** `8:1` whoosh · `8:3` marker squeak · `8:4.5` scribble whoosh


### A1 · PAIN 痛点 — bars 9–20 (0:15.48–0:38.71)

Music: half-time and sparse from 9:1 (kick on 1, snare on 3); build 19-20 (four-on-the-floor, snare roll, riser) into 21:1.

#### P1 · 9:1 → 13:1 · 4 bars · 0:15.48–0:23.23 · layout L6

- **Source:** GFX + web/assets/stage-scene.png, crowd-scene.png (AI images, allowed)
- **We see:** Two polaroids: the stage photo (left) and the crowd photo (right). Each ends up inside its own hand-drawn phone outline, far apart.
- **Doodle treatment:** palette goes quiet (ink + paper + the photos; one pink accent); camera drifts right across the paper (40 px per bar); polaroids tilt -4/+3 deg with tape
- **On the beat:** `9:1` 「散场了。」 SLAM, paper only · `9:3` polaroid A (stage) slaps left + tape · `10:1` polaroid B (crowd) slaps right + tape · `10:3` handwritten captions 「你拍的」 / 「TA 拍的」 write on · `11:1` hand-drawn phone outlines DRAW around each polaroid · `12:1` the two phones slide apart · `12:3` dashed line DRAWS between them with a small × in the middle · `12:4.5` paper pans right (1 beat)
- **Text:** T020 「散场了。」 `9:1`, T025 「照片为 AI 生成的示例图」 `9:1`, T021 「你拍了舞台，」 `9:3`, T022 「TA 拍了人海。」 `10:1`, T023 「每部手机里，」 `11:1`, T024 「只有自己那一面。」 `11:3`
- **SFX:** `9:1` soft impact · `9:3` paper slap + tape · `10:1` paper slap + tape · `11:1` pencil scratch · `12:3` pencil tick

#### P2 · 13:1 → 17:1 · 4 bars · 0:23.23–0:30.97 · layout L6

- **Source:** GFX + crowd-scene.png
- **We see:** The crowd photo big; a marker circle around one raised arm: 「你！」. The photo slides into a phone labelled 「陌生人的手机」 with a padlock.
- **Doodle treatment:** pink marker circle + handwritten note; the stranger's phone gets a chip label and a lock doodle; question marks pop around it
- **On the beat:** `13:1` big polaroid slaps centre · `13:3` pink circle DRAWS around a raised arm · `13:4` note 「你！」 writes on · `14:1` polaroid slides into a hand-drawn phone + chip 「陌生人的手机」 · `14:3` padlock doodle POPS · `15:1` the phone drifts to the right edge, shrinking · `15:3` 3 question marks POP · `16:1` dotted path DRAWS from a small you-sticker toward the phone · `16:3` the path ends in a × · `16:4.5` paper pans
- **Text:** T026 「最好看的那张你，」 `13:1`, T027 「在陌生人的手机里。」 `14:1`, T028 「散场后，」 `15:3`, T029 「找不回来。」 `16:1`
- **SFX:** `13:1` paper slap · `13:3` marker squeak · `14:1` slide · `14:3` lock click · `15:3` 3 small pops · `16:3` pencil tick

#### P3 · 17:1 → 21:1 · 4 bars · 0:30.97–0:38.71 · layout L6

- **Source:** GFX + CUT-10 avatar SVGs exported from the build
- **We see:** Five illustrated avatars stand in a row (the cast looks + yours). Four slide away one per beat; yours is left with a 「?」 bubble. Then the two polaroids come back from the edges, meet above you and swap places.
- **Doodle treatment:** avatars are the product's own SVGs (ink outlines, flat colour), each on a small mint ellipse like the wardrobe stand; swap sticker = pink circle with the product's ⇄ arrows
- **On the beat:** `17:1` avatars POP in on 8ths (17:1, 17:1.5, 17:2, 17:2.5, 17:3) · `17:3` all bob once · `18:1` avatar 1 slides out left · `18:2` avatar 2 slides out right · `18:3` avatar 3 out · `18:4` avatar 4 out; 「?」 bubble POPS over yours · `19:1` push-in on your avatar (1.00 -> 1.15, 2 beats) · `19:3` polaroids A and B slide in from the edges · `20:1` they meet above you · `20:3` ⇄ sticker POPS, polaroids swap places · `20:4.5` pink scribble wipe
- **Text:** T030 「站在你身边的人，」 `17:1`, T031 「还没认识，就走散了。」 `18:1`, T032 「要是……」 `19:1`, T033 「能把那一面，换回来？」 `19:3`
- **SFX:** `17:1` 5 tiny pops · `18:1` 4 whooshes, one per beat · `19:1` riser starts (music) · `20:3` zip/swap · `20:4.5` scribble whoosh


### A2 · ENTER 入场 — bars 21–28 (0:38.71–0:54.19)

Music: DROP on 21:1: full groove when the product appears; sticker-pop dings on beat 4 of every other bar.

#### E1 · 21:1 → 23:1 · 2 bars · 0:38.71–0:42.58 · layout L1

- **Source:** P-01 phone landing (TAKE-P1 step 1)
- **We see:** The phone (hand-drawn frame) bounces up from the bottom showing the real first screen: the doodle 3D stage, 「进到同一个现场」, the card 「同一刻，另一面。」 and the button 「进入示例现场」. A finger tap on the button.
- **Doodle treatment:** phone frame: ink bezel, mint hard shadow, tilt -2 deg; screen push 1.00 -> 1.10; on 22:1 punch zoom 1.35 onto the title card
- **On the beat:** `21:1` phone bounces up into frame (overshoot) · `21:3` screen push starts · `22:1` punch zoom onto the title card · `22:3` tap ripple on 「进入示例现场」 · `22:4` entry panel begins to slide
- **Text:** T041 「同场的人，」 `21:1`, T042 「再进同一间 / Livehouse。」 `21:3`
- **SFX:** `21:1` whoosh-up + pop · `22:1` zoom thump · `22:3` click

#### E2 · 23:1 → 25:1 · 2 bars · 0:42.58–0:46.45 · layout L1

- **Source:** P-02 wardrobe (TAKE-P1 step 3-4)
- **We see:** The wardrobe 「MY ALTER EGO / 今晚，我这样。」: outfits flip on every beat (留白 -> 断拍 -> 循迹 -> 失真), then the avatar turns on every beat (正面 -> 侧面 -> 背面 -> 3/4).
- **Doodle treatment:** screen zoomed 1.25 on the figure; each tap = ripple + a tiny star; the outfit flip IS the beat
- **On the beat:** `23:1` tap 留白 · `23:2` tap 断拍 · `23:3` tap 循迹 · `23:4` tap 失真 (final look) · `24:1` angle 正面 · `24:2` angle 侧面 · `24:3` angle 背面 · `24:4` angle 3/4 · `24:4.5` tap 「保存这个我 ↗」
- **Text:** T043 「带上你的小人，」 `23:1`, T044 「今晚，我这样。」 `24:1`
- **SFX:** `23:1` click on every beat 23:1-24:4 (alternate two pitches) · `24:4.5` save chime (short)

#### E3 · 25:1 → 27:1 · 2 bars · 0:46.45–0:50.32 · layout L1

- **Source:** P-03 entry form (TAKE-P1 step 5)
- **We see:** Entry form 「带上小人，进入示例现场」: nickname 「阿宁」 types in, the two choices 「愿意打招呼」 / 「安静参与」, the consent tick, 「进入示例现场」.
- **Doodle treatment:** marker bracket around the two participation options; mint check doodle on the tick
- **On the beat:** `25:1` nickname types on (2 chars on 16ths) · `25:2` panel scrolls to the participation options · `25:3` marker bracket DRAWS around both options · `26:1` tick consent (mint check) · `26:3` tap 「进入示例现场」 · `26:4` room starts to appear
- **Text:** T045 「愿意打招呼，」 `25:1`, T046 「还是 / 安静参与？」 `25:3`, T047 「自己选。」 `26:1`
- **SFX:** `25:1` key ticks · `25:3` marker squeak · `26:1` tick · `26:3` click

#### E4 · 27:1 → 29:1 · 2 bars · 0:50.32–0:54.19 · layout L4

- **Source:** D-02 desktop 3D room overview, all five present, route card skipped (TAKE-D2)
- **We see:** The doodle 3D livehouse full-bleed: pink curtain, SIDE BY SIDE poster, mint stage, ink outlines; 阿遥·示例, 小满·示例, 北屿·示例, 阿宁 (you), 林间·示例 with their name labels.
- **Doodle treatment:** taped ink frame around the footage; hand-drawn circles around each person on the beats (pink, yellow, mint, pink, yellow heart for you); stamp 「示例角色 · 自动回复」; slow push 1.00 -> 1.08
- **On the beat:** `27:1` scribble reveal; push starts · `27:2` circle 阿遥 · `27:3` circle 小满; stamp lands · `27:4` circle 北屿 · `28:1` circle 林间 · `28:2` heart on 阿宁 · 我 · `28:3` all circles wiggle · `28:4.5` hard cut prep
- **Text:** T048 「看看谁也在。」 `27:1`, T049 「示例角色 · 自动回复」 `27:3`
- **SFX:** `27:1` bright chord stab (music) under the scribble reveal · `27:2` marker squeak x4 (one per circle, 27:2-28:1) · `27:3` stamp thud · `28:2` heart boop


### A3 · PHOTO + AI 照片与端侧 AI — bars 29–40 (0:54.19–1:17.42)

Music: thinner groove; riser into the AI CHIME on 31:3, groove back from the chime; stamp-thud accent on 39:1.

#### A1 · 29:1 → 31:1 · 2 bars · 0:54.19–0:58.06 · layout L2

- **Source:** P-04 room + route card, then P-05 upload form (TAKE-P1 steps 6-7)
- **We see:** Phone: the room with the route card 「示例路线 1/4 · 放一张你的照片」; tap 「人海 · 示例照片」; the upload form with the polaroid and 「拍摄于 21:48 · 来自照片自带的信息」 and the note 「示例照片 · 虚构的拍摄时间 21:48，写在文件里」.
- **Doodle treatment:** phone frame yellow shadow, tilt +2 deg; pink circle on the sample button; punch zoom x1.8 onto the time line
- **On the beat:** `29:1` cut in on the room · `29:2` pink circle DRAWS on 「人海 · 示例照片」 · `29:3` tap · `29:4` upload form slides up · `30:1` punch zoom onto 「拍摄于 21:48」 · `30:3` small push · `30:4.5` zoom out
- **Text:** T050 「放一张你的照片。」 `29:1`, T051 「21:48」 `30:1`, T052 「拍摄时间， / 照片自己记得。」 `30:1`, T053 「示例照片 · 拍摄时间为虚构」 `30:3`
- **SFX:** `29:3` click · `29:4` camera shutter (soft) · `30:1` zoom thump

#### A2 · 31:1 → 33:3 · 2.5 bars · 0:58.06–1:02.90 · layout L2

- **Source:** P-05 upload form, AI line (TAKE-P1 step 7)
- **We see:** The panel scrolls to 「我拍的这一面」; the chip 「✦ AI 判断：人海」 appears and 人海 is pre-selected; hint 「配对时，用它来找互补的那一面。AI 在本机判断，照片不上传，没把握就不替你选，选了也随时可改。」
- **Doodle treatment:** sync the chip's first frame to 31:3; pink circle around the chip; punch zoom x2 on chip + selected card on 32:1; zoom out to show the hint on 33:1
- **On the beat:** `31:1` panel scroll (1 beat ease) · `31:3` AI chip appears (sync) · `31:3.5` pink circle DRAWS around the chip · `32:1` punch zoom x2 · `32:3` slow push · `33:1` zoom out to the hint text
- **Text:** T054 「拍的是哪一面？」 `31:1`, T055 「人海。」 `32:1`, T056 「AI 在本机判断，」 `32:3`, T057 「照片不上传。」 `33:1`
- **SFX:** `31:3` CHIME (bell, the AI moment) · `31:3.5` marker squeak · `32:1` impact (small)

#### A3 · 33:3 → 35:1 · 1.5 bars · 1:02.90–1:05.81 · layout L2

- **Source:** P-06 the honest case (TAKE-P2, fresh world, NOT saved)
- **We see:** The stage sample: 「拍摄于 21:47」; the AI line says 「✦ 不确定，请选择」, two dashed suggestions (舞台, 人海) with sparkles, nothing selected; the person taps 舞台.
- **Doodle treatment:** dashed marker circle (dashed!) around the unsure chip; punch zoom on the two dashed cards; tap ripple on 舞台
- **On the beat:** `33:3` cut to the stage sample form · `33:4` unsure chip + dashed suggestions (sync) · `34:1` dashed circle DRAWS; punch zoom · `34:3` tap 舞台 (selected) · `34:4` zoom out
- **Text:** T058 「没把握的时候，」 `33:3`, T059 「它就说不确定。」 `34:1`, T060 「你来选。」 `34:3`
- **SFX:** `33:4` two soft "hmm" plucks (questioning interval) · `34:1` marker squeak · `34:3` click

#### A4 · 35:1 → 37:1 · 2 bars · 1:05.81–1:09.68 · layout L2 -> L4 · ✂ cut-9 (bar 36)

- **Source:** P-07 save + wall opens (TAKE-P1 step 8-9), D-03 desktop 3D photo wall before/after
- **We see:** Tap 「保存这张照片」; toast 「已分享给本场成员」; the wall panel 「这一晚，大家看到了什么？」 slides up. Cut to the desktop 3D photo wall (sign 「同一晚，另一面。」): 4 polaroids, and on 36:3 the fifth (yours) appears.
- **Doodle treatment:** before/after are two captures cut on 36:3 with a pop; pink star + handwritten 「上墙啦！」 with an arrow to the new polaroid
- **On the beat:** `35:1` tap 「保存这张照片」 · `35:2` toast + wall panel slides · `35:3` panel title in · `36:1` cut to desktop 3D wall (4 photos), slow push · `36:3` your polaroid appears (cut) + star POP · `36:4` note writes on
- **Text:** T061 「保存，上墙。」 `35:1`, T062 「上墙啦！」 `36:3`
- **SFX:** `35:1` click · `35:2` paper whoosh · `36:3` pop + tape · `36:4` pencil scribble

#### A5 · 37:1 → 41:1 · 4 bars · 1:09.68–1:17.42 · layout L2 · ✂ cut-7 (bar 40)

- **Source:** P-08 wall panel: group header, rule line, badge (TAKE-P1 step 9)
- **We see:** 「21:47 同一刻 · 3 个视角：舞台 · 人海 · 细节」, the rule 「按拍摄时间分组（相差不超过 3 分钟），规则判断，不是 AI」, then the scroll reveals the pink badge 「同一刻的另一面」 with the reason and the button 「和 TA 交换这个视角」.
- **Doodle treatment:** yellow highlighter swipe over 「相差不超过 3 分钟」 (annotation on top of the UI); mint rubber stamp 「规则判断，不是 AI。」 lands beside the phone; pink arrow + note to the badge
- **On the beat:** `37:1` cut on the group header; push · `37:3` 「21:47」 gets a yellow underline DRAW · `38:1` punch zoom onto the rule line · `38:3` yellow highlighter SWIPES over 「相差不超过 3 分钟」 · `39:1` stamp lands · `39:3` panel scrolls: the badge comes into view · `40:1` punch zoom on badge + reason · `40:3` arrow + note DRAW · `40:4.5` pink scribble wipe
- **Text:** T063 「按拍摄时间，」 `37:1`, T065 「3 分钟以内，」 `38:1`, T064 「就是同一刻。」 `38:3`, T066 「规则判断，不是 AI。」 `39:1`, T067 「看这里！」 `40:1`
- **SFX:** `37:3` marker squeak · `38:3` highlighter squeak · `39:1` STAMP thud · `40:1` zoom thump · `40:4.5` scribble whoosh


### A4 · SAME MOMENT + EXCHANGE 同一刻与交换 — bars 41–54 (1:17.42–1:44.52)

Music: reveal sting on 41:1; build 41-50 (snare 8ths then 16ths, rising bass, riser) into a one-beat silence on 50:4; PAYOFF hit on 51:1; second groove from 51.

#### M1 · 41:1 → 43:1 · 2 bars · 1:17.42–1:21.29 · layout L6

- **Source:** GFX + dist-pages/demo/sample-crowd.jpg (yours) + yao-stage.jpg (阿遥·示例)
- **We see:** Two big polaroids slam in from both sides and collide in the centre: yours (crowd) and 阿遥's (stage); they bounce apart, the ⇄ sticker pops between them, the times 21:48 / 21:47 stamp on and a bracket says 「不到 1 分钟」.
- **Doodle treatment:** the key frame of the film; star-burst doodles on impact; captions handwritten 「阿宁 · 人海」 / 「阿遥·示例 · 舞台」; digits in 得意黑 with yellow highlight
- **On the beat:** `41:1` polaroids collide (2-frame shake, star burst) · `41:3` bounce apart; ⇄ sticker POPS · `42:1` 「21:48」 stamps on yours · `42:2` 「21:47」 stamps on TA's · `42:3` bracket DRAWS: 「不到 1 分钟」 · `42:4.5` cut
- **Text:** T070 「你拍人海，」 `41:1`, T071 「TA 拍舞台。」 `41:3`, T072 「不到 1 分钟」 `42:3`
- **SFX:** `41:1` BIG paper slap x2 + cymbal-ish crash from the music · `41:3` pop · `42:1` stamp · `42:2` stamp · `42:3` marker squeak

#### M2 · 43:1 → 45:1 · 2 bars · 1:21.29–1:25.16 · layout L2

- **Source:** P-08 badge + reason (TAKE-P1 step 9)
- **We see:** The real badge card on the phone: 「同一刻的另一面」 / 「同一刻 · 21:47，相差不到 1 分钟；你拍人海，TA 拍舞台」 / 「和 TA 交换这个视角」.
- **Doodle treatment:** phone pink shadow; zoom x1.4 on the badge card; sparkles pop around the phone; phone wiggles on 44:3
- **On the beat:** `43:1` cut on the badge (zoom 1.4) · `43:3` sparkles POP · `44:1` slow push · `44:3` phone tilt wiggle -2 -> +1 deg
- **Text:** T073 「同一刻的」 `43:1`, T074 「另一面。」 `43:3`
- **SFX:** `43:1` impact + glitter · `43:3` sparkle

#### M3 · 45:1 → 47:1 · 2 bars · 1:25.16–1:29.03 · layout L2

- **Source:** P-09 exchange compose (TAKE-P1 step 10)
- **We see:** Tap 「和 TA 交换这个视角」 -> 「交换一个视角」: 「用我拍下的，换 阿遥·示例 看到的。」, the two polaroids with ⇄, the select 「我的第 1 张 · 已上墙 · 同一刻的另一面（推荐）」 and the reason card ending 「规则判断，不是 AI。要不要交换，仍由你和对方决定。」
- **Doodle treatment:** punch zoom on the two polaroids; mint highlighter swipe over 「要不要交换，仍由你和对方决定。」
- **On the beat:** `45:1` tap (ripple) · `45:2` compose screen slides in · `45:3` punch zoom on the polaroids + ⇄ · `46:1` scroll to the reason card · `46:3` mint highlighter swipe
- **Text:** T075 「用我拍下的，」 `45:1`, T076 「换 TA 看到的。」 `45:3`, T077 「换不换，」 `46:1`, T078 「你们俩说了算。」 `46:3`
- **SFX:** `45:1` click · `45:2` paper whoosh · `46:3` highlighter squeak

#### M4 · 47:1 → 49:1 · 2 bars · 1:29.03–1:32.90 · layout L2

- **Source:** P-09 consent + send, P-10 pending (TAKE-P1 steps 10-11)
- **We see:** The agreement 「发送后，阿遥·示例 可以看并保存我的小图预览。TA 明确接受后，我们才能通过这次交换继续查看两张原图…」, the tick 「我同意提供选中照片的预览，并在对方接受后分享这张原图」, 「把这两张交给对方确认 ↗」, then 「等待本人回应」.
- **Doodle treatment:** mint check doodle drawn over the real tick; clock doodle sticker next to the phone ticking on beats
- **On the beat:** `47:1` scroll to the consent · `47:2` tick (mint check DRAWS) · `47:3` tap send · `48:1` cut to 「等待本人回应」 · `48:3` clock sticker POPS; ticks every beat
- **Text:** T079 「我同意，」 `47:1`, T080 「交给 TA 确认。」 `47:3`, T081 「还要 TA / 也同意。」 `48:1`
- **SFX:** `47:2` tick · `47:3` click + paper fly · `48:3` clock tick on each beat 48:3-50:4

#### M5 · 49:1 → 51:1 · 2 bars · 1:32.90–1:36.77 · layout L2

- **Source:** P-10 pending (TAKE-P1 step 11, the real wait)
- **We see:** 「等待本人回应」 with the two polaroids; the wait before 阿遥·示例 answers.
- **Doodle treatment:** heartbeat pulse 1.00 -> 1.025 on every beat; clock sticker spins faster; three dots pop on 8ths over 50:3-50:3.5; on 50:4 (the silence) everything squashes 2 frames and holds until the drop
- **On the beat:** `49:1` pulse · `49:2` pulse · `49:3` pulse · `49:4` pulse · `50:1` pulse + clock spins · `50:2` pulse · `50:3` dots POP on 8ths · `50:4` one-beat silence in the music: everything squashes 2 frames, then holds
- **Text:** T082 「双方同意，」 `49:1`, T083 「才交换。」 `49:3`
- **SFX:** `49:1` riser (music) + heartbeat thump on each beat · `50:3` drum fill (music)

#### M6 · 51:1 → 53:1 · 2 bars · 1:36.77–1:40.65 · layout L2

- **Source:** P-11 交换已接受 (TAKE-P1 step 11)
- **We see:** DROP: the real mint sticker 「交换已接受」 with the star, 「和 阿遥·示例 的两张照片」, both polaroids (我提供的 / 阿遥·示例提供的).
- **Doodle treatment:** punch zoom x2.2 onto the sticker on the downbeat; confetti of doodle stars, hearts and plus signs in pink/yellow/mint bursts from behind the phone; zoom back to x1.2 on 51:3 to show both photos
- **On the beat:** `51:1` cut + punch zoom x2.2 + confetti burst + 2-frame shake · `51:3` zoom out to x1.2 (both photos) · `52:1` phone wiggle · `52:3` confetti settles · `52:4` stars twinkle
- **Text:** T084 「同一刻，」 `52:1`, T085 「两面 / 都齐了。」 `52:3`
- **SFX:** `51:1` DROP: big pop + confetti crackle + the music's hit · `51:3` whoosh · `52:1` sparkle

#### M7 · 53:1 → 55:1 · 2 bars · 1:40.65–1:44.52 · layout L2 -> L6

- **Source:** P-11 accepted, bottom part (TAKE-P1 step 11)
- **We see:** 「双方已明确同意。退出房间后，还能从「照片交换」回来查看。」 and the button 「撤销这次交换的在线访问」 with 「任一方撤销，会同时结束本次两张照片的在线访问；原件仍归各自。」 Then the phone slides away and a type card asks 「然后呢？」.
- **Doodle treatment:** mint circle around the revoke button; on 54:1 the phone slides out left and the paper card takes over
- **On the beat:** `53:1` scroll to the bottom · `53:2` mint circle DRAWS around 「撤销这次交换的在线访问」 · `53:3` zoom on the fine print · `54:1` phone slides out left · `54:3` 「然后呢？」 bounces · `54:4.5` yellow scribble wipe
- **Text:** T086 「随时可以撤销。」 `53:3`, T087 「然后呢？」 `54:1`
- **SFX:** `53:2` marker squeak · `54:1` whoosh · `54:3` boing · `54:4.5` scribble whoosh


### A5 · AFTER THE SWAP 交换之后 — bars 55–72 (1:44.52–2:19.35)

Music: second groove proper from 55:1, highest energy; sticker-pop dings on beat 4 of every other bar; 8th-note fill in 72.

#### S1 · 55:1 → 57:1 · 2 bars · 1:44.52–1:48.39 · layout L1

- **Source:** P-12 person card 小满·示例, greet, accepted (TAKE-P1 steps 13-14)
- **We see:** The 3D close-up of 小满·示例 above the card; tap 「向 小满·示例 招个手」; toast 「招呼已送达，等待对方决定」; (wait cut) 「你们已经认识了」 with 「和 小满·示例 私聊 ↗」 and the ♡ badge 2.
- **Doodle treatment:** phone pink shadow; the ~4 s wait is cut with a page-flip of the paper; heart sticker pops beside the phone
- **On the beat:** `55:1` cut on the person card; push · `55:3` tap greet (ripple) · `55:4` toast · `56:1` page-flip jump cut -> 「你们已经认识了」 · `56:1.5` header ♡ badge 2 (real) · `56:3` big heart sticker POPS
- **Text:** T090 「先招招手，」 `55:1`, T091 「对方愿意， / 才成朋友。」 `56:1`
- **SFX:** `55:3` click · `56:1` page flip · `56:3` heart boop

#### S2 · 57:1 → 59:1 · 2 bars · 1:48.39–1:52.26 · layout L1

- **Source:** P-13 private chat (TAKE-P1 step 15)
- **We see:** ONE TO ONE 小满·示例: the welcome bubbles 「嗨，欢迎来到「回声现场」。我是示例角色，由这个页面自动回复。」 「你拍到的是哪一面？」; you send 「返场那首我在人海里，手都举酸了！」; the reply 「今晚的返场太好听了。」
- **Doodle treatment:** punch zooms follow the bubbles; the reply wait is cut; chip 「示例角色 · 自动回复」 next to the phone
- **On the beat:** `57:1` cut on the chat; zoom on the first bubble · `57:3` typing in the composer · `58:1` your bubble lands (send) · `58:3` reply lands (jump cut) · `58:4` bubble wiggle
- **Text:** T092 「私聊，」 `57:1`, T093 「从返场那首聊起。」 `57:3`, T094 「示例角色 · 自动回复」 `57:3`
- **SFX:** `57:3` key ticks · `58:1` send blip · `58:3` receive blip

#### S3 · 59:1 → 60:1 · 1 bar · 1:52.26–1:54.19 · layout L4

- **Source:** D-04 林间·示例 3D close-up + her card (TAKE-D4)
- **We see:** The 3D close-up of 林间·示例 in front of the stage (「林间·示例 · 近景 / 认识一下」), then her card: 「TA 选择安静参与，不接收新招呼。仍可查看 TA 已分享给本场的照片。」
- **Doodle treatment:** full-bleed with taped frame; mint underline under the quiet sentence
- **On the beat:** `59:1` cut on the 3D close-up; push · `59:3` cut to the card · `59:4` mint underline DRAWS
- **Text:** T095 「想安静的人，」 `59:1`, T096 「不会被打扰。」 `59:3`
- **SFX:** `59:1` soft chord · `59:4` marker squeak

#### S4 · 60:1 → 61:1 · 1 bar · 1:54.19–1:56.13 · layout L1

- **Source:** P-14 散场聊天室 (TAKE-P1 step 16)
- **We see:** The after-show chat room with the 3D header 「回声现场 · 示例场」 and the seeded lines, each ending 「（示例角色的自动回复：我不是真人。）」
- **Doodle treatment:** phone mint shadow; product scroll through the messages
- **On the beat:** `60:1` cut; push · `60:3` messages scroll
- **Text:** T097 「散场以后， / 继续聊。」 `60:1`
- **SFX:** `60:1` receive blips x3 (quiet)

#### S5 · 61:1 → 63:1 · 2 bars · 1:56.13–2:00.00 · layout L2

- **Source:** P-15 album World Cup (TAKE-P1 step 17)
- **We see:** 「今晚的专辑世界杯」: the VS card 午夜站台 / 纸灯乐队 vs 樱花电波 / 薄荷收音机 (labelled 原创虚构专辑); tap 「选《午夜站台》」; confirm; 「2票 · 你选了这张」.
- **Doodle treatment:** zoom on the VS sticker on 61:1; digits 「2」 punch on 62:3
- **On the beat:** `61:1` cut on VS (zoom 1.3) · `61:3` tap 选《午夜站台》 · `62:1` confirm form + tick · `62:2` tap confirm · `62:3` zoom on 「2票 · 你选了这张」
- **Text:** T098 「今晚的 / 专辑世界杯，」 `61:1`, T100 「原创虚构专辑」 `61:3`, T099 「选一张，一起聊。」 `62:1`
- **SFX:** `61:1` vinyl scratch · `61:3` click · `62:2` click · `62:3` ding

#### S6 · 63:1 → 65:1 · 2 bars · 2:00.00–2:03.87 · layout L2

- **Source:** P-16 默契局 「今晚谁和你同一首」 (TAKE-P1 step 18)
- **We see:** Round 1: four original fictional albums; tap 「我选「午夜站台」」; submit (「先保留我的选择」); (wait cut) the reveal 「2 人选择 · 本轮有共同选择」.
- **Doodle treatment:** the reveal is a "flip": the album cards flip on 64:1 (cut on the beat); sparkle on the shared choice
- **On the beat:** `63:1` cut on the round · `63:2` tap 午夜站台 · `63:3` tick + submit · `64:1` reveal (jump cut on the beat) · `64:3` sparkle POP on the shared choice
- **Text:** T101 「默契局：」 `63:1`, T102 「揭晓前，谁也看不到。」 `63:3`, T103 「选到一起了！」 `64:1`
- **SFX:** `63:2` click · `63:3` tick · `64:1` reveal whoosh + ding · `64:3` sparkle

#### S7 · 65:1 → 67:1 · 2 bars · 2:03.87–2:07.74 · layout L1 · ✂ cut-10 (bar 66)

- **Source:** P-17 long-term community (TAKE-P3)
- **We see:** 「音乐社群」: type 「周五散场以后」, tick 「创建长期空间，展示我的昵称、小人与发言」, 「创建我的社群」 -> the community room with the 3D header 「周五散场以后」 and 「1 位社群成员 · 不是在线人数」.
- **Doodle treatment:** type-on synced to 16ths; push on the 3D header
- **On the beat:** `65:1` title types on (16ths) · `65:3` tick · `65:4` tap create · `66:1` cut to the community room · `66:3` push on the 3D header
- **Text:** T104 「长期社群，」 `65:1`, T105 「也留一个位置。」 `65:3`, T106 「再见， / 在下一场。」 `66:1`
- **SFX:** `65:1` key ticks · `65:3` tick · `65:4` click · `66:1` whoosh

#### S8 · 67:1 → 68:1 · 1 bar · 2:07.74–2:09.68 · layout L1

- **Source:** P-18 creation corner invitation (TAKE-P1 step 20)
- **We see:** 「TWO SIDES / 两个人的创作角 · 一起留张纪念。」 -> tick -> 「创建共同创作邀请」 -> 「等待朋友本人明确参与。你不能替对方同意，也不会自动分享照片。」 (the example cast never joins: do NOT show a finished corner).
- **Doodle treatment:** zoom on 「你不能替对方同意」
- **On the beat:** `67:1` cut on the title · `67:2` tick · `67:3` tap create · `67:4` zoom on the waiting line
- **Text:** T107 「创作角：」 `67:1`, T108 「对方点头，才开始。」 `67:3`
- **SFX:** `67:2` tick · `67:3` click

#### S9 · 68:1 → 71:1 · 3 bars · 2:09.68–2:15.48 · layout L1 -> L6

- **Source:** P-19 recap + memory card form (TAKE-P1 step 21) + CUT-08 the real exported PNG
- **We see:** Recap 「把这一晚，留在手里。」 -> 「保存我的纪念卡 ↗」 -> ticks (photo, avatar, confirm) -> 「下载纪念卡 PNG」 -> the real 1080x1440 PNG flies out of the phone and lands on the paper as a giant polaroid.
- **Doodle treatment:** each tick on a beat; the PNG flies (scale 0.3 -> 1.0, rotate -6 -> -2 deg, 6 frames), two tapes slap; sparkles
- **On the beat:** `68:1` cut on the recap title (zoom) · `68:3` tap 「保存我的纪念卡 ↗」 · `69:1` tick photo · `69:2` tick avatar · `69:3` tick confirm · `69:4` tap 「下载纪念卡 PNG」 · `70:1` the PNG flies out and lands · `70:2` tape slap · `70:3` second tape + sparkles · `70:4` slow push on the card
- **Text:** T109 「把这一晚， / 留在手里。」 `68:1`, T110 「纪念卡，」 `69:3`, T111 「在你的浏览器里生成。」 `70:1`
- **SFX:** `68:3` click · `69:1` tick x3 (69:1, 69:2, 69:3) · `69:4` click · `70:1` paper slap (big) · `70:2` tape rip · `70:3` tape rip + sparkle

#### S10 · 71:1 → 72:1 · 1 bar · 2:15.48–2:17.42 · layout L1 · ✂ cut-4

- **Source:** P-20 我的空间 (TAKE-P1 step 22)
- **We see:** 「MY SPACE / 长期留在这里」: your avatar, 「阿宁」, 「现场是认识的起点，散场后仍有地方回来。」 and the tiles 我的音乐社群 / 我的现场与回顾 / 好友与新招呼 / 私聊回访 / 共同记忆 / 身份备份与恢复.
- **Doodle treatment:** push; tiles get a quick yellow underline each on 8ths
- **On the beat:** `71:1` cut; push · `71:3` tiles underline on 8ths
- **Text:** T112 「散场后， / 仍有地方回来。」 `71:1`
- **SFX:** `71:3` 4 soft ticks

#### S11 · 72:1 → 73:1 · 1 bar · 2:17.42–2:19.35 · layout L7 · ✂ cut-2

- **Source:** CUT-01..08 again
- **We see:** Drum-roll recap: the eight cut-outs slap onto the paper on every 8th note, then all fly off.
- **Doodle treatment:** callback to the hook collage at double speed
- **On the beat:** `72:1` cut-out · `72:1.5` cut-out · `72:2` cut-out · `72:2.5` cut-out · `72:3` cut-out · `72:3.5` cut-out · `72:4` cut-out · `72:4.5` cut-out; all fly off
- **Text:** —
- **SFX:** `72:1` 8 pops ascending (one per 8th)


### A6 · WHY IT MATTERS 为什么值得做 — bars 73–82 (2:19.35–2:38.71)

Music: stop-time break 73-74 (hits on 1, 2.5, 3.5) + tom fill; final LIFT chorus from 75:1, a whole step up; 「曲终，」 on 79:1, the lift's fifth bar.

#### W1 · 73:1 → 75:1 · 2 bars · 2:19.35–2:23.23 · layout L6

- **Source:** CUT-13 (the real phone landing screen) + drawn ticket and card
- **We see:** Calmer paper: a hand-drawn ticket stub 「演出」, a paper card 「散场」 slaps over it, then the real phone first screen (CUT-13: the 3D stage and 「同一刻，另一面。」) lands on top in the phone frame with tape: a stack of layers, the product is the top layer.
- **Doodle treatment:** palette back to ink + one accent; slow drift; the phone frame gets the yellow shadow
- **On the beat:** `73:1` ticket stub slaps (stop hit) · `73:2.5` 「散场」 card slaps (stop hit) · `73:3.5` tape slap (stop hit) · `74:1` phone with CUT-13 slaps on top (stop hit) · `74:2.5` tape (stop hit) · `74:3.5` arrow DRAWS from 散场 to the phone (stop hit)
- **Text:** T120 「每一场演出，」 `73:1`, T121 「都可以多一层。」 `74:1`
- **SFX:** `73:1` paper slap on each stop hit (73:1, 73:2.5, 73:3.5, 74:1, 74:2.5, 74:3.5) · `74:3.5` marker squeak

#### W2 · 75:1 → 77:1 · 2 bars · 2:23.23–2:27.10 · layout L6

- **Source:** GFX
- **We see:** The yellow sticker 「设想」 stays in the corner the whole shot. Type: 「QQ音乐、酷狗」, 「听完现场，」 「顺手换一面。」 with a looping arrow into the ⇄ icon. Platform names as plain type only (no logos).
- **Doodle treatment:** 「设想」 = vision, not an integration; never show TME logos or app screenshots
- **On the beat:** `75:1` 设想 sticker POPS; names type on · `75:3` stack card zooms · `76:1` looping arrow DRAWS · `76:3` ⇄ spins
- **Text:** T122 「设想」 `75:1`, T123 「QQ音乐、酷狗」 `75:1`, T124 「听完现场，」 `75:3`, T125 「顺手换一面。」 `76:1`
- **SFX:** `75:1` pop · `76:1` marker squeak · `76:3` zip

#### W3 · 77:1 → 79:1 · 2 bars · 2:27.10–2:30.97 · layout L6

- **Source:** CUT-04, CUT-11, CUT-12 (real UI crops) under pillar stickers
- **We see:** Three polaroids of real UI in a row, each under a big pillar sticker: the AI chip 「AI 判断：人海」 (隐私, mint), the consent tick + 「把这两张交给对方确认 ↗」 (同意, pink), the World Cup VS card (好玩, yellow); a small sub-line under each.
- **Doodle treatment:** pops on quarter notes 77:1, 77:2, 77:3 (polaroid and sticker together); all three wiggle on 78:3
- **On the beat:** `77:1` pillar 1 POP · `77:2` pillar 2 POP · `77:3` pillar 3 POP · `78:1` sub-lines underline · `78:3` all wiggle · `78:4.5` wipe
- **Text:** T126 「隐私」 `77:1`, T126s 「AI 在本机 · 你决定给谁看」 `77:1`, T127 「同意」 `77:2`, T127s 「双方点头，才交换」 `77:2`, T128 「好玩」 `77:3`, T128s 「世界杯 · 默契局 · 创作角」 `77:3`
- **SFX:** `77:1` pop x3 (77:1, 77:2, 77:3) · `78:3` tiny chime

#### W4 · 79:1 → 81:1 · 2 bars · 2:30.97–2:34.84 · layout L6

- **Source:** GFX + CUT-10 avatar SVGs
- **We see:** 「曲终，」 「人不散。」 huge; the avatars (cast + you) stand in a row below and bob on the beats; hearts pop.
- **Doodle treatment:** the emotional hit; pink + ink only; avatars bob alternately
- **On the beat:** `79:1` SLAM 曲终， · `79:3` SLAM 人不散。 · `80:1` avatars bob (every beat to 80:4) · `80:3` hearts POP
- **Text:** T129 「曲终，」 `79:1`, T130 「人不散。」 `79:3`
- **SFX:** `79:1` impact (soft, warm) · `79:3` impact · `80:3` heart boop

#### W5 · 81:1 → 83:1 · 2 bars · 2:34.84–2:38.71 · layout L4 · ✂ cut-8 (bar 81)

- **Source:** D-02 desktop 3D room (TAKE-D2), full-bleed in the taped ink frame; text on a paper die card bottom-left
- **We see:** The 3D room again (the five on stage); the footer 「示例站 · 数据只存在这个浏览器 · 关于这个示例」 gets a circle.
- **Doodle treatment:** slow push 1.00 -> 1.06; ink circle around the footer on 82:1; text on a die card (paper-card, ink border, hard shadow) bottom-left
- **On the beat:** `81:1` cut; push · `81:3` die card settles · `82:1` circle DRAWS around the footer · `82:3` push continues · `82:4.5` scribble wipe
- **Text:** T131 「打开链接，」 `81:1`, T132 「一人 / 就能走完全程。」 `81:3`
- **SFX:** `81:1` paper slide · `82:1` marker squeak · `82:4.5` scribble whoosh


### A7 · END CARD 片尾 — bars 83–90 (2:38.71–2:54.19)

Music: stop-time tag 83-84 (hits on 1, 1.75, 2.5); BIG END CHORD on 85:1 (the QR lands on it); final ding 88:1; ring out by 91:1.

#### C1 · 83:1 → 91:1 · 8 bars · 2:38.71–2:54.19 · layout L6 · ✂ cut-1 (bar 90), cut-5 (bar 89)

- **Source:** GFX end card + QR (GFX, must decode to the judged link) + CUT-10 avatars
- **We see:** 「同一刻，」 「另一面。」, MUSIC SPACE logo, the link pill, the QR (taped, tilted -3 deg) with 「浏览器直接打开 · 无需安装」, the avatars peeking from the bottom edge, disclosure and music credit in small print.
- **Doodle treatment:** QR in ink on white with a full quiet zone (no tilt on the modules themselves if it hurts decoding: tilt the paper, keep the code square in the camera); everything else boils at 4 fps; avatars bob on beats; stars twinkle
- **On the beat:** `83:1` SLAM 同一刻， (tag hit) · `83:2.5` SLAM 另一面。 + mint swipe (tag hit) · `84:1` logo POP (tag hit) · `84:2.5` link types on (tag hit) · `85:1` QR POPS + tape on the big end chord · `85:3` avatars slide up on 8ths · `86:1` disclosure types on · `86:3` avatars bob · `87:1` music credit fades in · `87:3` avatars bob · `88:1` heart POP on the final ding · `88:3` avatars bob · `89:1` logo wiggle · `89:3` avatars bob · `90:1` stars twinkle · `90:3` avatars bob · `91:1` end (or tail bar 91)
- **Text:** T140 「同一刻，」 `83:1`, T141 「另一面。」 `83:2.5`, T142 「MUSIC SPACE」 `84:1`, T143 「musicmapteam.github.io/musicSpace/」 `84:2.5`, T144 「浏览器直接打开 · 无需安装」 `85:1`, T145 「示例角色与照片为虚构（照片由 AI 生成）· 角色自动回复 · 数据只存在你的浏览器」 `86:1`, T146 「配乐：团队原创（代码合成，无采样、无第三方录音）」 `87:1`
- **SFX:** `83:1` none: the tag hits are in the music · `85:1` tape rip under the end chord · `88:1` none: final ding is in the music

## 5. Elastic retime (other tempos, other lengths)

Bars that can go, in this order (`out/timeline.json` → `elastic.cut`): ✂1 bar 90 (end card −1) · ✂2 bar 72 (S11 drum-roll recap) · ✂3 bars 15–16 (P2 「散场后，找不回来。」) · ✂4 bar 71 (S10 我的空间) · ✂5 bar 89 (end card −1 more; QR still on ≥ 11 s) · ✂6 bar 8 (H3 match cut) · ✂7 bar 40 (badge tease 「看这里！」) · ✂8 bar 81 (W5 text bar) · ✂9 bar 36 (3D wall insert) · ✂10 bar 66 (community second bar). Bars that can be added: +1 one more end-card bar · +2 after bar 28: real camera glide 全景→照片墙 on the desktop 3D room · +3 after bar 54: the 3D wall with both photos and a pink ⇄ doodle · +4 after bar 60: 2 bars of 成员音乐话题 (title 「聊聊今晚的歌。」, the song card 「晚班列车 / 纸灯乐队」, both fictional).

When ✂6 is used (no H3), end H2 with an X1 scribble wipe on `7:4.5` instead of the shrink toward the landing card; when ✂7 is used, A5 ends with a hard cut on the new bar line. `retime.py` applies them: an event that starts in a removed bar is dropped; one that ends in it is shortened to the next kept bar; inserted bars come out as placeholder shots `ADD-k`. Tempo table (bars that make 2:50–2:58, the choice closest to 2:54, and what to cut or add):

| track tempo | bar | bars that fit 170–178 s | use | runtime | how |
|---|---|---|---|---|---|
| 108 BPM | 2.222 s | 77–80 | 79 | 2:55.56 | ✂1 (bar 90), ✂2 (bar 72), ✂3 (bar 15,16), ✂4 (bar 71), ✂5 (bar 89), ✂6 (bar 8), ✂7 (bar 40), ✂8 (bar 81), ✂9 (bar 36), ✂10 (bar 66) |
| 110 BPM | 2.182 s | 78–81 | 80 | 2:54.55 | ✂1 (bar 90), ✂2 (bar 72), ✂3 (bar 15,16), ✂4 (bar 71), ✂5 (bar 89), ✂6 (bar 8), ✂7 (bar 40), ✂8 (bar 81), ✂9 (bar 36) |
| 112 BPM | 2.143 s | 80–83 | 81 | 2:53.57 | ✂1 (bar 90), ✂2 (bar 72), ✂3 (bar 15,16), ✂4 (bar 71), ✂5 (bar 89), ✂6 (bar 8), ✂7 (bar 40), ✂8 (bar 81) |
| 114 BPM | 2.105 s | 81–84 | 83 | 2:54.74 | ✂1 (bar 90), ✂2 (bar 72), ✂3 (bar 15,16), ✂4 (bar 71), ✂5 (bar 89), ✂6 (bar 8) |
| 116 BPM | 2.069 s | 83–86 | 84 | 2:53.79 | ✂1 (bar 90), ✂2 (bar 72), ✂3 (bar 15,16), ✂4 (bar 71), ✂5 (bar 89) |
| 118 BPM | 2.034 s | 84–87 | 86 | 2:54.92 | ✂1 (bar 90), ✂2 (bar 72), ✂3 (bar 15,16) |
| 120 BPM | 2.000 s | 85–89 | 86 | 2:52.00 | ✂1 (bar 90), ✂2 (bar 72), ✂3 (bar 15,16) |
| 122 BPM | 1.967 s | 87–90 | 88 | 2:53.11 | ✂1 (bar 90), ✂2 (bar 72) |
| 124 BPM | 1.935 s | 88–91 | 90 | 2:54.19 | as written |
| 126 BPM | 1.905 s | 90–93 | 91 | 2:53.33 | +1 (1 after bar 90) |
| 128 BPM | 1.875 s | 91–94 | 93 | 2:54.38 | +1 (1 after bar 90), +2 (1 after bar 28), +3 (1 after bar 54) |
| 130 BPM | 1.846 s | 93–96 | 95 | 2:55.38 | +1 (1 after bar 90), +2 (1 after bar 28), +3 (1 after bar 54), +4 (2 after bar 60) |
| 132 BPM | 1.818 s | 94–97 | 95 | 2:52.73 | +1 (1 after bar 90), +2 (1 after bar 28), +3 (1 after bar 54), +4 (2 after bar 60) |
| 134 BPM | 1.791 s | 95–99 | 95 | 2:50.15 | +1 (1 after bar 90), +2 (1 after bar 28), +3 (1 after bar 54), +4 (2 after bar 60) |

Half-time tracks (60–66 BPM) work as they are: one edit bar = half a track bar. Below ~108 BPM or above ~134 BPM the plan runs out: pick another track.

## 6. On-screen honesty checklist (QC this in the final cut)

- [ ] 「·示例」 visible on the cast in every room shot (product labels), stamp 「示例角色 · 自动回复」 at 27:3–29:1, the chat bubble's own disclosure at 57:1, the group chat lines at 60:1
- [ ] T025 「照片为 AI 生成的示例图」 during the pain cards; T053 「示例照片 · 拍摄时间为虚构」 at 30:3; T100 「原创虚构专辑」 at 61:3
- [ ] AI shown only as a suggestion: 「AI 判断：人海」 and the honest 「不确定，请选择」 both on screen; 「规则判断，不是 AI。」 stamped while the rule line is zoomed (38–39)
- [ ] consent beats legible: the tick and 「把这两张交给对方确认 ↗」 before 「等待本人回应」; 「交换已接受」 only after the wait; revoke button at 53:2
- [ ] 「设想」 sticker visible for the whole of W2; no TME logo or app screenshot anywhere
- [ ] no Music Map, no mocked creation-corner result, no `/preview/` ribbon, no devtools, no cursor except deliberate tap ripples
- [ ] end card: link `musicmapteam.github.io/musicSpace/` (root), QR decodes to `https://musicmapteam.github.io/musicSpace/`, disclosure T145, music credit T146 filled from the licence proof
- [ ] nothing claims real users, a launch, accuracy, real phones/WeChat, cross-device exchange, or AI pairing

## 7. Hand-off notes and risks

- **Capture** (SHOTS.md): record the restyled `dist-pages` exactly as it will be published (root path under `/musicSpace/`, not `/preview/`). If the published build changes after capture (fixes listed in PROJECT_STATUS: the sticky 「×」, polaroid caption line break, desktop chat scroll), re-take the affected shots: P-08 wall polaroid captions and P-13 chat are the exposed ones.
- **Visitor look**: use preset 「失真」 (index 4) — the cast already wears 断拍/循迹/回声/脉冲, and the default look is random per session. Nickname 「阿宁」.
- **Time of day on screen**: chat timestamps and 「申请有效至 …」 show the clock of the capture machine; set the rig's fake clock to an evening after the build time (e.g. 2026-10-07 22:40 +08:00) so the screen reads like after a show.
- **Avatars for graphic shots** (P3, W4, C1): `probe/avatars/*.svg` are exported from the build (exact 阿遥/小满/北屿 from the chat room; 留白/失真/脉冲 looks from the wardrobe). 林间's exact look is not exported (she never posts); use 脉冲 only as "a person", not labelled 林间.
- **Risk — reading speed**: lines were checked at ≥ 0.25 s per character; if the chosen track is faster than 128 BPM, re-run `src/build.py` with the new BPM (edit `BPM_REF`) and fix any WARN before rendering.
- **Risk — the payoff depends on the track**: if no drop can be placed on `51:1`, use the ADD bars to move material so the track's drop and 「交换已接受」 coincide; never move the payoff off the strongest hit.
- **Risk — 3D canvas sharpness**: capture desktop at DPR 8/3 (3840×2160) so the 1.1–1.5× punch-ins on the 3D room stay crisp.
