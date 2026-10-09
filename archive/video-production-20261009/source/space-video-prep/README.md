# /tmp/space-video-prep — competition video pre-production (Route B)

Written 2026-10-05 by the video pre-producer. The repo was not touched. Read in this order:

| File | What it is |
|---|---|
| `STORYBOARD.md` | **the storyboard**: hook-first, 2:45 (2:35 without the optional two-device insert), per shot: time, visual, on-screen text, music cue, transition, static-vs-Node source, capture script, status; sync points; honesty checklist; decisions and cross-scope findings |
| `PIPELINE.md` | capture method + **measured fps** (frame-stepped, 60 unique fps), commands, recorder API, gotchas, checklist for the final shoot on the Route B build |
| `MUSIC.md` | music options with licences/proofs, the original score's arrangement and beat grid, how to retime |
| `QC-CHECKLIST.md` | automated + manual QC (≤ 3:00, ≤ 500 MB, no watermark, loudness, QR, honesty) |

## Deliverable map

| Brief item | Where |
|---|---|
| 1. Storyboard | `STORYBOARD.md` (+ machine-readable `assembly/make-timeline-v2.py` → `assembly/timeline.v2.json`, `timeline.v2.noM3.json`) |
| 2. Music: 2–3 CC0 candidates with proof + original fallback + beat times | `music/01-…`, `02-…`, `03-…` (+ `04-…` extra) each with `LICENCE-PROOF.md`, proof PNG/HTML/txt, `beatmap.json`; original score `music/gen_original_v2.py` → `music/original-v2/` (165 s) and `music/original-v2-noM3/` (155 s), `beats.json`; 96 BPM bar-aligned CC0 version `music/02-ocean-breeze__HoliznaCC0/ocean-breeze_96bpm_bar-aligned_48k24.wav` |
| 3. Capture pipeline + 10 s test clip | `capture/rec.mjs` (+ `PIPELINE.md`), `clips/test-rc4-eventroom-10s.mp4`; reference shots `capture/shots/`; Route B drafts `capture/routeb/` |
| 4. Style frames (3+ title cards, 5 s clip + still each, iterated) | `cards/*.html`, `cards/out/*.mp4` and `*-1080.png`: opening title `card-a-open`, pain beats `card-b-pain`, `card-b2-groupalbum`, `card-b3-noopening`, turn `card-d-whatif`, keepsake `card-k-memory`, end card `card-c-end`, hook lockup `card-h-lockup` (alpha) |
| 5. Assembly + QC | `assembly/assemble.mjs`, `render-subs.mjs`, `qc.mjs`, `decode-qr.mjs`, `hits.mjs`, `compose-duo.mjs`; outputs `assembly/out/animatic-v2.mp4` (540p30), `assembly/out/space-v2-rehearsal.mp4` (1080p60, tagged rehearsal), `*.qc.json`, `*.qc-contact.png` |

## Status in one paragraph

Everything that does not depend on the Route B build is **final quality** (cards, hook camera work + grade + lockup, end card with a verified QR, score, captions, assembly, QC). Product footage in the cut is **REHEARSAL** from RC4 (`main 2edc18d`), recorded through the same kit; it shows the real UI and the intended look (camera director zooms, split-screens) but not the Route B features (AI chip, moment grouping, badge, cast, NPC exchange). Shots that cannot exist on RC4 are tagged slates. The final video must be recorded on the frozen Route B build with `capture/routeb/` (written from the design, untested) and re-assembled; `PIPELINE.md` §5 is the checklist.

## Folder map

```
cards/        HTML motion graphics (+ render-card.mjs, render-overlay.mjs, assets/, out/)
capture/      rec.mjs recorder + director, world.mjs, shots/ (RC4 reference), routeb/ (Route B drafts), cinematic.css, measure-methods.py, test-*.mjs, runs/ (method experiments, 850 MB, deletable)
assembly/     assemble.mjs, render-subs.mjs, qc.mjs, make-timeline-v2.py, timeline.*.json, out/
music/        CC0 candidates (+ proofs), gen_original_v2.py, original-v2*/, beatmaps/
clips/        final/ (rehearsal + hook mezzanines), test-*.mp4, final-v1-backup/
photos/       demo pack with EXIF times (stage 21:47:12 / crowd 21:48:03 / unsure 21:50:20)
stills/       screenshots used for planning and fallbacks
repo-rc4/     built copy of main 2edc18d (git archive) used by the RC4 reference shots
tools/        playwright-core, jsqr/pngjs, python venv (numpy/scipy), chrome wrappers (unused)
notes/        run logs, fps measurement output
work-v2/      scratch (contact sheets, test frames)
```
