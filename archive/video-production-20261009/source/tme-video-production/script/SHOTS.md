# Music Space · Doodle video · product shots for the capture pass

Draft 1 · 2026-10-07. What to record on the restyled build, exactly how to reach each state, and what each clip feeds in `STORYBOARD.md` (shot IDs H1…C1). Every step and selector below was run on `dist-pages` on 2026-10-07 in system Chrome (my probe screenshots are in `probe/shots/`, listed in §8), except TAKE-P3, which comes from the restyle QA script `/tmp/space-doodle/social-work/p-final-states.js` (run on the dev server, not re-run here).

## 0. Rules

- **Our own build only.** Serve `dist-pages` under `/musicSpace/` (below). Record the root path, not `/preview/`. If the build that gets published differs from this one (PROJECT_STATUS lists open fixes: sticky 「×」 in long panels, the polaroid caption line break in recap/collection, desktop chat scroll), re-take the clips that show those places (P-08, P-13, P-19).
- **Real states only.** No injected DOM, no mocked panels, no edited storage. The creation corner is shown at its real state (invitation + 「等待朋友本人明确参与…」); the old `/tmp/space-doodle/social-work/corner-mock.cjs` output is a mock-up and must not be used. Waits may be cut in the edit; they may not be faked.
- **Not in the video:** Music Map (「音乐探索 ↗」, old art, real artists' names), the native file chooser (「用我自己的照片」 opens an English system dialog on this Mac), devtools, browser chrome, a cursor other than the rig's tap ripple, the `/preview/` ribbon.
- **Visitor:** nickname 「阿宁」, look preset **「失真」 (`[data-preset="4"]`)**. The cast already wears 断拍 (北屿), 循迹 (小满), 回声 (阿遥) and 脉冲 (林间), and a new visitor's default look is random per session, so always set it.
- **Fresh world per take:** every new browser context is a new example world (IndexedDB is per context). Never reuse a context between takes that must start clean.
- **Tab visible:** the cast answers only while the tab is visible (headless counts as visible).

## 1. Setup

```sh
# server (any free port; stop it afterwards)
cd /Users/alakazan/workplace/tme/musicSpace && node scripts/pages/serve-prefix.mjs dist-pages /musicSpace/ 4971
# URL: http://127.0.0.1:4971/musicSpace/
```

```js
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'] });
// PHONE 1080x2340: CSS 390x845 at DPR 1080/390
const phone = { viewport: { width: 390, height: 845 }, deviceScaleFactor: 1080 / 390, isMobile: true, hasTouch: true, locale: 'zh-CN', timezoneId: 'Asia/Shanghai' };
// DESKTOP 1920x1080 delivery, 3840x2160 master (zoom headroom for the 3D room): CSS 1440x810 at DPR 8/3
const desktop = { viewport: { width: 1440, height: 810 }, deviceScaleFactor: 8 / 3, locale: 'zh-CN', timezoneId: 'Asia/Shanghai' };
await page.goto(URL); await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready');
```

- Recorder: the frame-stepped rig `/tmp/space-video-prep/capture/rec.mjs` (virtual clock, 60 fps CFR, camera director with crisp CDP zoom, `until()` steps frames while the cast "thinks"; see `/tmp/space-video-prep/PIPELINE.md` §1–4). Open sessions with the sizes above. Its gotchas still apply: do not load the machine while capturing; warm things in real time before `freeze()`.
- **On-screen clock:** chat timestamps, 「申请有效至 …」 and the memory card's 「保存于」 date show the machine clock. Install the rig's fake clock at an evening *after* the build time (build 2026-10-07 03:33 +08:00; the runtime clock never goes earlier), e.g. **2026-10-07 22:40 +08:00**, so the screens read like "after the show". The sample photos' own times (21:47/21:48 on 2026-09-26) are written in the files and are not affected.
- **AI model warm-up:** the model (~10 MB) downloads in the background after entering the room; from localhost it is ready within seconds. Wait ≥ 9 s in the room before the first upload (this also lets 林间·示例 arrive, ~8 s after you). If the AI line reads 「AI 在本机判断视角…」 or mentions downloading, wait and retake.
- **Beat choreography:** the rows marked ♩ below are rhythmic sequences; place the clicks at exact multiples of the beat (0.4839 s at 124 BPM) from a marked start, with 2 beats of handle before and after. Everything else can be captured freely and cut on the beat in the edit.
- Output: phone clips 1080×2340 60 fps, desktop clips 3840×2160 60 fps (deliver 1920×1080), stills as PNG; name them by the IDs below (`P-05.mp4`, `CUT-04.png`, …).

## 2. Measured timings (real time, this build, localhost, 2026-10-07)

| Event | Time |
|---|---|
| tap 「进入示例现场」 → room | < 0.1 s |
| tap a sample → upload form | immediate; AI chip after 0.23–0.31 s (model warm) |
| 林间·示例 joins | ~8 s after you enter |
| send exchange → 「交换已接受」 | 3.8 s |
| greet 小满·示例 → 「你们已经认识了」 | 3.9 s (toast 「招呼已送达，等待对方决定」 first) |
| send a chat line → reply | 4.2 s |
| join the game → round starts | 1.9 s; submit → reveal 2.2 s |
| World Cup vote | immediate (2 票 · 你选了这张); the cast's votes arrive on refresh |
| memory card | download immediate; PNG 1080×1440 (`MusicSpace-memory-<date>.png`) |

## 3. Phone takes

### TAKE-P1 — the judge route, one continuous world (feeds E1–E3, A1–A2, A4–A5, M2–M7, S1–S2, S4–S10, CUT-04…08, 11–13)

| Step | Do (selector) | Expect on screen | Clip / still | Storyboard |
|---|---|---|---|---|
| 1 | open the page, wait for boot | phone first screen: doodle 3D stage, 「进到同一个现场」 sticker, card 「同一刻，另一面。」, copy 「同一晚，你拍了舞台，TA 拍了人海。AI 在本机给你一个视角建议，规则帮你找到同一刻的另一面，双方同意才交换。」, button 「进入示例现场」 | **P-01** (6 s hold with the rig's slow push, then the tap on `#join`) · **CUT-13** = full-screen still | E1 · W1 |
| 2 | tap `#join` | panel 「带上小人，进入示例现场」 | (part of P-03) | — |
| 3 | tap `form[data-form="demo-entry"] button:has-text("现在换个造型")` | wardrobe 「MY ALTER EGO / 今晚，我这样。」, stand with 「试穿中 · 仅自己可见」 | **P-02** starts | E2 |
| 4 ♩ | open `summary:has-text("试试组合示例")` (it is below the parts grid; scroll the wardrobe so the stand stays visible), then on 4 consecutive beats tap `[data-preset="0"]` 留白, `"1"` 断拍, `"2"` 循迹, `"4"` 失真; then on the next 4 beats `[data-angle="front"]`, `"side"`, `"back"`, `"quarter"`; fill `.wardrobe input[aria-label="昵称"]` = 阿宁; tap `[data-wardrobe-save]` 「保存这个我 ↗」 | the figure changes on every beat, then turns on every beat; toast 「小人已保存，下次碰面也能认出你」; the panel closes | **P-02** (≈ 10 s incl. handles) · **CUT-02** = still of the stand with 失真, 3/4 | E2 · H1 |
| 5 ♩ | tap `#join` again; the nickname field shows 阿宁; scroll to 「这一场，我想怎样参与」 (`input[name=participation][value=open]` 「愿意打招呼」 stays selected; 「安静参与」 is the other option); tick `input[name=consent]` on a beat; tap `button.primary` 「进入示例现场」 two beats later | the two participation options, the consent sentence 「我愿意向本场成员（示例角色）展示我的昵称和小人。数据只存在这个浏览器里。」 | **P-03** (≈ 6 s) | E3 |
| 6 | wait ≥ 9 s in the room (cut in the edit) | room: 「月台 Livehouse（虚构场地）」, 「回声现场 · 示例场」, labels 「阿遥·示例 · 可招呼」「小满·示例 · 可招呼」「北屿·示例 · 可招呼」「阿宁 · 我」, route card 「示例路线 1/4 · 放一张你的照片」 with buttons 「人海 · 示例照片 →」「舞台 · 示例照片」「用我自己的照片」 | **P-04** (last 4 s of the wait + the tap) | A1 |
| 7 | tap `[data-tour-action="sample:sample-crowd"]` | upload form 「留一个现场瞬间 / 这一张，由你决定给谁看。」, polaroid, 「拍摄于 21:48 · 来自照片自带的信息」, note 「示例照片 · 虚构的拍摄时间 21:48，写在文件里」; the form scrolls itself toward the photo, then scroll `#panel` further if needed (≈ 520 CSS px from the top): 「我拍的这一面」 chips, **「✦ AI 判断：人海」**, 人海 pre-selected, hint 「配对时，用它来找互补的那一面。AI 在本机判断，照片不上传，没把握就不替你选，选了也随时可改。」, visibility 「分享给本场成员」 | **P-05** (≈ 8 s: form appears, scroll, the chip arrives — mark its first frame for the 31:3 chime) · **CUT-04** = element still of `.moment-ai-tag` + the four chips | A1 · A2 · H1 · W3 |
| 8 | tap `form[data-form="upload"] button:has-text("保存这张照片")` | toast 「已分享给本场成员」; the wall panel slides in | **P-07** (≈ 3 s) | A4 |
| 9 | wall panel: hold at top, then scroll `#panel` to the badge, then to y≈700 and y≈1300 | 「同一场 / 不同视角 · 这一晚，大家看到了什么？」, ribbon 「AI 建议视角 → 规则找同一刻 → 双方同意才交换」, **「21:47 同一刻 · 3 个视角：舞台 · 人海 · 细节」**, rule 「按拍摄时间分组（相差不超过 3 分钟），规则判断，不是 AI」, pink badge **「同一刻的另一面」**, reason 「同一刻 · 21:47，相差不到 1 分钟；你拍人海，TA 拍舞台」, button 「和 TA 交换这个视角」; polaroids with 「拍摄于 21:47 · 视角：舞台 · 作者选择」 and yours 「AI 建议，未改动」; group 「22:21」 | **P-08** (≈ 14 s, slow scroll with pauses at header, rule line, badge, grid) · **CUT-05** = element still `[data-moment-badge="other-side"]` (badge + reason + button) | A5 · M2 · H1 |
| 10 ♩ | tap `[data-exchange-offer]`; scroll to the consent; tick `[data-x-consent]` on a beat; tap `[data-x-send]` 「把这两张交给对方确认 ↗」 on the next beat but one | 「同一晚 / 另一面 · 交换一个视角」, 「用我拍下的，换 阿遥·示例 看到的。」, two polaroids with ⇄, select 「我的第 1 张 · 已上墙 · 同一刻的另一面（推荐）」, card 「推荐 · 同一刻的另一面 … 规则判断，不是 AI。要不要交换，仍由你和对方决定。」, agreement 「发送后，阿遥·示例 可以看并保存我的小图预览…」, tick 「我同意提供选中照片的预览，并在对方接受后分享这张原图」 | **P-09** (≈ 9 s) · **CUT-11** = still of the tick + the send button | M3 · M4 · W3 |
| 11 | wait (do not cut in the take) | 「等待本人回应」 + 「和 阿遥·示例 的两张照片」 + 「对方尚未同意，原图还没有通过本次交换开放。」 → after 3.8 s **「交换已接受」** (mint sticker with star), both polaroids, 「双方已明确同意。退出房间后，还能从「照片交换」回来查看。」, 「撤销这次交换的在线访问」, 「任一方撤销，会同时结束本次两张照片的在线访问；原件仍归各自。已下载或截图的副本无法远程收回。」; then scroll to the bottom | **P-10** pending (the whole wait; mark the first frame of 「交换已接受」) · **P-11** accepted (≈ 6 s incl. the scroll) · **CUT-06** = still of the sticker + both polaroids | M4 · M5 · M6 · M7 · H1 |
| 12 | `[data-x-close]`; tap `[data-view="person"]` | 「同一晚，同一场 · 看看同场的人」: 阿遥/小满/北屿/林间, each 「示例角色 · 自动回复」, 「愿意打招呼 · 看看 TA 的视角 →」, 林间 「安静参与」 | (optional P-12a list) | — |
| 13 | tap `[data-person]:has-text("小满")` | 3D close-up of 小满·示例 (headphones, wink, mic) + card 「先招个手，对方愿意回应后，你们才会成为朋友。」 + 「向 小满·示例 招个手」 | **P-12** starts | S1 |
| 14 | tap `[data-social-send]`; wait | 「已招手，等待本人回应」, toast 「招呼已送达，等待对方决定」 → 3.9 s → 「你们已经认识了」, 「邀请共同创作」, 「和 小满·示例 私聊 ↗」, header ♡ 2 | **P-12** (whole wait; the edit cuts it) | S1 |
| 15 ♩ | tap `[data-open="chats"]`; type into `.private-chat textarea` 「返场那首我在人海里，手都举酸了！」 (16ths); send `.private-chat .chat-composer button[type=submit]` on a beat; wait for the reply | 「ONE TO ONE 小满·示例」, 「已互相接受联系。这里只保存文字，不展示在线状态。」, bubbles 「嗨，欢迎来到「回声现场」。我是示例角色，由这个页面自动回复。」 / 「你拍到的是哪一面？」, yours (mint), reply 「今晚的返场太好听了。」 after 4.2 s | **P-13** (≈ 12 s) · **CUT-07** = still of the bubbles | S2 · H1 |
| 16 | close the chat (Escape / `.private-chat .chat-close`); `#scene-details`; `#panel [data-open="conversation"]`; tick the join consent and submit | 「散场以后，也留一个位置 · 回声现场 · 示例场」, 3D header, lines from 阿遥/小满/北屿 each ending 「（示例角色的自动回复：我不是真人。）」 | **P-14** (≈ 5 s incl. a slow message scroll) | S4 |
| 17 ♩ | `[data-group-worldcup]` (scroll `.conversation-actions` sideways if needed) → `.worldcup-panel .entry-list button` 「今晚的专辑世界杯」 → `[data-cup-choice][data-album="night-platform"]` 「选《午夜站台》」 → in `form[data-cup-vote]` (「确认把这一票计入《午夜站台》？」) tick `input[name=consent]` 「确认投票，提交后这一轮不能改票」 and submit 「确认这一票」 | VS card: 01 原创虚构专辑 午夜站台 / 纸灯乐队 vs 02 樱花电波 / 薄荷收音机; after the vote 「2票 · 你选了这张」; after `[data-cup-refresh]` 「本轮选择：《午夜站台》」 | **P-15** (≈ 8 s) · **CUT-12** = still of the VS card | S5 · W3 |
| 18 | `[data-cup-close]`; `[data-group-games]` → `.music-games .entry-list button` 「今晚谁和你同一首」 → `form[data-game-form="join"]` tick 「我自愿参加这一局」 + 「明确加入小游戏」 → (1.9 s) `[data-game-choice="night-platform"]` → `form[data-game-form="answer"]` tick 「确认提交本轮选择；本轮不能改票」 + 「先保留我的选择」 → (2.2 s, `[data-game="refresh"]`) reveal | round with four original fictional albums; reveal 「2 人选择 · 本轮有共同选择」, 「只描述这一局出现的共同选择，不代表人格或匹配程度。」 | **P-16** (whole thing; the edit cuts the waits) | S6 |
| 19 | `[data-game="close"]`; `[data-group="close"]`; `#scene-details` → `[data-open="communities"]` → in `.music-community form[data-community-create]` type `input[name=title]` 「周五散场以后」 (16ths), tick consent, submit 「创建我的社群」 → open it from `.music-community .entry-list button` | 「音乐社群 · 主办方的长期空间。每次加入都由你选择；不订阅营销，不扩大照片权限。」 → community room: 3D header 「周五散场以后」, 「1 位社群成员 · 不是在线人数」 | **P-17** (≈ 8 s; verified on dist-pages 2026-10-07, `probe/shots/p33-community-*`) | S7 |
| 20 | close; `[data-view="person"]` → 小满 → `[data-open="corners"]` 「邀请共同创作」 → tick → 「创建共同创作邀请」 | 「TWO SIDES / 两个人的创作角 · 一起留张纪念。」 → 「等待朋友本人明确参与。你不能替对方同意，也不会自动分享照片。」 | **P-18** (≈ 5 s) | S8 |
| 21 ♩ | close; `#scene-details` → `#panel [data-open="recap"]` 「回看这一晚」 → `[data-open="memory-card"]` 「保存我的纪念卡 ↗」 → on three beats tick `input[name=memory-photo]`, `input[name=memory-avatar]`, `input[name=memory-confirm]`; on the 4th beat tap 「下载纪念卡 PNG」; save the download | recap 「这一晚 · 仍在进行 / 回声现场 · 示例场」, 「散场以后，继续聊。」, card **「把这一晚，留在手里。」**; form 「保存我的纪念卡 · 回声现场 · 示例场 · 署名：阿宁」, your polaroid, 「带上已保存的小人」, confirm 「确认仅将所选内容下载到我的设备。照片可见范围不变。」 → 「已发起下载…」 + preview 「你的纪念卡」 | **P-19** (≈ 10 s) · **CUT-08** = the downloaded PNG (1080×1440) | S9 · H1 |
| 22 | close; tap `#my-space` | 「MY SPACE / 长期留在这里」: avatar, 阿宁, 「现场是认识的起点，散场后仍有地方回来。」, tiles 我的音乐社群 / 我的现场与回顾 / 好友与新招呼 / 私聊回访 / 共同记忆 / 身份备份与恢复, 我的现场 回声现场 · 示例场, 我的音乐朋友 小满·示例 | **P-20** (≈ 4 s) | S10 |

Also useful from this world: `[data-view="photos"]` on the phone (3D wall, 5 polaroids, 「同一场，不同视角 · 看照片 · 5 · 放一张」) as a spare.

### TAKE-P2 — the honest case (fresh world, never saved; feeds A3)

| Step | Do | Expect | Clip |
|---|---|---|---|
| 1 | new phone context; set the look (失真) and enter as in P1 steps 2–5; wait ≥ 9 s | room | — |
| 2 | tap `[data-tour-action="sample:sample-stage"]` 「舞台 · 示例照片」; scroll `#panel` to the chips | 「拍摄于 21:47 · 来自照片自带的信息」, note 「虚构的拍摄时间 21:47，写在文件里」, AI line **「✦ 不确定，请选择」** (dashed), chips 舞台 and 人海 dashed with sparkles (`.is-suggested`), nothing selected | **P-06** (≈ 6 s) |
| 3 ♩ | on a beat tap `[data-moment-viewpoint="stage"]` | 舞台 selected (yellow, check) | (end of P-06) |
| 4 | close the panel without saving | — | — |

Measured 2026-10-07: the model is sure about the crowd sample (「AI 判断：人海」) and unsure about the stage sample (「不确定，请选择」, suggestions 舞台 + 人海). If a later model or threshold changes either result, film what the build actually says and adjust A2/A3 text (never stage it).

### TAKE-P3 — spare: 成员音乐话题 (only for the +4 elastic bars)

In a P1-like world: conversation → `[data-group-topics]` → open the form (`.music-topics details`), `input[name=title]` 晚班列车, `input[name=artist]` 纸灯乐队, `input[name=note]` 返场前那段鼓点，你们是不是也在跟着拍手？, tick consent, submit → the posted card. Both names are fictional (the example's own song). **P-21**.

## 4. Desktop takes (CSS 1440×810, DPR 8/3 → 3840×2160)

| Take | How | What to record | Clip / still | Storyboard |
|---|---|---|---|---|
| **TAKE-D1** landing | fresh context, boot, do not enter | the landing: left column 「这一晚的另一个视角，就在你身边。」, 「主办方开房，观众带上自己的小人入场…」, handwritten 「就是这一刻！」 + arrow; 3D stage with 「MUSIC SPACE / LIVEHOUSE · 进到同一个现场 · 这一晚，从这里开始」; card 「同一刻，另一面。」 + 「进入示例现场」; header pill 「示例现场 · 在本页运行」 | **D-01** (6 s, slow push toward the title card; also a clean still for the H2→H3 match cut: note the card's title position) | H3 |
| **TAKE-D2** room hero | fresh context; `#join` → 「现在换个造型 ↗」 → preset 失真 → save → `#join` → nickname 阿宁, consent, enter; wait ≥ 9 s (林间 arrives); tap `[data-tour-skip]` 「跳过路线」 | overview: the five on the doodle stage with labels (林间·示例 · 安静 included), 「5 位已加入 · 正在进行」, song card 「这一晚 · 晚班列车 / 原创示例声景 · 不代表真实演出 · ENCORE / 01」, presence card 「同一晚，各自的视角。」; then the real camera glides `[data-view="photos"]` → `[data-view="person"]` → `[data-view="overview"]` (one per 2 bars) | **D-02** (≈ 20 s: 8 s still-ish overview for E4/W5 + the glides) · **CUT-01** = still of the overview | E4 · W5 · H1 · +2 |
| **TAKE-D3** 3D wall before/after | fresh context, enter as D2 (wait ≥ 9 s); `[data-view="photos"]` → 3D wall with the sign 「同一晚，另一面。 MUSIC SPACE / OUR POINTS OF VIEW」 and 4 polaroids → record; then `[data-open="upload"]` 「放一张」 → `[data-sample-photo="sample-crowd"]` → save → close the panel → `[data-view="photos"]` again → 5 polaroids → record from the same camera view | **D-03a** before (3 s), **D-03b** after (3 s); the cut between them is the 36:3 pop · **CUT-03** = still of D-03b | A4 · H1 · +3 |
| **TAKE-D4** the quiet one | in D2's world (after 林间 arrived): close panels, `[data-view="overview"]`, tap `[data-kind="person"]:has-text("林间")` | 3D close-up 「林间·示例 · 近景」 + button 「认识一下」 (record 3 s of the glide + hold), then tap 「认识一下」: card 「TA 选择安静参与，不接收新招呼。仍可查看 TA 已分享给本场的照片。」 | **D-04** (≈ 6 s) | S3 |

Spare (desktop): the exchange and accepted screens exist on desktop too (right-hand paper panel beside the 3D room, `probe/shots/d07-wall-badge.png` shows the wall panel with the badge); use them only if a phone clip fails.

## 5. Cut-outs and exports

| ID | What | How |
|---|---|---|
| CUT-01 | 3D room overview | still from D-02 (3840×2160) |
| CUT-02 | your avatar 失真 at 3/4 | still of the wardrobe stand (P-02), or the SVG `document.querySelector('.wardrobe .wardrobe-figure svg').outerHTML` after `[data-preset="4"]` + `[data-angle="quarter"]` (already exported: `probe/avatars/look-4-shizhen-quarter.svg`) |
| CUT-03 | 3D photo wall with 5 polaroids | still from D-03b |
| CUT-04 | 「AI 判断：人海」 + chips | `locator('.moment-ai-tag').screenshot()` and a region still of the four chips (P-05 state) |
| CUT-05 | badge + reason + button | `locator('[data-moment-badge="other-side"]').screenshot()` (P-08 state) |
| CUT-06 | 「交换已接受」 + both polaroids | region still of the accepted panel top (P-11 state) |
| CUT-07 | chat bubbles | region still of the four bubbles (P-13 state) |
| CUT-08 | the memory card | the downloaded PNG from step 21 (1080×1440). A reference export from my probe (look 脉冲, date 2026-10-06) is `probe/shots/memory-card-export.png`; re-export with 失真 and the final clock |
| CUT-09 | the two photos for M1 | the build's own files `dist-pages/demo/sample-crowd.jpg` (yours) and `yao-stage.jpg` (阿遥·示例) |
| CUT-10 | avatars for P3 / W4 / C1 | `probe/avatars/`: `cast-yao.svg`, `cast-man.svg`, `cast-bei.svg` (exact cast, serialized from the chat room `.community-panel article svg`), `look-0-liubai-*`, `look-4-shizhen-*`, `look-5-maichong-*` (wardrobe). 林间's exact look is not exported (she never posts); do not label 脉冲 as 林间 |
| CUT-11 | consent tick + send button | region still of P-09 after the tick |
| CUT-12 | World Cup VS card | region still of P-15 before the vote |
| CUT-13 | phone first screen | full still of P-01 |

Element stills: use the phone context (DPR 2.77) so they are crisp at the sizes in the storyboard; for the hook collage they are scaled to 360–760 px wide.

## 6. What each storyboard shot needs

| Shot | Needs | Shot | Needs |
|---|---|---|---|
| H1 | CUT-01…08 | M5 | P-10 |
| H2 | — (type) | M6 | P-11 (first frame of 「交换已接受」 = 51:1) |
| H3 | D-01 | M7 | P-11 (bottom) |
| P1 | web/assets/stage-scene.png, crowd-scene.png | S1 | P-12 |
| P2 | crowd-scene.png | S2 | P-13 |
| P3 | CUT-10 | S3 | D-04 |
| E1 | P-01 | S4 | P-14 |
| E2 | P-02 | S5 | P-15 |
| E3 | P-03 | S6 | P-16 |
| E4 | D-02 | S7 | P-17 |
| A1 | P-04, P-05 | S8 | P-18 |
| A2 | P-05 (first frame of the chip = 31:3) | S9 | P-19, CUT-08 |
| A3 | P-06 | S10 | P-20 |
| A4 | P-07, D-03a/b | S11 | CUT-01…08 |
| A5 | P-08 | W1 | CUT-13 |
| M1 | CUT-09 | W2 | — (type) |
| M2 | P-08 (badge) | W3 | CUT-04, CUT-11, CUT-12 |
| M3 | P-09 | W4 | CUT-10 |
| M4 | P-09, P-10 | W5 | D-02 |
| | | C1 | CUT-10, `frames/assets/qr.svg` |

## 7. Gotchas seen while probing

- Saving the wardrobe from the entry panel closes the panel (toast 「小人已保存，下次碰面也能认出你」); open `#join` again — the nickname and look are kept.
- The presets live inside the closed `<summary>` 「试试组合示例」 below the parts list; open it first, and scroll so the stand stays in view.
- `#panel` is the scroller of the upload form, the wall and the recap (not `#panel-body`).
- The AI line text can be stale for a moment when you switch samples inside one form (the old 「不确定」 stays until the new answer arrives); that is why the unsure case is its own take.
- The phone room draws four people (the cast that arrived first plus you); 林间 shows on desktop and in 同场的人.
- World Cup: the cast's votes and round advances appear on `[data-cup-refresh]`; the round needs the creator (阿遥·示例) to advance, which the autopilot does once three votes are in.
- The room panel `#scene-details` reads 「回声现场 · 示例场」 after entering (before entering it opens the entry panel).
- Recording the root under `/musicSpace/` with `serve-prefix.mjs` mirrors GitHub Pages (404 outside the prefix, no gzip, no-store).

## 8. Probe evidence (this pass, 2026-10-07; reference only, not for the edit)

`probe/shots/`: `p01-landing` · `p02-entry-*` · `p03/p04-wardrobe-*`, `p40-presets-0-4-2` · `p05-after-wardrobe-save` · `p06-entry-*` · `p07-room-*` · `p08-upload-0s/-ai/-end` · `p09-stage-ai` (unsure) · `p10-after-save-*` · `p11-wall-y700/-y1300/-y1900` · `p12-exchange-compose` · `p13-exchange-checked/-pending/-accepted` · `p14-people-view` · `p15-person-xiaoman` · `p16-greet-sent/-accepted` · `p17-chat-*` · `p18-room-tour4` · `p19-room-panel` · `p20-conversation*` · `p21/p22/p23-worldcup-*` · `p24/p25/p26-game*` · `p27-recap-top` · `p28/p29-memory-*`, `memory-card-export.png` · `p30/p31-corner*` · `p32-my-space` · `p33-community-form/-room` · `p41-photos-view`, `p41-overview-clean`, `p41-person-yao` · `p42-about-top` · desktop `d01-landing`, `d02-entry`, `d03-room*`, `d04-photos-view`, `d05-person-view`, `d06-upload-ai`, `d07-wall-badge`, `d08-photos-view-after-upload`, `d09-linjian-quiet`, `d10-linjian-card`, `d11-music-map` (excluded from the video) · `c-desktop-overview-clean-4k.png` (3840×2160). Scripts: `probe/lib.cjs`, `probe/driver.cjs`, `probe/q*.js`, `probe/cover-assets.cjs`, `probe/export-avatars.cjs`, `probe/check-community.cjs`.
