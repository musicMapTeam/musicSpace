# Capture → cards → music → assembly → QC pipeline (how the video is made, and how to re-make it on the final build)

All paths are under `/tmp/space-video-prep/`. Nothing here touches the repo. Machine: MacBook, Apple M4, 16 GB, macOS 26.6, system **Google Chrome 154** (real GPU through ANGLE/Metal), **Playwright-core 1.63** (`tools/`), **ffmpeg 9.0.2** (Homebrew; has libx264/x265, videotoolbox, xfade, zoompan, ebur128, alphamerge; **no** libass/freetype → no `subtitles`, `ass`, `drawtext`), Node 24.19, Python venv `tools/venv` (numpy, scipy) for the score.

## 1. Capture method: frame-stepped recording on a virtual clock

**Chosen:** `capture/rec.mjs`. The page runs on Playwright's fake clock (`Date`, `performance.now`, timers, rAF) and CSS/Web-Animations are advanced one step at a time through `document.getAnimations()`. Every step advances virtual time by exactly 16 ms (one rAF), the GPU renders, and one screenshot (JPEG q96, 3840×1984) is piped into ffmpeg (Lanczos down-scale to 1920×992, x264 CRF 12 mezzanine, labelled 60 fps). One unique frame per step, perfectly even cadence, independent of how busy the machine is.

Measured on the same camera-glide scenario (RC4 event room, 3 glides, real GPU, 1080p; `capture/measure-methods.py`, raw output in `notes/measure-methods.txt`):

| Method | Output | Unique fps during motion | Longest gap in motion | Verdict |
|---|---|---|---|---|
| Playwright `recordVideo` | VP8 webm, fixed 25 fps | 17.8 | 280 ms | stutters, low quality, 25 fps container |
| Playwright `page.screencast` to file | VP8 webm 25 fps | 18.7 | 160 ms | same |
| Playwright `page.screencast` `onFrame` / CDP `Page.startScreencast` (JPEG q92) | variable frame rate, compositor-driven | 59.6 / 60.5 | 85 / 56 ms | smooth on a quiet machine **but** limited to ≤ 1080p DPR 1, load-sensitive, VFR (needs CFR conversion), no determinism for two-device lockstep |
| `page.screenshot` loop (JPEG q92) | variable, wall clock | 33.0 | 37 ms | about 30 fps, irregular |
| CDP `captureScreenshot` loop (JPEG q95) | variable | 30.9 | 46 ms | about 30 fps |
| `page.screenshot` PNG loop | variable | 12.9 | 107 ms | too slow |
| **Frame-stepped (chosen)** | **CFR 60 fps, 1920×992 (3840×1984 source)** | **60.0: every frame inside a glide is unique, 0 duplicates** (`clips/test-rc4-eventroom-10s.mp4`: motion runs of 26/61/21/20/63 frames, 0 duplicates; one 6-frame idle stretch is the scene holding still) | none | smooth by construction |

Why stepped beats real-time here: (1) deterministic 60 fps and no stalls whatever the load; (2) 2.667× supersampled UI (text/SVG crisp after the 2× down-scale); (3) two-device split-screens run in **lockstep** (`Duo`), so both phones are frame-aligned; (4) async waits (network, NPC think time) cost no dead air: `until()` steps frames while polling; (5) frame-exact cursor/ripple choreography. Cost: **≈ 6–7 s of wall time per second of footage** (about 100 ms per 4K screenshot; S00 12.5 s → 74 s, S08 10 s → 69 s, S13 8.2 s → 49 s, cards 5 s → 28–35 s). Output is labelled 60 fps while STEP_MS is 16 ms, so playback runs 4 % slower than virtual time; all slot maths use frames/60.

Not used: macOS `screencapture -V` / ScreenCaptureKit (needs a Screen Recording permission prompt; never triggered); Tabbit `page.screencast` named in the design (T12a) was not tested here, it is the same compositor-driven family as the screencast rows above.

**10-second test clip of the current event room** (task item 3): RC4 = `git archive 2edc18d` built with `npm ci && npm run build:all` in `repo-rc4/` (the build agents' tree stays untouched), `node server/index.js` on a free port with a fresh `DATA_DIR`; clip `clips/test-rc4-eventroom-10s.mp4`: 1920×992, 60 fps, 600 frames, 2.8 MB, H.264. All servers started by the kit are killed by `shots/run.mjs` / `world.mjs` on exit (a stray one from the first session, port 8931, was found and killed on 2026-10-05).

## 2. The recorder API (what shot scripts use)

`capture/rec.mjs` exports `launch()`, `Session`, `Duo`, `OUT_FPS`:

| Call | Meaning |
|---|---|
| `Session.open(browser, {url,width,height,dpr,cursor,css})` | new context, fake clock installed, cosmetic cursor + click ripple (recording annotation only) |
| `freeze()` / `unfreeze()` | stop / resume the virtual clock (set up in real time, record frozen) |
| `startRecording(file,{w,h})` / `stopRecording()` | open / close the ffmpeg sink; `stopRecording` also writes `<clip>.events.json` (click times) |
| `frames(n)`, `hold(s)` | step + capture n frames / s seconds |
| `click(locator,{move,pre,post})`, `moveTo`, `type`, `tap`, `until(pred,{max})`, `ready` | frame-accurate pointer/keyboard choreography; `until` steps frames while polling in real time |
| `directorOn({k,auto})`, `focus`, `focusOn(locator,{pad,zmax})`, **`track(selector,{pad,zmax})`**, `unfocus`, `cut` | **camera director**: Screen-Studio-style smooth zoom/pan. Implemented with CDP `Page.captureScreenshot` `clip.scale`, so Chrome re-rasterises the region (crisp text at 1.5–1.9×) and layout is untouched; `track` keeps a panel framed while it grows/shrinks. 3D canvas content is bitmap at CSS-px size (the engine uses pixelRatio 1), so zoom softens the 3D scene, not the UI |
| `addCss(css)` / `removeCss()`, `capture/cinematic.css` | recording-only stylesheet, e.g. full-bleed 16:9 3D canvas for establishing shots |
| `push(selector, from, to, seconds,{origin})` | frame-exact sub-pixel digital push-in on an element (Web Animations) |
| `hideCursor()` / `showCursor()` | cursor off for cinematic shots |
| `Duo(a,b)` | lockstep split-screen: every `frames()` advances both sessions |

Recipe for a shot: open → real-time setup (enter room, upload, warm the AI model) → `hideCursor(); freeze(); directorOn()` → `startRecording()` → choreography → `stopRecording()`. Never use Playwright auto-wait while frozen (its timers are frozen too); use `until()` / `ready()`.

## 3. Commands

```sh
# RC4 reference shots (rehearsal footage; needs repo-rc4 built; SPACE_WORKAROUNDS=1 injects the radio-button CSS workaround, rehearsal only)
cd /tmp/space-video-prep/capture
SPACE_WORKAROUNDS=1 node shots/run.mjs s00 s01 s02 s03 s04 s05 s07 s08 s09 s10 s11 s12 s13 s14   # -> clips/final/*.mp4

# Route B (static Pages build) shots: drafts written from the design, NOT run against a build (none existed on 2026-10-05)
SPACE_BASE=http://127.0.0.1:8800/musicSpace/ node routeb/probe.mjs --enter      # what is on screen? fix strings in routeb/ui.mjs
SPACE_BASE=... node routeb/run.mjs rb-h0 rb-e1 rb-e2 rb-e3 rb-a1 rb-a2 rb-a3 rb-m2 rb-s1 rb-s2 rb-s3 rb-k1 rb-k2   # -> clips/routeb/RB-*.mp4

# cards (each ~30–50 s) and the hook overlay
cd /tmp/space-video-prep/cards && ./render-all.sh
ALPHA_CODEC=qtrle node render-overlay.mjs card-h-lockup.html out/h-lockup.mov 3.0 2 && node shade.mjs

# score (8 s) + loudness (see MUSIC.md)
cd /tmp/space-video-prep/music && SCORE_CONFIG=score-config.json SCORE_OUT=$PWD/original-v2 ../tools/venv/bin/python gen_original_v2.py

# timeline -> animatic (≈1 min) -> final (≈10–20 min) -> QC
cd /tmp/space-video-prep/assembly
python3 make-timeline-v2.py            # (--no-m3 for the 155 s cut)
node assemble.mjs timeline.v2.json --animatic --scale 0.5 --fps 30 --out out/animatic-v2.mp4
node assemble.mjs timeline.v2.json     # 1080p60, H.264 CRF 18 + AAC 192k
node qc.mjs out/space-v2-rehearsal.mp4 --contact
```

`assemble.mjs` flags: `--animatic` (missing clips fall back to a still or an auto slate, status tag on every shot), `--scale`, `--fps`, `--out`, `--only A,B`, `--music file.wav` (swap the soundtrack, e.g. a CC0 candidate), `--dry` (write filtergraph + ffmpeg command only).
Timeline fields per shot: `src, dur, speed, in, hold, layout (band|full), grade (cinema), transition_in {type,dur}, fallback, title, note, status`; top level `music`, `overlays` (alpha `.mov` or `.png` stills with fades), `subtitles` (`band`, `bandnote`, `note`, `glass`), `sfx`.

## 4. Gotchas learned (read before the final shoot)

1. **Do not load the machine while capturing.** A request that must complete in real time while the page clock is frozen can fail under load: S09 recorded a red 「连接暂时没有回应」 when ffmpeg/score jobs ran in parallel and was clean when re-run alone. Re-take idle.
2. **Fresh server / fresh storage per shot** (`world.mjs` starts a new `DATA_DIR`; Route B uses a new browser context) so rate limits and identities never leak between takes.
3. **Waits are free**: the NPC "thinks" 2.5 s of *virtual* time; `until()` steps frames meanwhile. Cut real waiting, label cuts (T12b rule).
4. **Model first-load**: warm it in real time before `freeze()` (`warmModel` in `routeb/rb.mjs`); never record the 10 MB download unless it is the intended honest beat.
5. **Hidden-tab throttling**: autopilot and polls run only while the tab is visible; headless Chrome counts as visible, so no `bringToFront` is needed here.
6. **Native control language**: `--lang=zh-CN` and `locale: zh-CN` do not localise Chrome's file chooser on this macOS (and `-AppleLanguages` through a wrapper crashes the launch). Avoid showing the native file input.
7. **No libass/drawtext**: captions are Chrome-rendered PNG overlays (`render-subs.mjs`), lower-third band style by design.
8. **Colour**: frames are tagged BT.709 limited; YUV ops (`eq`, `vignette`) must come after RGB ops (`curves`, `lutrgb`); `eq` on planar RGB tints.
9. **Disk**: 4K JPEG stepping writes nothing to disk (piped); mezzanine clips are 2–12 MB each; the whole `clips/final` is ≈ 60 MB.
10. **Canvas sharpness**: the 3D engine renders at CSS-px size with an internal 2.5 MP cap; DPR does not sharpen it. For establishing shots use CSS 1920×1080 at DPR 1.

## 5. Final shoot on the Route B build (checklist)

1. Serve the **frozen** build exactly as judges get it (Pages link or `scripts/pages/serve-prefix.mjs` under `/musicSpace/`), root not `/preview/`; no CPU-heavy jobs running.
2. `probe.mjs --enter` → adjust `routeb/ui.mjs` strings; confirm the radio-button CSS fix is in the build (no workaround CSS in final footage).
3. Record `rb-*` shots (each independently re-takeable), look at every clip (`ffmpeg -ss … -frames:v 1`), fix scripts, re-take.
4. Copy the exported PNG to `cards/assets/memory-card.png`, re-render card K; update the QR only if the link changes (`cards/gen-qr.mjs <url>`).
5. Edit `make-timeline-v2.py` (status → FINAL, `src` names, `speed/in/hold` to fit the bar-grid slots), regenerate; run `hits.mjs` and regenerate the score if you want the chip chime / consent swell exactly on the moments.
6. Animatic → watch → final render → `qc.mjs` → manual QC list (`QC-CHECKLIST.md`) → write specs (duration, bytes, sha256, environment) into `delivery/README.md`.
