# Music Space · 比赛视频 v1 · 署名与授权（Credits & licences）

**中文摘要**：配乐是 Wax Lyricist《Flipping In》，CC0 1.0 公共领域，授权留档在 `music-cc0/02-flipping-in__Wax-Lyricist/LICENCE-PROOF.md`；CC0 不要求署名，片尾仍写了「配乐：Wax Lyricist《Flipping In》（CC0 1.0 公共领域）」。全部音效由代码合成，没有采样或录音。字体六款，五款 OFL 1.1、一款 Apache 2.0。画面是 Music Space 产品自己的录屏和截图（构建 8fa52f0），小人是产品自己的插画角色，同场角色都是虚构的「示例」角色。演唱会照片是 2026-09-26 用 AI 生成的两张虚构图及其裁切，片中出现时都标「照片为 AI 生成的示例图」，片尾也写明。没有第三方图片、没有真人、没有 TME 标志；「QQ音乐、酷狗」只作为「设想」贴纸下的纯文字出现。

Film: `/tmp/space-video-doodle/prod/out/music-space-video-v1.mp4` (H.264 High 1920×1080 60 fps, AAC-LC 48 kHz 256 kb/s, 2:54.67, 228.4 MB, made 2026-10-07 from `scenes/film.js` on the `flipping-in` tempo map).
Cover: `/tmp/space-video-doodle/prod/out/cover-1920x1080.png` / `.jpg`, `cover-1280x720.png` / `.jpg`, `cover-3840x2160.png`.

## 1. Music

| | |
|---|---|
| Track | 《Flipping In》, Wax Lyricist, album *The Wax Lyricist* (2022), instrumental (no vocals or lyrics; checked by stem separation and a tagger, see the proof) |
| Licence | **CC0 1.0 Universal** (public-domain dedication), https://creativecommons.org/publicdomain/zero/1.0/. The track page reads: "Flipping In by Wax Lyricist is licensed under a CC0 1.0 Universal License." |
| Source | Free Music Archive, https://freemusicarchive.org/music/wax-lyricist/the-wax-lyricist/flipping-in/ (file `rQDvsLDqpCtHbJYnNKnlFUvY7MecNUlsWrwPHi1d.mp3`), retrieved 2026-10-06T21:53:02Z |
| File | `music-cc0/02-flipping-in__Wax-Lyricist/Wax_Lyricist_-_Flipping_In.mp3`, 6 663 880 bytes, SHA-256 `8d79e1f0f6aee4de038eff80b0a93262bacdc4ea2dc7ce184cfd12f162ca6127` |
| Proof | `/tmp/space-video-doodle/music-cc0/02-flipping-in__Wax-Lyricist/LICENCE-PROOF.md`, plus the page screenshots (`proof-track-page-fullpage.png`, `proof-licence-line.png`, album and artist pages), the raw and rendered page HTML and the CC0 deed and legal code in the same folder |
| What we did to it | Re-arranged on its own bar lines by the tempo map `prod/tools/tempo-maps/flipping-in.json`: track bars 55–120 in the storyboard's order, with sections reused and storyboard bar 90 cut. Every splice is a 20–60 ms crossfade that ends on a downbeat. The music fades out under the end card from storyboard bar 87, and is mixed with the SFX to −16 LUFS integrated, true peak ≤ −1 dBTP (`prod/tools/music.py`, `mix.py`). Nothing else is mixed in: no other recording and no voice. |
| On-screen credit | CC0 asks for none. As a courtesy, the end card shows 「配乐：Wax Lyricist《Flipping In》（CC0 1.0 公共领域）」 from 87:1 (about 2:47.8). |
| Other options kept switchable (not in v1) | Four more CC0 tracks, each with its own `LICENCE-PROOF.md` under `/tmp/space-video-doodle/music-cc0/`: 01 Loyalty Freak Music《Grab A Partner》, 03 Zane Little《Post-Adventure Tea Party》, 04 Wax Lyricist《Consternation At The Disco》, 05 HoliznaCC0《Love Love Love》. There is also the team's original score (`/tmp/space-video-doodle/music-original/PROVENANCE.txt`: fully synthesized in code, no samples). If the score is used, the end-card credit becomes 「配乐：团队原创（代码合成，无采样、无第三方录音）」 automatically (`DM.credit()` of the map). |

## 2. Sound effects

All 639 sound events in v1 are synthesized by code in `prod/tools/sfx.py` from noise and oscillators. There are no samples, no recordings and no sound libraries. Each sound is placed from the picture's event log (`out/music-space-video-v1.info.json`), and the SFX bus sits 9 LU under the music.

The 30 kinds used:
- slap, stamp, tape, pop, whoosh, impact, type ticks
- zip, marker squeak, highlighter, slam, scribble, swish, pencil, click, boop
- riser, boom, thump, ding, shutter, chime, hmm
- sparkle, tick, heartbeat, blip, crackle, page flip, vinyl scratch

## 3. Fonts

All six are free fonts and appear only as rendered pixels.

| Role in the film | Font | Licence | Licence text |
|---|---|---|---|
| Titles (Display) | 站酷庆科黄油体 ZCOOL QingKe HuangYou: the product's subset "Doodle Display" (入 and 个 redrawn from the font's own strokes, · mapped), then the raw font | SIL OFL 1.1 | `/tmp/music-space-font-cache/display-license.txt`; product subsets: `/tmp/space-publish/dist-pages/fonts/doodle/LICENSES.txt` |
| Plain lines, stickers, chips (Marker) | 霞鹜漫黑 LXGW Marker Gothic | SIL OFL 1.1 | `marker-license.txt` |
| Fine print, captions (Hand) | 悠哉 Yozai | SIL OFL 1.1 | `hand-license.txt` |
| Handwritten notes (Note) | 龙藏体 Long Cang | SIL OFL 1.1 | `note-license.txt` |
| MUSIC SPACE wordmark (Logo) | Luckiest Guy | Apache License 2.0 | `logo-license.txt` |
| Times, numbers, the link (Digits) | 得意黑 Smiley Sans (reserved names "Smiley"/「得意黑」; the product's subset is renamed) | SIL OFL 1.1 | `digits-license.txt` |

QC (glyph pass in Chrome): 439 font/character pairs; none is drawn by a system font.

## 4. Pictures

- **The product.** Screen recordings and stills of Music Space itself are the team's own work. The build is 0.22.0-rc.1, commit 8fa52f0, built 2026-10-06T20:13:48Z, `/tmp/space-publish/dist-pages`, served under `/musicSpace/` like the live site. They were recorded by the capture passes; see `prod/capture/P1/manifest.json`, `P2P3/manifest.json` and `desktop/manifest.json`. There is no cursor: taps are the rig's drawn tap rings.
- **Avatars.** The product's own illustrated avatars (2D doodle figures), exported from the build. They are not real people.
- **The example cast.** 阿遥·示例, 小满·示例, 北屿·示例 and 林间·示例 are fictional characters who reply automatically, as are the visitor 阿宁 and the venue 月台 Livehouse (虚构场地). This is said on screen by:
  - the product's own 「·示例」 labels
  - the stamp 「示例角色 · 自动回复」
  - the chat bubble's own disclosure
  - the end card 「示例角色与照片为虚构（照片由 AI 生成）· 角色自动回复 · 数据只存在你的浏览器」
- **Concert photos.** These are AI-generated and fictional: `web/assets/stage-scene.png` and `crowd-scene.png`, made with OpenAI image_gen on 2026-09-26. Prompts, hashes and the statement "Synthetic fictional concert imagery. Not photographs of any real event, user, artist, or venue." are in `web/assets/image-provenance.json`. The build's crops of them (`dist-pages/demo/*.jpg`, see `demo/manifest.json`) also appear, including as thumbnails inside the product UI.
  - Wherever they are on screen, 「照片为 AI 生成的示例图」 is on screen too. In v1 (measured from the scene log) that is:
    - 0:00.0–0:07.8: the hook collage; this tag is added by `scenes/film.js`
    - 0:08.8–0:13.7
    - 0:15.6–0:39.0
    - 0:50.7–0:54.6
    - 0:55.6–1:43.9
    - 1:53.2–1:57.1
    - 2:10.7–2:20.5
    - 2:36.1–2:40.0
  - From 2:45.9 the end card's disclosure covers them.
  - No AI photo was found between those windows. This was checked on one frame per bar (the contact sheets) and on extra frames for bars 1–4, 55–67 and 73–78, not on every frame.
- **Drawn elements.** The doodles, paper, tape, polaroid frames, stickers, marker strokes and wipes are drawn in code (`prod/dm/objects.js`, `strokes.js`; the product's own `kit.css` shapes as SVG). The paper grain and stamp-ink textures are generated noise (`animatic/tools/prep_assets.py`). Nothing was downloaded.
- **QR code.** Generated from the team's own link (`prod/dm/assets/qr.svg`). QC decodes it to `https://musicmapteam.github.io/musicSpace/` at 8 of 8 sampled frames.
- **Not in the film:**
  - no third-party images, no real people and no celebrity likeness
  - no TME logos and no QQ音乐 or 酷狗 app pictures: 「QQ音乐、酷狗」 appear only as plain type under the 「设想」 sticker (2:24.4–2:28.3)
  - not the Music Map page, which shows real musicians' names
- **Privacy wording.** It is the product's own: 「AI 在本机判断，照片不上传」, 「双方同意，才交换」, 「随时可以撤销」, 「数据只存在这个浏览器」.

## 5. Cover

The cover (`cover-*.png/.jpg`) uses the same kit and the same product pictures:
- a crop of `capture/P2P3/stills/CUT-01_room-overview-4k.png`, the 3D room with the five figures and their 「·示例」 labels, saved as `out/cover/room-crop.png`
- `capture/P1/stills/CUT-05-wall-top-full.png`: the photo-wall panel with the 「同一刻的另一面」 badge, in a hand-drawn phone

Its footnote reads 「照片为 AI 生成的示例图 · 示例角色为虚构 · 界面为产品实际截图」. The scene is `out/cover/cover.js`, rendered by `out/tools/cover-render.mjs` at 2× and downscaled with Lanczos.

## 6. Tools (not content)

Rendering and analysis used these tools; none of them contributes content:
- headless Google Chrome, stepped frame by frame through the team's `doodle-motion` library
- ffmpeg / libx264 / AAC
- Python with numpy, scipy and Pillow
- Playwright
