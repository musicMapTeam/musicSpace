# Music Space · Doodle film v2 — release notes (2026-10-07)

## 中文摘要（给产品负责人）

- **成片**：`out/music-space-video-v2.mp4` — 2:54.67（174.667 s，赛规 ≤ 3:00），225.4 MB（≤ 500 MB），1920×1080 60 fps H.264 + AAC，响度 −16.0 LUFS、真峰值 −1.3 dBTP，无水印；配乐 Wax Lyricist《Flipping In》（CC0，`flipping-in-b` 版剪辑）。
- **按你 10/7 的定位改了「社群」**：社群是 **Livehouse 自己的长期社群**。第 65–67 小节改为「Livehouse 的长期社群，／也给你留一个位置。／再见，在下一场。」；第 73–76 小节换成场地故事（新拍的真实主办方画面）：「Livehouse 开个房，」→「乐迷留在本地社群。」→「下一场的预告，」「直接发给社群。」→「场地有了自己的乐迷，」「更愿意推广。」。「设想 · QQ音乐、酷狗」那一页去掉了（片中不再出现任何平台名）。说法都对得上产品：主办方开房填场地、长期空间由主办方维护、向本社群成员发布活动预告、每人仍需自己同意入场；没有说推送营销、自动入场或拿到旧照片。
- **按你「去掉那些说明性文字，这个产品必须是完整的」**：画面上的「照片为 AI 生成的示例图」「示例角色 · 自动回复」「示例照片 · 拍摄时间为虚构」「原创虚构专辑」、W5 放大的「示例站」页脚、片尾的说明小字全部去掉；**片尾只留一行署名**：「演示角色与照片为虚构，照片由 AI 生成 · 配乐：Wax Lyricist《Flipping In》（CC0）」。封面也同步去掉了说明小字。
- **产品界面本身的说明文字**（「·示例」名牌、「示例路线」「示例照片」按钮、各种提示段落）还在实拍画面里——下面「需要重拍的镜头」一节逐条列出，产品文案改完后照单重拍即可（拍摄脚本都在）。
- **QC：没有 FAIL**（总评 WARN，与 v1 相同）。时长、体积、响度、真峰值、静音/冻帧/黑场、节奏（614/614 个画面事件都在 16 分音符网格上）、字体、二维码（解码 = `https://musicmapteam.github.io/musicSpace/`）全部通过；三个提示（WARN）：开头拼贴的标签「留念」只停 0.6 秒（v1 就有）；安全区没有文字超出 0.5 秒以上，只有 12 处在入场/镜头运动时短暂出界（v1 是 14 处）；6 条按你要求删掉的说明行在脚本检查里显示为“未出现”。
- **上线状态**：13:32 UTC 复查，`musicmapteam.github.io/musicSpace/` 根目录已经是片中拍摄的版本 8fa52f0（`build.json`、`index.html` 与 `dist-pages` 逐字节相同），二维码指向的就是它（v1 审片时的“二维码指向旧站”问题已解决）。
- **需要你用耳朵确认**：配乐选哪首、几个重拍点的音效音量、65–72 小节伴奏变薄是否可以接受（见最后两节）。

---

## 1. Deliverables

| File | What |
|---|---|
| `out/music-space-video-v2.mp4` | **the film**: 174.667 s, 225.4 MB, H.264 High 1920×1080 60/1 yuv420p BT.709 (tv range), AAC-LC 48 kHz stereo 256 kb/s, `+faststart`; map `flipping-in-b` |
| `out/qc-v2.json`, `out/music-space-video-v2.qc.txt` | full QC of the encoded file (section 3) |
| `out/music-space-video-v2.mix.wav` (+ `.json`) | the 24-bit mix (music bed + synthesized SFX + bed automation), −16.0 LUFS, TP −1.5 dBTP |
| `out/music-space-video-v2.info.json` / `.geom.json` / `.glyphs.json` | event log, text geometry, glyph report (what the QC read) |
| `out/contact/music-space-video-v2.bars-p1..p3.png`, `out/contact/music-space-video-v2.overview-16.png` | contact sheets decoded from the mp4 (one frame per bar; 16 key moments) |
| `out/cover-3840x2160.png`, `out/cover-1920x1080.png/.jpg`, `out/cover-1280x720.png/.jpg` | cover (v2: no disclosure line; scene `out/cover/cover.js`); v1 copies in `out/work/v2/cover-v1/` |
| `script/SCRIPT.md` | the narration script, updated for v2 (rows marked **changed / removed 2026-10-07**) |
| `capture/H1-host/` | the new host-side take TAKE-H (`take-h.mjs`, `clips/H-01..03.mp4`, `stills/CUT-H*.png`, `take.json`) |
| `out/film-v2.sh` | one command for the whole cut (render → mix → encode → QC → band check → contact sheets) |
| v1 for reference | `out/music-space-video-v1.mp4`, `out/qc-v1.json`; v1 scenes in `out/work/v2/v1-backup/`, pre-owner-change v2 scenes in `out/work/v2/pre-owner-0b/` |

## 2. What changed v1 → v2

### 2.1 The owner's positioning: the community is the Livehouse's (2026-10-07)

- **A5 S7, bars 65–67** (T104–T106, same timing and recipes): 「Livehouse 的 / 【长期社群】，」 · 「也给你 / 留一个【位置】。」 (stays to 67:1 for its 8 units and moves to the top slot when T104 leaves) · 「再见， / 在【下一场】。」. Footage is new: **H-02** — the community is named after the venue, 「月台 Livehouse」 typed into 「我的音乐社群」 on the beat, ticked, created, opened: the community room's 3D header carries the venue sign (replaces P-17 「周五散场以后」).
- **A6 bars 73–76** (replaces W1 「每一场演出，都可以多一层。」 and W2 「设想 · QQ音乐、酷狗 · 听完现场，顺手换一面。」), all real host-side footage from the filmed build (**TAKE-H**, `capture/H1-host/take-h.mjs`, same frame-stepped rig as TAKE-P1, taps/typing on the 123 BPM grid):
  - 73:1 「Livehouse 开个房，」 — H-01 「主办方 / 开一个现场 · 今晚叫什么名字？」, the **场地** field gets 「月台 Livehouse」 on 32nds (场次名称 「周五 · 月台夜」 already in); the drum break's hits carry the slap, the typing and a wavy underline.
  - 73:3 「乐迷留在【本地社群】。」 — the venue community's 3D header (H-02) as a landscape die-cut window (its 「1 位社群成员 · 不是在线人数」 chip cropped out), a loop round the sign 「月台 Livehouse」, a punch on it, hearts and notes on the break's hits.
  - 75:1 (the full band's return, impact) 「下一场的【预告】，」 — H-03 SPACE 「发布新的活动预告」 filled (周六 · 月台夜 / 月台 Livehouse / 2026-10-17 20:00 / 下周六，还在月台见！); 75:2 the tick 「确认向本社群成员发布活动资料」; 75:3 「发布活动预告」 + 「直接发给社群。」 → the card 「活动预告 · 尚未开现场」.
  - 75:4 「场地有了 / 【自己的乐迷】，」, 76:1 the event card lifts out of the phone onto the paper, 76:2 「更愿意【推广】。」 (yellow marker ring on 推广), 76:3 three of the product's avatars peek up under the card.
  - Honesty: only what the build does (host opens a room with a 场地; the host's long-term community; the next show published to its members; members still decide to join — 「每人仍需同意入场」, 「不订阅营销，不扩大照片权限」). No push marketing, ads, automatic entry or old photos are claimed; 「更愿意推广」 is the owner's business reason, not a product feature. The 「设想」 platform vision was dropped (it no longer fits without clutter, and the owner's venue story replaces it): **no platform name appears in v2**.
  - Glyphs: 「开个房」 uses the product's patched Display slice for 个 (checked in the render: 0 system-font fallbacks); new Display characters were checked against look-alikes (本, 告, 自, 直…).

### 2.2 The owner's 「去掉那些说明性文字，这个产品必须是完整的」

Removed from the picture (scenes keep a comment where each was):
- every 「照片为 AI 生成的示例图」 tag: hook (film.js), H2 title card, pain section (T025), E4 room, A3 (29–40), A4 (41–54, and the +bar wall for maps that insert one), A5 S3/S4 and S9–S11, W5;
- 「示例角色 · 自动回复」 stamp T049 (27:3) and chip T094 (57:3); 「示例照片 · 拍摄时间为虚构」 chip T053 (30:3); 「原创虚构专辑」 chip T100 (61:3);
- W5: the circle on and the magnifier strip of the product footer 「示例站 · 数据只存在这个浏览器 · 关于这个示例」 (the room is now framed on its stage, header/footer out of frame; 82:1 a pink loop round the five on stage, 82:2 a heart);
- the end-card block T145 (「示例角色与照片为虚构（照片由 AI 生成）· 角色自动回复 · 数据只存在这个浏览器」);
- captions we wrote with 「示例」: 「回声现场 · 示例场」 → 「回声现场」 (hook polaroid), 「阿遥·示例 · 舞台」 → 「阿遥 · 舞台」 (A4 polaroid); cover: caption and disclosure line.

Kept: **one small credits line** on the end card (T146, 36 px, on a paper strip across the bottom, types in from 86:1): 「演示角色与照片为虚构，照片由 AI 生成 · 配乐：Wax Lyricist《Flipping In》（CC0）」 — the music part follows the chosen map (`DM.credit()`, licence shortened to 「（CC0）」; the original score keeps 「配乐：团队原创（代码合成，无采样、无第三方录音）」). 「浏览器直接打开 · 无需安装」 under the QR is kept (a call to action, not a disclaimer).

### 2.3 Review notes (art / rhythm / read / truth)

All notes whose text reached this pass are handled; the hand-off text was cut off after art #6, rhythm #7 and read #9 (the truth review arrived whole), so the later art / rhythm / read notes could not be checked.

| Note | v2 |
|---|---|
| art #1 highlighter bands paint over the words | fixed in the library (`dm/strokes.js` `DM.highlight`: blend on the stroke's own svg) and in `act-A2-A3.js` `hlOn`, A4's swipe |
| art #2 / read #1 / truth #2 「没把握的时候，」 above 「照片不上传。」 | fixed: 「AI 在本机判断，」 types on 32nds and steps up; 「照片不上传。」 lands under it; the two leave together on 34:1; 「没把握的时候，」 types in **under** them and moves up on 34:1; padlock next to 「AI 在本机判断」 |
| art #3 pain section too empty | fixed: photos ~600 px landing on 9:1/9:2, TA's stage photo 1060 px, stranger's phone 650 px centre-right, cast ~420 px |
| art #4 payoff has no picture of its own; starburst ×10 | fixed: burst only on 5:1 / 21:1 / 51:1 (rings, sparkles elsewhere); 51:1 the product's own mint 「交换已接受」 sticker lifts out of the phone at ~3× with the two M1 polaroids flying in; music `flipping-in-b` |
| art #5 no accent on 5:1 and 79:1 | fixed: bed stops under the title wipe (4:4.5→5:1) + impact at 0 dB; bed ducks −20 dB 79:1→79:2.5 with a warm boom, swells back on 79:3 (mix 5:1 +10.8 dB, rank 5/88; 79:3 +17.5 dB) |
| art #6 you / TA swap roles and photos | fixed: one pair everywhere (yours `sample-crowd`, TA's `yao-stage`), T021/T022 swapped, 「你！」 circles your raised hand in TA's stage photo |
| rhythm #1/#2 music sags after the payoff; weak drop | fixed: map `flipping-in-b` — 51:1 is the #1 downbeat (+20.6 dB), 21:1 #2 (+15.9 dB) in the final mix |
| rhythm #3 / read #3 handovers smear the beat | fixed: outgoing lines cut on the handover beat (T031, T041, T050, T051, T060, T065, T091, T109) |
| rhythm #4 camera pull-backs between beats | fixed: keys on the "and" (1:2.5, 1:4.5) |
| rhythm #5 the AI chime lands late | fixed: chime pre-rolled 0.18 s, the bell on 31:3 |
| rhythm #6 type-ons run past the downbeat | fixed: T056, T080, T102, T108 on 32nds |
| rhythm #7 still end card at full level | fixed: the cast hops on every beat from 86:1, logo bounces, sparkles on backbeats; band's last hits carry accents |
| read #2 「舞台」 covers 「散场了。」 | fixed: T020 top-left, cut on 9:3 |
| read #4 A4 reading order | fixed: teleprompter column (new line enters below, the line above jumps up on the downbeat); 「随时可以撤销。」 slams straight to its place |
| read #5 disclosures too small | moot: the disclosures are gone (owner); the credits line is 36 px |
| read #6 hook stamps weak | fixed: opaque labels, darker ink, 70 px, on the cards' edges (v2 QC: all inside the title-safe area) |
| read #7 「不到 1 分钟」 0.5 s | fixed: times printed to the second (21:48:10 / 21:47:20), bracket + label from 42:1 (1.7 s) |
| read #8 thin pink notes | fixed: 96 px, stamp pink + ink edge; 「上墙啦！」 pops |
| read #9 milder order problems | fixed (19:1 「要是……」 enters under T031; 31:1, 39:1 restaged); film.js checks reading order (PASS) |
| truth #1 QR / link → old site | **resolved upstream**: at 2026-10-07 13:32 UTC the root `musicmapteam.github.io/musicSpace/` serves 8fa52f0 byte-identical to `dist-pages` (`build.json`, `index.html`); the QR decodes to that root |
| truth #3 「不会被打扰」 promises too much | fixed: 「【不接收新招呼】。」 (the product's words) |
| truth #4 21:48 / 21:47 look like a minute | fixed with read #7 |
| truth #5 AI label typing | moot (label removed by the owner) |
| truth #6 privacy wording | fixed: W3 「AI 在本机判断，照片不上传」 and 「双方同意，才交换」; the end-card privacy line is gone with T145 |

QC-driven fixes in this pass: hook stamps / 「每部手机里，」 / 「找不回来。」 / 「上墙啦！」 / 「规则判断，不是 AI。」 / the credits strip moved inside the title-safe area; 「你！」 now pops on 13:2.5 (readable 1 s before the photo flies into the stranger's phone); three pops moved onto the 16th grid.

## 3. QC (`out/qc-v2.json`)

Overall **WARN, no FAIL** (v1: WARN). From the encoded file `out/music-space-video-v2.mp4`:

| Check | Result |
|---|---|
| container | PASS — h264 High 1920×1080 60/1 yuv420p, BT.709 tv range; AAC-LC 48 kHz 2 ch 257 kb/s |
| duration / size | PASS — 174.667 s (limit 175 s) · 225.4 MB (limit 500 MB) |
| loudness / true peak | PASS — I −16.0 LUFS, LRA 4.6 LU · −1.3 dBTP |
| silence / frozen / black / motion | PASS — none; longest low-motion stretch 0.08 s |
| event gaps / beat alignment | PASS — 614 visual events (3.52/s), longest gap 1.71 s; **614/614 on the 16th grid**, 584 on 8ths |
| reading time | WARN — 118 lines, every title and note long enough; one label short: 「留念」 0.60 s (hook, as in v1) |
| title-safe area | WARN — 0 texts outside for > 0.5 s; 12 only briefly (slam entrances, camera moves; v1: 14) |
| glyphs | PASS — 405 font/character pairs, 0 system-font fallbacks |
| QR | PASS — decoded at 8/8 sampled frames: `https://musicmapteam.github.io/musicSpace/` (first at 165.86 s) |
| placeholders / scene warnings | PASS — none |
| SFX level | PASS — SFX −9.0 LU under the music, 647 synthesized sounds (no samples) |
| script lines | WARN — 111/117: the six lines the owner removed (T025, T049, T053, T094, T100, T145) |
| film checks (scenes/film.js) | grid, doubled lines, **reading order** (no line enters above an older one) — all OK |

Other measurements: downbeat hits in the final mix (peak of 50 ms RMS 0–250 ms after the beat minus the mean 50–600 ms before): 51:1 payoff +20.6 dB (#1 of 88), 21:1 drop +15.9 dB (#2), 9:1 +13.5 dB, 5:1 title +10.8 dB (#5; v1 −0.4 dB), 75:1 venue lift +9.5 dB, 79:3 「人不散。」 +17.5 dB after the duck under 「曲终，」. Band check: no flat band at the bottom (350 frames). All six other music maps load the v2 scenes with 0 warnings and pass the film's own checks (grid, doubled lines, reading order).

## 4. Release gate (do before submitting)

1. The link and the QR: `https://musicmapteam.github.io/musicSpace/` — verified 2026-10-07 13:32 UTC to serve the filmed build 8fa52f0. If the product copy revision is published before the deadline, the live site will no longer match the film's footage word for word (re-capture, section 5) — the QR itself stays valid.
2. Scan the QR from the final mp4 on a phone (WeChat and the system browser) and use the same URL as the form's Demo link (field 05).
3. Watch once with sound (nobody could listen here): section 7.

## 5. Shots whose footage shows explanatory product text (re-capture after the copy revision)

The overlays are gone, but the product's own explanatory copy is still in the real UI that was filmed (build 8fa52f0). Re-capture these with the same takes once the product copy is revised (TAKE-P1 `capture/P1/take-p1.mjs`, P2P3 `capture/P2P3/tools`, desktop `capture/desktop/tools`, TAKE-H `capture/H1-host/take-h.mjs`; the scenes address footage by source pixels, so re-check the measured boxes listed in each act's comments if layouts move). Where cheap, v2 already crops the worst out (W5 framed on the stage; S7 form close-up; A6 community window crop; A6 event form framed below its 「还没有活动预告…」 line).

| Bars (film time) | Shot / capture | Explanatory text in frame |
|---|---|---|
| 1–4 (0:00–0:07.8), 72 (2:19) | hook collage / S11 recap: stills CUT-01 (3D room), CUT-03, CUT-04c, CUT-06, CUT-07, CUT-08 | room header 「回声现场 · 示例场」 / 「月台 Livehouse（虚构场地）」, side panel copy, cast tags 「·示例」; CUT-04c hint paragraph 「配对时，用它来找互补的那一面。AI 在本机判断，照片不上传…」; chat bubble 「我是示例角色…」 |
| 8 (0:13.7) | H3 match cut: D-01 desktop landing | landing copy, footer 「示例站 · …」 |
| 21–26 (0:39–0:51) | E1–E3: P-01, P-02, P-03 | 「进入示例现场」, wardrobe 「试穿中 · 仅自己可见」 / 「会替换当前穿搭…」, entry consent and participation descriptions |
| 27–28 (0:51–0:55) | E4: D-02 desktop room | cast name tags 「阿遥·示例 · 可招呼」 etc. |
| 29–35 (0:55–1:09) | A1–A4: P-05, P-06, P-07 | route card 「示例路线 1/4」, buttons 「人海 · 示例照片」 / 「舞台 · 示例照片」, form note 「示例照片 · 虚构的拍摄时间 21:48，写在文件里」 (inside the 30:1 punch), hint paragraph, footer 「示例站 · 数据只存在这个浏览器 · 关于这个示例」 |
| 36 (1:09) | A4 wall: D-03a / D-03b | desktop wall view (header/labels) |
| 37–40 (1:11–1:18) | A5 rule: P-08 (+ WALL-01, CUT-05, POL-03..05 die-cuts) | explainer box 「AI 建议视角 → 规则找同一刻 → 双方同意才交换」, names 「小满·示例」 / 「北屿·示例」 on the wall cards |
| 43–54 (1:22–1:46) | M2–M7: P-09, P-10, P-11 (+ CUT-06s) | compose paragraph 「发送后，阿遥·示例 可以看并保存我的小图预览…」, 「规则判断，不是 AI。要不要交换，仍由你和对方决定。」, names 「阿遥·示例」, revoke fine print |
| 55–58 (1:46–1:54) | S1–S2: P-12, P-13 (+ CUT-07 bubbles) | 「先招个手，对方愿意回应后，你们才会成为朋友。」, 「已互相接受联系。这里只保存文字，不展示在线状态。」, bubble 「嗨，欢迎来到「回声现场」。我是示例角色，由这个页面自动回复。」, 「已保存 = 示例已收到，不代表对方已读」 |
| 59 (1:54) | S3: D-04 desktop | 「林间·示例」 card |
| 60 (1:56) | S4: P-14 | 「（示例角色的自动回复：我不是真人。）」 |
| 61–62 (1:58–2:02) | S5: P-15 | cup cards 「原创虚构专辑」, 「由发起者明确结束这一轮；离开或被移除时暂停晋级。」 |
| 63–64 (2:02–2:06) | S6: P-16 | 「揭晓前只显示你自己的选择。」 and form notes |
| 65–66 (2:06–2:10) | S7: H-02 | 「1 位社群成员 · 不是在线人数」 (66:1–67:1) |
| 67 (2:10) | S8: P-18 | 「等待朋友本人明确参与。你不能替对方同意，也不会自动分享照片。」 (partly used on purpose as the quote 「你不能替对方同意，」) |
| 68–70 (2:12–2:18) | S9: P-19 (+ CUT-08) | 「聊天室需明确加入；不改变照片权限或自动添加好友。」, 「不包含私聊、朋友名单或他人的照片，不自动公开。」 |
| 71 (2:17) | S10: P-20 | My Space copy |
| 73–76 (2:20–2:28) | V: H-01, H-03 | create sheet's participation descriptions (bottom edge); event card's 「关联我已创建的现场 · 确认向本社群提供邀请码；每人仍需同意入场」 below the lifted card |
| 77–78 (2:28–2:32) | W3 die-cuts: CUT-04c, CUT-11, CUT-12 | hint paragraph; consent 「我同意提供选中照片的预览，并在对方接受后分享这张原图」; 「原创虚构专辑」 |
| 81–82 (2:36–2:40) | W5: D-02 stage | cast name tags 「·示例」 |
| cover | room polaroid (CUT-01 crop), phone (CUT-05-wall-top-full) | name tags 「·示例」, footer 「示例站…」 (tiny) |

## 6. Switching the music

The scenes are written in storyboard bars; a tempo map turns them into the track's bars and seconds (`tools/tempo-maps/*.json`). One command renders, mixes, encodes and QCs a whole cut (≈ 10–20 min render + ≈ 8 min encode/QC; run it in the background and read `out/logs/<name>.log`):

```sh
cd /tmp/space-video-doodle/prod
out/film-v2.sh                                                     # default: flipping-in-b -> out/music-space-video-v2.mp4, out/qc-v2.json
out/film-v2.sh flipping-in      music-space-video-v2-flipping-in   # Flipping In, the animatic proposal map (payoff on FI 103)   174.66 s
out/film-v2.sh consternation    music-space-video-v2-consternation # Wax Lyricist《Consternation At The Disco》130 BPM (inserts 3 bars) 173.49 s
out/film-v2.sh grab-a-partner   music-space-video-v2-grab          # Loyalty Freak Music《Grab A Partner》130 BPM (inserts 3 bars)  174.09 s
out/film-v2.sh tea-party        music-space-video-v2-tea-party     # Zane Little《Post-Adventure Tea Party》110 BPM (cuts 11 bars)   174.94 s
out/film-v2.sh love-love-love   music-space-video-v2-love          # HoliznaCC0《Love Love Love》115 BPM (cuts 6 bars)               174.72 s
out/film-v2.sh original-124     music-space-video-v2-original      # the team's original score 124 BPM (plays its own stops)       174.89 s
# env: WORKERS=8 (parallel pages), RESUME=1 (reuse kept chunks of the same map), TARGET=150-300 (MB)
```

A non-default name writes its QC to `out/<name>.qc.json`. Each map credits its own track on the end card automatically. Elastic cuts/inserts follow STORYBOARD §5 (bars a map cuts drop out; inserted bars stretch the shot before them). The bed automation (stops at 4:4.5→5:1 and 40:4.5→41:1, the duck under 「曲终，」) follows every CC0 map and is skipped for the original score, which plays its own stops. To finish a picked map as the final: rename its mp4/qc to the deliverable names or run it with the default name `music-space-video-v2`.

Known music point (rhythm review follow-up): under `flipping-in-b`, bars 65–72 (S7–S11: community, corner, memory card, My Space, recap) play Flipping In bars 79–86 — about 1 dB quieter than 59–64 and thinner (300–3000 Hz 7–16 dB lower; bars 69–72 lose the horns/keys). If that sags by ear, the map's plan entry `{"sb": "65-72", "trk": "79-86"}` can become `"trk": "107-114"` in `tools/tempo-maps/flipping-in-b.json` (outside this pass's write permission; bars 107–114 are already used under 77–82, so the lift would then repeat).

## 7. Check by ear (nobody could listen on this machine; everything above is measured)

1. **Music choice** — `flipping-in-b` (default) vs the five other CC0 options and the original score (section 6).
2. **SFX levels** (bus −9 LU under the music): the title impact on 5:1 (bed stopped under the wipe), the drop's boom on 21:1, the collision on 41:1 (bed stop + boom + slap), the payoff stack on 51:1 (boom +2 dB, impact, crackle a 16th later), the venue story's impact on 75:1, the boom and −20 dB duck under 「曲终，」 (79:1), the 210 typing ticks (A3, A4, A5, the venue form), the heartbeat in 49–50, the chime pre-roll on 31:3.
3. **Bars 65–72** under `flipping-in-b` (see section 6).
4. **The ending**: the band's last hit on 89:1(.5) ringing into the 1 s tail (no fade).

## 8. Remaining issues

- QC WARN (pre-existing): the hook's last label 「留念」 (T008) is readable 0.60 s (labels are reported, not failed; it rides the 8th before the wipe).
- QC WARN (expected): `script_lines` lists the six lines the owner removed (T025, T049, T053, T094, T100, T145); `script/out/timeline.json` and `src/edit_data.py` still hold draft 1 (not this pass's to edit) — the scenes override the changed text and `SCRIPT.md` is the v2 source of truth.
- The product's own explanatory copy is still in the footage (section 5): re-capture after the copy revision.
- The review notes after art #6 / rhythm #7 / read #9 were cut off in the hand-off and could not be checked.
- The cast and the sample photos are fictional and the photos AI-generated; since v2 this is said once, in the end card's credits line (the brief's per-frame 「照片为 AI 生成的示例图」 rule was superseded by the owner's 2026-10-07 instruction).
