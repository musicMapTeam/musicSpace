# Music for the competition video — options, licences, beat grid

Rule context (official FAQ Q11, `references/official/2026-09-26/spreadsheet/06-faq-cells.md`): music used in a Demo may not be commercial use / public release, and the organisers suggest 公版免费歌曲 (public-domain free songs). The brief for this video is stricter: **only original music or CC0/public-domain tracks with saved licence proof; never commercial songs.** No lyrics, no samples from commercial recordings, no TME-list songs.

**Nobody has listened to these tracks on this machine (no audio output was used).** What was verified objectively: loudness, true peak, section energy, spectrogram, tempo/beat grid. The owner must audition and choose before the lock.

## 1. Options

| # | Option | Type / licence | Length | Tempo | Proof | Fit |
|---|---|---|---|---|---|---|
| **A** | **Original score v2** (synthesized by `music/gen_original_v2.py`, 100 % our own synthesis: electric-piano, plucked guitar, bass, brush/kit drums, pad, bells; no samples) | original, CC0-style dedication by the team (nothing derived from any recording) | 165 s + 3 s tail (155 s variant without M3) | 96 BPM, bar 2.5 s | the script itself (`music/gen_original_v2.py`, seed 1005) | **bar-locked to the storyboard**: hook / pain / drop / reveal / consent / lift / resolve land on the cuts |
| B | HoliznaCC0, *Orbs In A Photo (LoFi, Chill)* | **CC0 1.0**, Free Music Archive | 220.0 s | 120 BPM (autocorr confidence .42) | `music/01-orbs-in-a-photo__HoliznaCC0/LICENCE-PROOF.md` | real recorded lo-fi; tempo does not fit the 96 BPM grid |
| C | HoliznaCC0, *Ocean Breeze (LoFi, Ukulele, Peaceful)* | **CC0 1.0**, FMA | 197.6 s | 85.0 BPM | `music/02-ocean-breeze__HoliznaCC0/LICENCE-PROOF.md` | closest to 96 BPM: **96 BPM bar-aligned version provided** (+13 % time-stretch, pitch kept) |
| D | HoliznaCC0, *Walking Away (Lofi, Peaceful, Motivating)* | **CC0 1.0**, FMA | 156.0 s | 81.5 BPM | `music/03-walking-away__HoliznaCC0/LICENCE-PROOF.md` | shortest; "motivating" mood |
| E (extra) | Kimiko Ishizaka, *Goldberg Variations: Aria* (Open Goldberg Variations) | **CC0 1.0**, FMA | 299.5 s | free tempo | `music/04-extra-piano-goldberg-aria__Kimiko-Ishizaka/LICENCE-PROOF.md` | calm solo piano; wrong mood for an indie-live piece, kept as a rights-clean plan C |

Each proof folder holds: source track page URL, direct file URL, the licence line as shown on the page, retrieval date (UTC 2026-10-05), sha256 of the downloaded file, a full-page screenshot + raw HTML of the track page, the CC0 1.0 deed text/screenshot, and (Holizna) the artist's own statement "This music is completely Public Domain, so use it how you want!". CC0 needs no attribution; an optional courtesy line is 「Music: HoliznaCC0 (CC0)」. A platform Content-ID system could still flag any CC0 track by mistake (the competition form upload is not such a system); the original score avoids that risk entirely.

SHA-256 of the files: B `c756c55f…0945`, C `3dbc9713…b358`, D `fd8a618a…7610`, E `6412a521…cfb4` (full hashes in the proofs).

## 2. Recommendation

1. **A (original v2)** unless a human listener prefers a CC0 track: zero licence risk, every cut and hit point is on the bar grid, and it can be re-timed in 8 s (see §4).
2. If a recorded sound is preferred: **C at 96 BPM** (`music/02-ocean-breeze__HoliznaCC0/ocean-breeze_96bpm_bar-aligned_48k24.wav`, 172.5 s, downbeats on the 2.5 s bar grid): `node assembly/assemble.mjs assembly/timeline.v2.json --music music/02-ocean-breeze__HoliznaCC0/ocean-breeze_96bpm_bar-aligned_48k24.wav`. The hit-point cues (drop, chime, swell, lift) will not follow the picture, because the track has its own arrangement; the cuts still land on its bars.
3. Check the beat map by ear once (`downbeat_offset_beats` is a low-band energy guess, ±1 beat possible).

## 3. Original score v2: arrangement (bars 1-based, 2.5 s each)

| Bars | Time | Section | What you hear | Picture |
|---|---|---|---|---|
| 1–5 | 0:00–0:12.5 | HOOK | warm sustained electric piano + pad, I–IV–vi–V (Cmaj9 Fmaj9 Am9 G69), bell sparkle every second bar, soft pulse bars 4–5, **soft impact on bar 5 (10.0 s)** | H0: 3D tour, lockup |
| 6–13 | 0:12.5–0:32.5 | PAIN | sparse, minor-first (Am9 Fmaj9 Cmaj9 G69), bells, heartbeat kick bars 12–13, riser into 14 | P1 P2 P3 Q |
| 14 | 0:32.5 | **DROP** | crash + sub drop, groove enters (kick/snare/hats, bass, comp, guitar arp) | E1 |
| 14–31 | 0:32.5–1:17.5 | GROOVE A | full groove; **single bell chime at bar 27 (65.0 s)** = AI chip | E1–A3 |
| 32 | 1:17.5 | **REVEAL** | rising four-note bell figure (C6 E6 G6 C7) + melody hook (every other 4 bars) + shaker | M1 badge |
| 32–35 | 1:17.5–1:27.5 | GROOVE B | | M1 |
| 36–45 | 1:27.5–1:52.5 | CONSENT | brushes, thin, warm pad; **swell + bell at bar 40 (97.5 s)** when the other side agrees | M2, M3 |
| 46–52 | 1:52.5–2:10 | GROOVE A′ | light groove returns; riser bars 51–52 | S1, S2 |
| 53–62 | 2:10–2:35 | **LIFT** | crash on 53; full groove, strummed guitar, hook every bar, extra open hats | S3a … K2 |
| 63–66 | 2:35–2:45 | RESOLVE | **big warm chord on 63 (155.0 s, end card)**, drums out at 64, final bell, 3 s tail | C |

Section levels of the raw mix (RMS per bar, before loudness normalisation): bars 1–13 ≈ −16 dBFS, groove ≈ −11, consent ≈ −15, resolve ≈ −16, i.e. the drop lifts the bed by about 5 dB. Normalised master: **−16.0 LUFS integrated, LRA 5.6 LU, true peak −6.6 dBFS** (`space-original-v2_-16LUFS_48k24.wav`). `assemble.mjs` re-measures and applies gain to the timeline's `target_lufs` (−16, music-only bed; QC accepts −14…−18).

Files (`music/original-v2/`): `space-original-v2.wav` (44.1 kHz mix), `space-original-v2_-16LUFS_48k24.wav`, `…_-16LUFS.m4a`, `stems/*.wav` (keys, guitar, bass, drums, pad, fx, bell), `…loop-8bar-20s.wav` (seamless loop of 8 groove bars), `beats.json` (sections, cue times, `bar_starts_s`), `waveform-v2.png`, `spectrogram-v2.png`. Variant without the optional insert M3: `music/original-v2-noM3/` (155 s + tail; cues moved 10 s earlier). The earlier pain-first score (v1, 160 s) is kept in `music/original/` for reference.

## 4. Beat times for cut sync and re-timing

* Original: `beats.json` → `bar_starts_s` (66 + 1 entries), beat 0.625 s, 16th 0.15625 s, swing 10 % on off-beat eighths. Key times: **0.0** music in · **10.0** title impact · **12.5** pain · **32.5** drop · **65.0** AI chime · **77.5** reveal · **97.5** consent swell · **112.5** groove returns · **130.0** lift · **155.0** end-card chord.
* CC0 candidates: `music/beatmaps/*.json` (`bpm`, `first_downbeat_s`, `bar_starts_s` over the whole track; analysis by `music/beatmap.py`, constant-tempo grid, ± one beat uncertainty on the downbeat).
* Re-time the two moment cues to the final footage: `node assembly/hits.mjs assembly/timeline.v2.json hits.json > music/score-config.final.json` (hits.json = seconds inside the raw clips), then regenerate (8 s):

```sh
cd /tmp/space-video-prep/music
SCORE_CONFIG=score-config.final.json SCORE_OUT=$PWD/original-v2-final ../tools/venv/bin/python gen_original_v2.py
cd original-v2-final
I=$(ffmpeg -hide_banner -nostats -i space-original-v2.wav -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+I:" | tail -1 | awk '{print $2}')
ffmpeg -y -i space-original-v2.wav -af "volume=$(python3 -c "print(round(-16-($I),2))")dB,alimiter=limit=0.84:level=disabled,aresample=48000" -c:a pcm_s24le space-original-v2_-16LUFS_48k24.wav
```
  Structural cues (title, drop, reveal, consent_first, light_first, build, lift, end_card, drums_out) are integer bars; `ai_chime` and `consent_swell` may be fractional.
* Fades: the timeline fades the music in over 0.6 s and out over the last 3.5 s (the score has its own 3 s tail).

## 5. Provenance statement for the submission sheet

「视频配乐为团队原创（本地合成，无采样、无第三方录音），脚本见 music/gen_original_v2.py」 — or, if a CC0 track is chosen, 「视频配乐：HoliznaCC0《Ocean Breeze》，CC0 1.0（公共领域），来源 freemusicarchive.org」 with the proof folder kept for the organisers.
