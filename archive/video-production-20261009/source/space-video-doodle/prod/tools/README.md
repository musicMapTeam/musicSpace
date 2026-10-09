# Production tools (prod/tools)

Python = `/tmp/space-video-doodle/music-cc0/tools/venv-ana/bin/python` (numpy, scipy, PIL, fontTools); `PY` below. Node 24 with the
vendored `node_modules` (playwright-core, pngjs, jsqr). System Chrome (headless, real GPU), ffmpeg 9 (Homebrew).
Nobody can listen on this machine: every audio decision is a measurement (BS.1770 loudness / true peak, onsets vs grid, spectra).

| Tool | What |
|---|---|
| `act.sh <scene> [map] [from to]` | **one command per act**: render with music + SFX, QC, contact sheet (`../scenes/README.md`) |
| `film.sh [map]` | the full cut from every `scenes/act-*.js`, size-targeted encode, full QC |
| `render.mjs` | frame renderer: video (chunked, parallel), stills, info, geometry, glyphs, determinism, debugging |
| `serve.mjs` | static + asset server (capture lookup, placeholders, lazy frame extraction) — started by render.mjs |
| `tempo.py` | tempo maps: storyboard bars → track bars → seconds (compile / show / at) |
| `tempo-maps/*.json` | one map per music option (`README.md` there: the choices and what each track can / cannot honour) |
| `trackbars.py` | per-bar features of a track (level, low/high bands, kick, percussion, gaps, hits, chroma) |
| `music.py` | music edit: renders the bed of a map (splices + crossfades + fade/ring), −16 LUFS, TP ≤ −1 dBTP, report + moments |
| `sfx.py` | 31 sound effects synthesized from noise/oscillators, placed from the event log |
| `mix.py` | bed + SFX for a range (SFX 9 LU under the music), loudness / true peak |
| `qc.py` | QC report (container, duration, size, loudness, TP, silence, black/frozen/motion, event gaps, reading time, glyphs, beat grid, QR, safe area, placeholders, SFX level, script coverage) |
| `contact.py` | contact sheet from the encoded mp4 at bar:beat positions |
| `qr.mjs` | QR decoder (jsQR) |
| `audiolib.py` | shared audio code (decode, BS.1770 meter via ffmpeg, true-peak limiter, onset envelope) |

## Pipeline

```
scenes/act-*.js ──(dm library, stage.html?map=M&scene=S)──> Chrome ──DM.render(f)──> PNG ──> chunk (x264 4:4:4 CRF 4) ─┐
        │                                                                                                       concat ──> H.264 High 4:2:0
        └─ DM.info(): events, texts ──> sfx.py ─┐                                                                  BT.709, 60 fps, CRF  ──> .mp4
tempo-maps/M.json ──tempo.py──> compiled/M.json ─┼─> music.py ──> audio/beds/M.wav (−16 LUFS) ──> mix.py ──> AAC 48 kHz 256 kb/s ┘
                                                 └─> dm/core.js (DM.T) and qc.py (beat grid)
```

## render.mjs

```sh
node tools/render.mjs --scene act-A0-A1 --map flipping-in --video out/acts/x.mp4 --from 1:1 --to 21:1 --mix [--workers 4] [--crf 18] [--preset medium]
node tools/render.mjs --scene <all acts, comma-separated> --map M --video out/film/x.mp4 --mix --target-mb 150-300 --preset slow
node tools/render.mjs --scene S --map M --stills 5:1,31:3.5,f600,12.5s --dir out/stills [--names a,b,c]
node tools/render.mjs --scene S --map M --info out.json | --geom out.json [--stride 3] | --glyphs out.json | --determinism 12
node tools/render.mjs --scene S --map M --at 14:3.5 --eval "DM.shots.map(s => s.id)"      # debug state at a frame
node tools/render.mjs --scene S --map M --from 3:1 --bench 60                              # ms per frame: DM.render vs screenshot
```

* Positions: `21:1` (storyboard bar:beat under the map), `38.5s`, `f2340`. Default range = the whole film of the map.
* Workers are separate Chrome processes (the screenshot PNG encode happens in the browser process, so tabs of one browser do not scale).
  Each takes a 4-second chunk from a queue and pipes PNGs into its own ffmpeg (x264 4:4:4 CRF 4, "visually lossless"; `--mezz lossless`
  for libx264rgb qp 0). `--resume` keeps finished chunks of an interrupted run; `--keep` keeps them afterwards.
* Final encode from the chunks: H.264 High, yuv420p, BT.709 primaries/transfer/matrix, limited range, 60 fps CFR, GOP 2 s, faststart,
  AAC-LC 48 kHz 256 kb/s. `--target-mb 150-300` re-encodes from the chunks (no re-render) with a corrected CRF until the file lands in range.
* Measured here (machine shared with the capture passes, load average 15–35): 11–14 fps with 4 workers; the 39 s A0–A1 act renders in
  ~3.5 min + ~1.5 min mix/encode; the full 175 s cut ≈ 15 min render + ~8 min `slow` encode.

## Music, SFX, mix

```sh
PY tools/tempo.py compile all | show flipping-in-b | at flipping-in 51:1 31:3
PY tools/music.py render all            # audio/beds/<map>.wav + .m4a (for listening) + .report.json; prints the moments table
PY tools/music.py moments all           # the table again from the reports
PY tools/music.py prepare original-124  # re-render the original score with the map's SCORE_CONFIG (niced; ~1.5 min)
PY tools/sfx.py list | demo audio/sfx/demo-all-sounds.wav | bus <info.json> <out.wav> [--from S --to S]
PY tools/mix.py <map> <info.json> <out.wav> [--from S --to S] [--sfx-lu -9] [--full]
```

* **Splices** happen on bar lines only. The crossfade ENDS on the downbeat (incoming bar at full level on its downbeat, pre-rolled
  from its own preceding audio); 20 ms by default, 60 ms when the music drops > 6 dB at the splice (lets cymbals fade instead of
  cutting). The last run continues into the tail; `fade` (map) fades from a storyboard position to the end, else the music ends
  with its own ring (natural ending) and a 0.25 s safety fade.
* **Loudness**: integrated −16.0 LUFS (ffmpeg ebur128), 4× oversampled look-ahead true-peak limiter at −1.5 dBTP so the AAC encode
  stays ≤ −1.0 dBTP. The bed is normalised over the whole film; an act preview keeps that absolute level (only limited), the full
  cut is normalised again after the SFX are added.
* **Report** per bed: splices with a click check (local > 6 kHz spike vs the same downbeat played naturally), loudness before/after,
  limiter work, onsets vs grid (median offset of the strong onsets after removing the detector's −10.3 ms bias, calibrated on
  synthetic hits; all six tracks land within ±5 ms), and the storyboard moments measured on the rendered audio.
* **SFX**: pop, paper slap, stamp, impact, slam, boom, marker squeak, highlighter, pencil scribble, pencil tick, whoosh, swish, tick,
  click, type tick, chime (glock run + bell), crowd-ish swell (14 band-limited noise "voices" with slow AM), tape rip, zip, boop,
  confetti crackle, heartbeat, page flip, riser, chat blip, vinyl scratch, sparkle, zoom thump, ding, shutter, "hmm" plucks.
  Deterministic (seeded per event), at most two starting within 25 ms, no retrigger within 60 ms, pan from the element's x.
  With the original score, `music_has` (chime, dings, riser …) suppresses the SFX that would double the music.

## QC

`PY tools/qc.py <video.mp4> [--full] [--final]` (companion files next to the video are found automatically; `act.sh` / `film.sh`
produce them). FAIL items block, WARN items are for review; `--final` turns placeholder captures into failures. The geometry pass
(`--geom`, every 3rd frame) gives the measured reading windows and the safe-area boxes; the glyph pass asks Chrome
(`CSS.getPlatformFontsForNode`) which font drew every character.

## Housekeeping

Caches: `tools/.cache/frames` (footage frames, ~0.3 MB each), `tools/.work` (chunks of running renders). Disk is tight (~15 GB free):
`rm -rf tools/.cache/frames tools/.work/*` is always safe. Servers/browsers started by render.mjs are closed when it exits.
