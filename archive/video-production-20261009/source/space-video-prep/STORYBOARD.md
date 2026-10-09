# Music Space competition video — storyboard v2 (hook-first, Route B)

Pre-production, 2026-10-05, for form field 06 (≤ 3:00, ≤ 500 MB, voice **or** subtitles, no watermark/noise, original or CC0 music).
Everything marked **REHEARSAL** is real RC4 footage (main `2edc18d`) that stands in until the Route B static build exists; **final footage must be recorded on the Route B build** (frozen Pages link, T12b).
Design inputs: `/tmp/space-b-design-final.json` (`judgePath`, `aiStory`), `/tmp/space-b-architecture.md` §7–9.

## 0. At a glance

| | |
|---|---|
| Runtime | **2:45 (165.0 s)** with the optional two-device insert M3; **2:35 (155.0 s)** without it (`assembly/timeline.v2.noM3.json`, `music/score-config.noM3.json`) |
| Picture | 1920×1080, 60 fps. Product footage is a 1920×992 frame (recorded 1440×744 CSS px at DPR 2.667, supersampled) on an 88 px deep-green **caption band**, so captions never cover the UI. Hook and cards are full-frame |
| Language | Chinese burned-in subtitles (PingFang SC, rendered by Chrome because this Homebrew ffmpeg has no libass/drawtext). No voice-over |
| Music | original synthesized score v2, 96 BPM, **2.5 s per bar**, every picture cut on a bar line (`music/original-v2/`); CC0 alternatives in `MUSIC.md` |
| Grid | 66 bars × 2.5 s = 165 s. Bar *n* starts at (n−1)·2.5 s |
| Tagline | 「同一刻，另一面。」 (product claim since 0.4; the in-scene wall sign in `web/event-room/venue-art.js:39` still reads 「同一晚，另一面。」, see §6) |

Story in one line: *a beautiful 3D livehouse → the pain (one night, one angle) → what if the other side could come back by consent → the product, in the judge's own 8 taps → keepsake → end card with the link.*

| Act | Time | Purpose | Shots |
|---|---|---|---|
| 0 Hook | 0:00–0:12.5 | beauty first: 3D livehouse, lights, avatars, title lockup | H0 |
| 1 Pain | 0:12.5–0:32.5 | 3 kinetic-type beats + the "what if" turn | P1 P2 P3 Q |
| 2 Enter | 0:32.5–0:52.5 | open the link, take your avatar in | E1 E2 E3 |
| 3 Photo + AI | 0:52.5–1:17.5 | the wall by moment, capture time + 「AI 判断：人海」, the honest 「不确定」 | A1 A2a A2b A3 |
| 4 Same moment | 1:17.5–1:52.5 | the badge + reason, the consent exchange, (optional two-person insert) | M1 M2 M3 |
| 5 Social | 1:52.5–2:19.5 | greet, friend, private chat; the quiet rule; the after-show room | S1 S2 S3a S3b |
| 6 Keepsake | 2:20–2:35 | recap, the real memory-card PNG, Music Map | K1 K2 |
| 7 Close | 2:35–2:45 | end card: Music Space, 「同一刻，另一面。」, link + QR | C |

Honest-labelling rules baked into every caption (binding, from `aiStory` / design 7.4): the cast is **示例** and answers automatically (does not learn); **AI only suggests the viewpoint** and may say 不确定; capture time, 「同一刻」 grouping, pairing, reasons and the NPC accept rule are **rules, not AI**; **nothing is uploaded** on the static site; no claim of real users, a launch, accuracy, or real phones.

## 1. Master shot list

`Src`: **STATIC** = Route B static Pages build, one viewer (judge-reproducible) · **NODE×2** = real Node server with two browser identities (full version, *not* what the Pages link does) · **CARD** = HTML motion graphic, no capture · **ASM** = composited in assembly.
`Now`: asset status today. Times are programme time.

| # | ID | Start | Dur | Visual | Captions / on-screen text (Chinese, burned in) | Music (bar) | Transition in | Src | Now |
|---|---|---|---|---|---|---|---|---|---|
| 1 | H0 | 0:00.0 | 12.5 | full-bleed 3D room, real camera glides: overview push-in → 小满 close-up → photo wall → pull back (4th avatar arrives at 8.9 s) → dim + title lockup at 10.0 | note 0.9–5.2 s 「示例角色与照片均为虚构（AI 生成）」; lockup 「MUSIC SPACE / LIVEHOUSE · space · 同一刻，另一面。 · 带着自己的小人，进入同一场音乐现场」 | 1–5 HOOK: warm keys + pad + bells; soft pulse 4–5; **soft impact on bar 5 (10.0 s)** | – | STATIC + ASM | REHEARSAL (RC4 room) |
| 2 | P1 | 0:12.5 | 5 | polaroids slide in: your stage shot (21:47) vs her blurred, locked crowd shot (21:48) | 你拍到了舞台， / 她记住的是人海。 → 散场以后，**另一面**，再也看不到。 / 每个人的相册里，只有自己站的那个角度 · note 示例照片由 AI 生成 · 虚构场景 | 6–13 PAIN: sparse, minor colour, bells | fade 0.5 | CARD | FINAL |
| 3 | P2 | 0:17.5 | 5 | a wall of 18 near-identical polaroids with scrambled times, badge 99+ | 群相册能收齐照片， / 却分不清哪一张是**同一刻**。 | PAIN | cut | CARD | FINAL |
| 4 | P3 | 0:22.5 | 5 | one avatar with an empty speech bubble, a glass wall, a crowd of greyed avatars | 想认识同场的人， / 却没有一个**安全的开口**。 · note 示例角色为虚构 | PAIN | cut | CARD | FINAL |
| 5 | Q | 0:27.5 | 5 | the two polaroids slide together, the lock opens, 「同一刻 · 相差 1 分钟」 tag | 如果，每个人的那一面， / 可以被**自愿**地换回来呢？ | bars 12–13 heartbeat + riser | fade 0.3 | CARD | FINAL |
| 6 | E1 | 0:32.5 | 5 | landing: status 「示例现场 · 在本页运行」, presence card 「同一刻，另一面。」, button 「进入示例现场」; director eases onto the card | 打开链接就能进，不用安装。 | **14 DROP** (crash + sub; groove enters) | cut on the downbeat | STATIC | TO CAPTURE (RB-E1); slate = RC4 landing still |
| 7 | E2 | 0:37.5 | 10 | button → panel 「带上小人，进入示例现场」: nickname, 「现在换个造型 ↗」 → wardrobe (one look) → ONE consent tick → submit | 带上自己的二维手绘小人入场，随时能换装。 | 16–19 groove A | cut | STATIC | REHEARSAL (S04 RC4 wardrobe); final = RB-E2 |
| 8 | E3 | 0:47.5 | 5 | the 3D room: 阿遥·示例, 小满·示例, 北屿·示例 and you; 「回声现场 · 示例场」, 「月台 Livehouse（虚构场地）」, tour card 「示例路线 1/4」 | 真正的三维 Livehouse；同场的朋友是**示例角色**。 | 20–21 | cut | STATIC | REHEARSAL (S01); final = RB-E3 |
| 9 | A1 | 0:52.5 | 10 | wall list: 「21:47 · 同一刻 · 3 个视角：舞台 · 人海 · 细节」 and 「22:21」, rule line 「按拍摄时间分组（相差不超过 3 分钟），规则判断，不是 AI」; director zooms on the header | 照片按拍摄时间分成「**同一刻**」：规则判断，不是 AI。 | 22–25 | cut | STATIC | REHEARSAL (S08 RC4 wall list); final = RB-A1 |
| 10 | A2a | 1:02.5 | 7.5 | tour-card button 「人海 · 示例照片」 → form: 「拍摄于 21:48 · 来自照片自带的信息」, chip 「AI 判断：人海」 pre-selected → 「保存这张照片」 | 拍摄时间来自照片自带的信息；**AI 在本机判断视角**：人海。 | 25–27: **single bell chime when the chip appears** (bar 27 default, retime with `hits.mjs`) | cut | STATIC | REHEARSAL (S05, no chip in RC4); final = RB-A2 |
| 11 | A2b | 1:10 | 2.5 | saved: the photo joins the 21:47 group, 3D wall updates | 照片不上传。 | 28 | slide 0.3 | STATIC | REHEARSAL (S07) |
| 12 | A3 | 1:12.5 | 5 | fresh take: 「舞台 · 示例照片」 → 「不确定，请选择」, two dashed suggestions, nothing selected → the person taps 舞台 | 没把握，它就说「不确定」，**选择权在你**。 | 30–31 | cut | STATIC | REHEARSAL (S06, no chip in RC4); final = RB-A3 |
| 13 | M1 | 1:17.5 | 10 | the wall: badge 「同一刻的另一面」 + reason 「同一刻 · 21:47，相差不到 1 分钟；你拍人海，TA 拍舞台」 + button 「和 TA 交换这个视角」; each photo 「拍摄于 21:47 · 视角：舞台 · 作者选择」, yours 「AI 建议，未改动」 | **同一刻的另一面**：按拍摄时间配对，理由写得明明白白。 → 配对和理由是规则算的，**不是 AI**。 | **32 REVEAL: rising four-note bell figure** + melody hook | cut | STATIC | REHEARSAL (S09 request flow, no badge in RC4); final = RB-A2 tail |
| 14 | M2 | 1:27.5 | 15 | tap the button → compose, own photo marked 「推荐 · 同一刻的另一面」 → tick 「我同意提供选中照片的预览，并在对方接受后分享这张原图」 → 「把这两张交给对方确认 ↗」 → 3–5 s later 「交换已接受」 with both photos | 要换，就指定具体的**两张**照片，并明确同意。 → 对方同意，才会交换；示例角色会自动回应。 | 36–45 CONSENT: brushes, warm pad; **swell when 「交换已接受」 appears** (bar 40 default) | slide 0.4 | STATIC | REHEARSAL (S10 RC4 two-device consent); final = RB-M2 |
| 15 | M3 | 1:42.5 | 10 | **optional insert**: split-screen, two phone frames, two real people (阿遥 / Lin), one asks, the other previews, ticks, accepts | 完整版：真实房间里，两个人各自的设备。 · note 演示：同一台电脑上的两个独立浏览器身份 | 41–45 | slide 0.4 | **NODE×2** | REHEARSAL (S03 RC4 duo) |
| 16 | S1 | 1:52.5 | 15 | open 小满·示例 → 「向 小满·示例 招个手」 → accepted in ~3–5 s with two welcome lines → 「和 小满·示例 私聊」 → type a line → automatic reply | 愿意认识，才继续聊：先招手，**对方同意**，才能私聊。 → 示例角色的回应是自动的，不会学习。 | 46–52 groove A′, build 51–52 | slide 0.4 | STATIC | REHEARSAL (S12 RC4 duo, two real people); final = RB-S1 |
| 17 | S2 | 2:07.5 | 2.5 | open 林间·示例: 「TA 选择安静参与，不接收新招呼」 | 想安静的人，不会被打扰。 | 52 | cut | STATIC | TO CAPTURE (RB-S2) – slate |
| 18 | S3a | 2:10 | 5 | 散场聊天室: seeded lines (labelled automatic), the album cup | 散场以后，聊天室里还有专辑杯…… | **53 LIFT** (crash; full groove, strummed guitar) | cut | STATIC | REHEARSAL (S14b) |
| 19 | S3b | 2:15 | 5 | the preference game (「一起玩」) | ……和默契局。 | 55–56 | cut | STATIC | REHEARSAL (S14c) |
| 20 | K1 | 2:20 | 10 | 回看这一晚 → 「保存我的纪念卡」 → real PNG preview (6–8 s); then the **actual exported PNG** flies in over the dark room (card K, 4 s) | 散场了，把这一晚**留在手里**。 → card K: 真正导出的 PNG · 在你的浏览器里生成 · 由你主动下载 · 不上传 | 57–60 | cut | STATIC + CARD | REHEARSAL (S13) + card K FINAL layout |
| 21 | K2 | 2:30 | 5 | 音乐探索: the Map opens in the same site, return bar 「返回现场」 | 还可以去「音乐探索」，沿真实的合唱关系找音乐。 | 61–62 | cut | STATIC | REHEARSAL (S14d) |
| 22 | C | 2:35 | 10 | end card: MUSIC / space, 「同一刻，另一面。」, 「AI 只建议视角，选择由你。」, link pill, QR, three avatars waving | – (card text) + foot 「示例角色、场次与照片均为虚构（AI 生成）· 示例角色自动回应 / 在线 Demo 在浏览器内运行 · 照片不上传」 | **63 RESOLVE**: big warm chord, drums out at 64, 3 s tail | fade 0.5 | CARD | FINAL |

Persistent disclosure on every product shot (bottom-right of the band, 20 px mono): 「示例现场 · 角色与照片为虚构 · 照片不上传」; on M3 and S1 (when recorded on the Node server) 「演示：同一台电脑上的两个独立浏览器身份」.

## 2. Shot cards

### H0 — hook (0:00–0:12.5) · STATIC · `capture/routeb/shots/rb-h0-hook.mjs` (reference: RC4 `shots/s00-hook.mjs`)
- **Visual.** The real 3D room, full-bleed 16:9 via the recording-only stylesheet `capture/cinematic.css` (hides header/nav/panels, canvas fills the window: a layout change like resizing the browser, the scene is untouched). Bar 1 slow digital push-in on the overview; bar 2 glide to a cast member (real 0.95 s camera glide); bar 3 glide to the photo wall; bar 4 pull back to the overview, a fourth avatar arrives (RC4: staged late guest; Route B: 林间·示例 if her arrival falls in the window); bar 5 dim + lockup. Cinema grade (warm curves, highlight bloom, vignette) only on this shot (`"grade": "cinema"` in the timeline); product UI is never graded.
- **Text.** 12.5 s total; honesty note first, lockup from 10.0 s (`cards/out/h-lockup.mov` alpha + `h-shade.png`).
- **Music.** Warm hook; soft impact exactly on the lockup (bar 5 = 10.0 s).
- **Acceptance.** 4 distinct illustrated avatars visible; no loading state; no UI chrome; note visible ≥ 3 s.

### P1–P3, Q — kinetic-type pain beats (0:12.5–0:32.5) · CARD · `cards/card-b-pain.html`, `card-b2-groupalbum.html`, `card-b3-noopening.html`, `card-d-whatif.html`
- Product visual language (warm paper → night green, polaroids, 2D avatars from the product's own `illustrated-avatar` SVGs), 60 fps stepped render, 5 s each; the AI-generated demo photos (`web/assets/stage-scene.png`, `crowd-scene.png`) are labelled 「示例照片由 AI 生成 · 虚构场景」.
- Beat logic: P1 *you only have your angle* → P2 *the group album cannot tell the same moment* → P3 *nobody can say hi safely* → Q *what if it came back, by consent?* (the lock opens, the second polaroid un-blurs).
- Re-render: `cards/render-all.sh` (≈3 min).

### E1 — landing (0:32.5–0:37.5) · STATIC · `rb-e1-landing.mjs`
- Open the Pages link in a clean profile. Show the status line 「示例现场 · 在本页运行」 (not the 1–4 s 「正在布置示例现场…」), the presence card (title 「同一刻，另一面。」; copy 「同一晚，你拍了舞台，TA 拍了人海。AI 在本机给你一个视角建议，规则帮你找到同一刻的另一面，双方同意才交换。」; the AI sentence is absent if the browser cannot run the model) and the solid button 「进入示例现场」. Director eases onto the card (zoom ≤ 1.45), cursor travels to the button.
- Drop on the downbeat (bar 14): the picture cut and the groove entry are the same frame.

### E2 — entry (0:37.5–0:47.5) · STATIC · `rb-e2-entry.mjs`
- Click 「进入示例现场」 → panel 「带上小人，进入示例现场」: type a nickname (default is 访客+digits; we type 「阿宁」), 「现在换个造型 ↗」 → wardrobe (one preset + save) → the **one** consent checkbox 「我愿意向本场成员（示例角色）展示我的昵称和小人。数据只存在这个浏览器里。」 → submit. Raw take is ~11–13 s: speed it to 1.2–1.3× in assembly (`speed`) to fit 10 s.
- Caution: `.panel input:not([type=checkbox])` makes radio buttons full-width blocks (the participation options render as giant boxes with vertical text). Visible in RC4 (`stills/explore/04-create-form.png`). It must be fixed in the build before recording (cross-scope request, §6) — the entry panel has the same participation radios.

### E3 — in the room (0:47.5–0:52.5) · STATIC · `rb-e3-room.mjs`
- The room right after entering: the three cast (labelled 「·示例」 by the product) + you, heading 「回声现场 · 示例场」, venue 「月台 Livehouse（虚构场地）」, tour card 「示例路线 1/4 · 放一张你的照片」. Slow 1.18× push-in. Caption makes the labelling explicit.

### A1 — the wall by moment (0:52.5–1:02.5) · STATIC · `rb-a1-wall.mjs`
- Tap the 3D wall (camera glides), 「看照片」 → list with the group header 「21:47 · 同一刻 · 3 个视角：舞台 · 人海 · 细节」, the second group 「22:21」 and the rule line. Director tracks the panel. Say once, on screen: *rules, not AI*.

### A2a / A2b — capture time + the AI line (1:02.5–1:12.5) · STATIC · `rb-a2-upload-reveal.mjs` (one ~22 s take cut into A2a 7.5 s / A2b 2.5 s / M1 10 s)
- Tap 「人海 · 示例照片」 on the tour card (inline button, sample first): the form shows the photo, 「拍摄于 21:48 · 来自照片自带的信息」 (sample time is fictional, stated in About) and **「AI 判断：人海」** pre-selected (visibility already 「分享给本场成员」). Hold 2.6 s for reading. Tap 「保存这张照片」.
- **The 10 MB model download must never be recorded**: `warmModel()` runs the model once in real time before the clock is frozen (no 「首次需下载模型 · 43%」 state in the take). If the browser cannot run the model, record the manual path and drop every AI caption (the product itself says only one honest line then).
- A2b: the wall opens, the photo sits in the 21:47 group, the 3D wall updates; caption 「照片不上传。」 (the page says 「照片只在这个浏览器里处理和保存，不会上传」).

### A3 — the honest case (1:12.5–1:17.5) · STATIC · `rb-a3-unsure.mjs`
- Fresh visitor (own take, then edited in): 「舞台 · 示例照片」 → **「不确定，请选择」**, two dashed suggestions, no pre-selection; the person chooses 舞台. This is the moment that proves AI is "the eyes, not the judge".

### M1 — the reveal (1:17.5–1:27.5) · STATIC · tail of `rb-a2-upload-reveal.mjs`
- After saving, the wall shows 阿遥·示例's stage photo with **「同一刻的另一面」**, reason 「同一刻 · 21:47，相差不到 1 分钟；你拍人海，TA 拍舞台」, the button 「和 TA 交换这个视角」; every photo says who decided the side (「作者选择」 / yours 「AI 建议，未改动」). Director zooms to the badge + reason (≥ 4 s of reading). Second caption: pairing and reasons are rules.
- Music: the rising four-note bell figure lands as the badge appears (bar 32).

### M2 — consent + exchange (1:27.5–1:42.5) · STATIC · `rb-m2-exchange.mjs`
- Tap the button → compose (your photo pre-selected and marked 「推荐 · 同一刻的另一面」) → tick the consent → 「把这两张交给对方确认 ↗」 → 3–5 s later 「交换已接受」 and both photos. The take steps frames while the autopilot "thinks" (virtual 2.5 s + poll), so no dead air. The NPC rule (offering the same side as theirs is politely declined) is **not** shown here; it is in About.
- Music: pad swell when 「交换已接受」 appears (bar 40; retime with `hits.mjs`).

### M3 — optional two-person insert (1:42.5–1:52.5) · **NODE×2** · RC4 reference `shots/s03-join-duo.mjs` / `s10-exchange-duo.mjs`
- Split-screen (`assembly/compose-duo.mjs`): two real browser identities on one real Node server (阿遥 / Lin), each phone-size, A waits «等待本人回应», B reads the preview, ticks, accepts; both show 「交换已接受」. **This is the full version, not what the Pages link does.** The design rule "never record a Route B video from the Node package" is about the main walk-through; this 10 s insert is the only Node footage and must carry the labels 「完整版」 and 「演示：同一台电脑上的两个独立浏览器身份」. **Keep it only if the field-04 intro also mentions the full version**; otherwise cut it (`timeline.v2.noM3.json`, 155 s).

### S1 — greet and chat (1:52.5–2:07.5) · STATIC · `rb-s1-greet-chat.mjs`
- Open 小满·示例 (3D person or 同场的人) → 「向 小满·示例 招个手」 → accepted in ~3–5 s with two welcome lines → 「和 小满·示例 私聊」 → type one line → automatic reply in ~3–5 s. Caption states the replies are automatic and do not learn.

### S2 — the quiet rule (2:07.5–2:10) · STATIC · `rb-s2-quiet.mjs`
- 林间·示例 arrives ~8 s after you joined and cannot be greeted: 「TA 选择安静参与，不接收新招呼」. 2.5 s, one beat; proves consent runs both ways.

### S3a / S3b — after-show room (2:10–2:20) · STATIC · `rb-s3-aftershow.mjs`
- 散场聊天室 with the seeded lines (labelled automatic), the album cup (专辑杯) and the preference game. Montage energy: LIFT starts on S3a.

### K1 — recap and the real PNG (2:20–2:30) · STATIC + CARD · `rb-k1-recap-card.mjs` + `cards/card-k-memory.html`
- 回看这一晚 → 「保存我的纪念卡」 → real PNG preview → download. The script saves the exported PNG; copy it to `cards/assets/memory-card.png` and re-render card K so the keepsake shown is the real file the build produced (nickname, avatar, photo).

### K2 — Music Map round trip (2:30–2:35) · STATIC · `rb-k2-map.mjs`
- 音乐探索 opens the original Map inside the same site, with the return bar 「返回现场」. Breadth, not depth: 5 s.

### C — end card (2:35–2:45) · CARD · `cards/card-c-end.html`
- 「Music Space」 wordmark, 「同一刻，另一面。」, closing line 「AI 只建议视角，选择由你。」, link `musicmapteam.github.io/musicSpace/`, QR (decodes to the link, checked by `assembly/decode-qr.mjs`), 「浏览器直接打开 · 无需安装」, disclosure lines. 10 s so the QR can be scanned.

## 3. Sync points (hit points) and how to retime

Bar grid: 96 BPM, 1 bar = 2.5 s, 1 beat = 0.625 s. Hard sync (fixed by construction): bar 5 (10.0 s) title lockup + soft impact · bar 14 (32.5 s) product drop · bar 63 (155.0 s) end card chord. Moment sync (depends on the final take): chip (A2a), badge (M1 = bar 32 by construction), accepted (M2).

1. Record the final shots, assemble once, note the second inside each raw clip where the AI chip appears (`A2a.ai_chime`) and where 「交换已接受」 appears (`M2.consent_swell`).
2. `node assembly/hits.mjs assembly/timeline.v2.json hits.json > music/score-config.final.json` (fractional bars allowed for these two cues).
3. `SCORE_CONFIG=music/score-config.final.json SCORE_OUT=music/original-v2-final music/…/python music/gen_original_v2.py` (8 s), normalise with the two commands in `MUSIC.md`, point `timeline.music.file` at the result.
4. If a shot ends up longer/shorter than its slot, change `speed` / `in` / `hold` in the timeline, never the slot (slots are the bar grid).

## 4. What must be visible on screen (honesty checklist for the final cut)

- 0:00–0:05 「示例角色与照片均为虚构（AI 生成）」 (hook note).
- E3: cast names with 「·示例」 visible in the product, caption says 示例角色.
- A1: 「规则判断，不是 AI」 (product copy) + caption.
- A2a: 「拍摄于 21:48 · 来自照片自带的信息」 and 「AI 判断：人海」 together; A3: 「不确定，请选择」.
- M1: caption «规则算的，不是 AI»; badge + reason legible (zoomed).
- M2: the consent sentence legible before the send button is pressed; caption «示例角色会自动回应».
- S1: caption «自动的，不会学习». S2: quiet rule.
- Every product shot: band note 「示例现场 · 角色与照片为虚构 · 照片不上传」.
- No claim of: real users, launch, accuracy, real-phone validation, "AI pairs people", cross-device exchange on the Pages link. No tokens, private data, QR to anything but the Pages link.

## 5. Source map — what needs which build

| Source | Shots |
|---|---|
| Route B **static Pages build** (one viewer) | H0, E1, E2, E3, A1, A2a, A2b, A3, M1, M2, S1, S2, S3a, S3b, K1, K2 |
| Real **Node server, two browsers** (full version, optional) | M3 only |
| HTML cards (no capture) | P1, P2, P3, Q, C, card K (K1 tail), hook lockup |
| Assembly only | grade (H0), overlays, captions, music |

## 6. Decisions / cross-scope items for the lead (found while pre-producing)

1. **RC4 layout defect that the Route B entry panel inherits**: `web/event-room/style.css` `.panel input:not([type=checkbox])` also matches `type=radio` → participation options become 46 px full-width blocks with vertical text (create-room and join panels in RC4; judgePath step 1 has the same radios). Fix: `:not([type=checkbox]):not([type=radio])`. Evidence: `stills/explore/04-create-form.png`; rehearsal-only workaround `capture/workarounds.css`.
2. **Tagline mismatch**: in-scene sign `web/event-room/venue-art.js:39` says 「同一晚，另一面。」, product claim and presence card say 「同一刻，另一面。」. Cards and captions use 「同一刻」.
3. **Native file chooser language**: on this Mac the system Chrome renders `<input type=file>` as "Choose File / No file chosen" even with `locale: zh-CN` (UI language follows the OS). Route B hides it behind sample buttons; if the file input is visible in a shot, mask it or record on a zh-CN macOS.
4. **M3 yes/no** (see M3). Recommendation: no, unless the intro names the full version.
5. **Music**: original v2 (rights-safe, bar-locked) vs a CC0 track (`MUSIC.md`). Nobody has *listened* to either on this machine; the owner must audition before locking.
6. **Preview ribbon**: record on the frozen root, not `/preview/` (the design hides the ribbon with injected CSS if present; not needed on the root).
7. **Model first-load** (≈10 MB gz): pre-warmed in real time before recording; the final video must not show a 「43%」 state except as an optional honest beat.

## 7. Assets and how to rebuild (details in `PIPELINE.md`)

| What | Where |
|---|---|
| Timeline source of truth | `assembly/make-timeline-v2.py` → `assembly/timeline.v2.json` / `timeline.v2.noM3.json` |
| Assembly | `assembly/assemble.mjs` (animatic: `--animatic --scale 0.5 --fps 30`; final: no flags) |
| Captions | `assembly/render-subs.mjs` (Chrome-rendered PNGs, band style) |
| QC | `assembly/qc.mjs` (+ `QC-CHECKLIST.md`) |
| Cards | `cards/*.html`, `cards/render-all.sh`, `cards/out/*.mp4|png` |
| Capture kit | `capture/rec.mjs` (frame-stepped recorder + camera director), `capture/shots/*` (RC4 reference), `capture/routeb/*` (Route B drafts) |
| Music | `music/original-v2*/`, `music/0*-*/` (CC0 + proofs), `MUSIC.md` |
| Latest rehearsal cut | `assembly/out/space-v2-rehearsal.mp4` (1080p60) and `animatic-v2.mp4` (540p30) |
