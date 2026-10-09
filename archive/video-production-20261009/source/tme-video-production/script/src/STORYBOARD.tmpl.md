# Music Space · Doodle video · storyboard (beat-based, tempo-agnostic)

Draft 1 · 2026-10-07. Companion of `SCRIPT.md` (the words) and `SHOTS.md` (the capture list). The edit is written in **bars and beats**; seconds are given for the reference tempo **124 BPM** (bar = 1.9355 s, beat = 0.4839 s, 8th = 0.2419 s; at 60 fps a beat is 29.03 frames, a bar 116.1 frames). Source of truth: `src/edit_data.py` → `out/timeline.json`.

What the owner asked for, and how this answers it:

| Brief | Here |
|---|---|
| about three minutes | 90 bars = **2:54.2** at 124 BPM (+1 optional tail bar = 2:56.1); elastic to other tempos (§5) |
| 文字解说融进视频画面里 | all narration is kinetic type inside the composition (titles beside the phone, stickers on the photos, stamps on the UI); no lower-third subtitle band |
| 足够有节奏感 | every shot, cut, line, sticker and UI tap sits on a beat; titles on 1 and 3, pops on 2 and 4 or on 8ths; transitions start on the "and" of 4; max {{max_gap}} between visual events (checked) |
| 视觉表现要丰富有冲击力 / 很强烈的艺术风格 | one consistent Doodle kit taken from the product's own tokens: paper + dots, ink, hard offset shadows, pink/mint/yellow markers, stickers, tape, polaroids, layered lettering with huge size contrast; style frames rendered in `frames/out/` |
| 主要是展示产品的美 / 不要那么抽象 | {{n_real}} of {{n_shots}} shots ({{real_share}} of the running time) are real footage or real cut-outs of the restyled build (3D doodle livehouse, wardrobe, upload with the AI chip, photo wall, badge, exchange, 交换已接受, chat, World Cup, game, community, corner, memory card PNG); the other {{n_gfx}} are type cards built from the product's own photos, avatars, doodle shapes and typefaces |
| previous rehearsal had six frozen holds > 3 s | longest stretch without a visual event: {{max_gap}}; every shot also has a continuous push/drift and 4 fps line boil |

## 0. At a glance

{{acts_table}}

Shot list (39 shots; details in §4):

{{storyboard_overview}}

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
{{storyboard_shots}}

## 5. Elastic retime (other tempos, other lengths)

Bars that can go, in this order (`out/timeline.json` → `elastic.cut`): ✂1 bar 90 (end card −1) · ✂2 bar 72 (S11 drum-roll recap) · ✂3 bars 15–16 (P2 「散场后，找不回来。」) · ✂4 bar 71 (S10 我的空间) · ✂5 bar 89 (end card −1 more; QR still on ≥ 11 s) · ✂6 bar 8 (H3 match cut) · ✂7 bar 40 (badge tease 「看这里！」) · ✂8 bar 81 (W5 text bar) · ✂9 bar 36 (3D wall insert) · ✂10 bar 66 (community second bar). Bars that can be added: +1 one more end-card bar · +2 after bar 28: real camera glide 全景→照片墙 on the desktop 3D room · +3 after bar 54: the 3D wall with both photos and a pink ⇄ doodle · +4 after bar 60: 2 bars of 成员音乐话题 (title 「聊聊今晚的歌。」, the song card 「晚班列车 / 纸灯乐队」, both fictional).

When ✂6 is used (no H3), end H2 with an X1 scribble wipe on `7:4.5` instead of the shrink toward the landing card; when ✂7 is used, A5 ends with a hard cut on the new bar line. `retime.py` applies them: an event that starts in a removed bar is dropped; one that ends in it is shortened to the next kept bar; inserted bars come out as placeholder shots `ADD-k`. Tempo table (bars that make 2:50–2:58, the choice closest to 2:54, and what to cut or add):

{{tempo_table}}

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
