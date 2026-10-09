# Tempo maps — one per music option

A map says which bar of the track plays under every storyboard bar (`plan`), which storyboard bars the elastic plan removes (`cut`,
STORYBOARD §5 ✂ list) or inserts (`"28+1"`, §5 ADD list), the tail after the last bar, the fade (or the track's own ending) and what the
music already plays (`music_has`). `PY tools/tempo.py compile <id>` writes `compiled/<id>.json`, the single timeline read by the
picture (`DM.T`) and the sound (`music.py`, `mix.py`, `qc.py`). Choices were made from per-bar measurements (`PY tools/trackbars.py
<beats.json>`: level, 30–150 Hz, 5–11 kHz, kick on the beats, percussion density, end-of-bar gap, downbeat hit, chroma) and every
splice was checked for harmonic continuity (`PY tools/tempo.py show <id>`: 1.00 = sounds like a passage the track itself plays).
Rendered beds for listening: `prod/audio/beds/<id>.m4a` (and `.wav`); the full measurement report next to them (`.report.json`).

| id | track | BPM | bars | runtime | cut / inserted |
|---|---|---|---|---|---|
| `flipping-in` | Wax Lyricist《Flipping In》CC0 | 123 | 89 | 174.66 s | ✂1 (bar 90) — **the animatic proposal as given** |
| `flipping-in-b` | same | 123 | 89 | 174.66 s | ✂1 — **recommended variant** (stop before the drop and the payoff, payoff/lift on the full kit, the band's own ending) |
| `grab-a-partner` | Loyalty Freak Music《Grab A Partner》CC0 | 130 | 93 | 174.09 s | +28+1, +54+1, +90+1 |
| `tea-party` | Zane Little《Post-Adventure Tea Party》CC0 | 110 | 80 | 174.94 s | ✂1–✂9 (8, 15–16, 36, 40, 71–72, 81, 89–90) |
| `consternation` | Wax Lyricist《Consternation At The Disco》CC0 | 130 | 93 | 173.49 s | +28+1, +54+1, +90+1 |
| `love-love-love` | HoliznaCC0《Love Love Love》CC0 | 115 | 83 | 174.72 s | ✂1–✂5 + ✂7 (15–16, 40, 71–72, 89–90; bar 8 kept so the title gets whole 2-bar phrases) |
| `original-124` | team score《Same Moment, Other Side》(re-rendered) | 124 | 90 | 174.89 s | none — the score was re-rendered with the STORYBOARD §3.1 section lengths |

All beds: −16.0 LUFS integrated, true peak ≤ −1.5 dBTP before AAC, no splice click (local > 6 kHz spike vs the same downbeat in the
track), strong onsets within ±5 ms of the beat grid (median +0.1 … +4.4 ms after removing the onset detector's calibrated bias).

## Storyboard moments, measured on the rendered beds (`PY tools/music.py moments all`)

| id | title stop 5:1 | pain 9–18 sparse | drop 21:1 | AI chime 31:3 | payoff 51:1 | break 73–74 | lift 75:1 | end |
|---|---|---|---|---|---|---|---|---|
| `flipping-in` | **no** — the stop is on 7–8; 5:1 is in the groove | yes (−2.6 dB, ½ onset density) | **weak** (+3.2 dB: drums return, no stop) | SFX | yes, +11.6 dB but **rank 2** (the bass entry on 9:1 is bigger) | yes (−4.2 dB) | yes (+5.8 dB) | fade |
| `flipping-in-b` | **no** — stop on 7–8 | yes | **yes** (+13.5 dB out of the stop) | SFX | **yes**, +12.5 dB onto the full kit + horns (rank 2 behind the drop by 1 dB; louder after the hit) | yes (−3.3 dB) | yes (+8.1 dB) | the band's own final hit |
| `grab-a-partner` | partial — groove ends on 5:1 (−6.2 dB), final chord rings | **no** — the song never drops its drums (lightest verse, −2.8 dB) | **weak** (+0.4 dB) | SFX | **yes**, +13.7 dB, rank 1 (band stops on 49:1, final chord rings, chorus 2 on 51:1) | yes (−4.9 dB) | yes (+3.5 dB) | the song's final chord |
| `tea-party` | partial — groove drops to the quiet intro on 5:1 (−4.9 dB) | **no** — lighter section, drums keep playing | yes (+6.3 dB after the song's gap) | SFX | **partial**, +5.1 dB, gap −4.4 dB on 50:4 (the song has no bigger hit) | yes (−4.5 dB) | yes (+4.0 dB) | the song's final hits (0.4 s tail only) |
| `consternation` | partial — band drops to the −29.5 dB breakdown on 5:1 (−11 dB) | yes (12 drumless bars) | yes (+12.7 dB after a gap) | SFX | yes, +10.3 dB (breakdown → the song's drop), rank 2 behind 21:1 | yes (−3.9 dB) | **partial** (+0.5 dB, kick-only build) | the song's final hit |
| `love-love-love` | partial — band drops to the ambient break on 5:1 (−11.9 dB) | yes (−11.9 dB, ambient) | yes (+12.4 dB) | SFX | **yes**, +12.6 dB, rank 1 | yes (−11.2 dB) | yes (+12.3 dB) | the song's final hit |
| `original-124` | **yes** — stab 4:3.5, digital silence, impact 5:1 (+35 dB) | partial (−2.8 dB; half-time) | yes (bass/kick +22 dB after the build) | **in the music** | **yes**, +42 dB after the one-beat gap (rank 1) | partial (stop-time hits stay loud, −1.4 dB) | partial (+2.4 dB; a whole step up is a key change, not loudness) | big chord, final ding, ring-out |

Where a track cannot honour a moment, the picture still hits it (SLAM + SFX impact on 5:1, chime SFX on 31:3, confetti crackle + boom
on 51:1); the table says where the music itself carries it. Verdict rules: `yes` ≥ 6 dB step (or ≥ 6 dB in 40–160 Hz), `weak/partial`
2–6 dB, `no` below; payoff `yes` = one of the two biggest downbeats of the film and ≥ 6 dB.

**Recommendation.** Keep FI as the working track but switch the edit to `flipping-in-b`: same opening, but the stop returns before the
product drop (the drop becomes +13.5 dB instead of +3.2) and the payoff lands on the full kit + horns (FI 105) instead of the thin
FI 103; the lift goes onto the full kit; the end card ends on the band's own final hit instead of a fade. `love-love-love` honours the
most moments of the CC0 options (three ambient breaks = title stop, the wait, the break); `original-124` is the only one that does
everything on the exact storyboard bars, including the AI chime.

## The plans

* **flipping-in** (as proposed): sb 1–6 = FI 55–60 · 7–8 = 61–62 (stop) · 9–20 = 63–74 (no drums) · 21–48 = 75–102 · 49–50 = 61–62 ·
  51–66 = 103–118 · 67–72 = 107–112 · 73–74 = 119–120 (drum break) · 75–82 = 103–110 · 83–89 = 111–117, fade from 87:1, 1 s tail.
* **flipping-in-b**: 1–8 as above · 9–18 = 63–72 · **19–20 = 61–62** · 21–48 = 75–102 · 49–50 = 61–62 · **51–64 = 105–118** ·
  65–72 = 79–86 · 73–74 = 119–120 · **75–86 = 105–116** · 87–88 = 119–120 · **89 = 121** (final hit) + 1 s ring.
* **grab-a-partner**: 1–4 = 97–100 · 5–7 = 101–103 (final chord) · 8 = 9 · 9–14 = 10–15 · 15–20 = 10–15 · 21–48 + 28+1 = 16–44 ·
  49–50 = 102–103 · 51–68 + 54+1 = 47–65 · 69–72 = 89–92 · 73–74 = 14–15 · 75–90 + 90+1 = 85–101 · 2.4 s ring.
* **tea-party**: 1–4 = 13–16 · 5–7 = 1–3 · 9–14 = 17–22 · 17–18 = 63–64 · 19–20 = 67–68 (gap) · 21–28 = 25–32 · 29–39 = 41–50 ·
  41–50 = 59–68 (gap) · 51–70 = 69–88 · 73–74 = 1–2 · 75–80 = 89–94 · 82–88 = 96–102.
* **consternation**: 1–4 = 21–24 · 5–8 = 25–28 (breakdown) · 9–10 = 37–38 · 11–20 = 57–66 (gap) · 21–28 + 28+1 = 67–75 · 29–40 = 76–87 ·
  41–48 = 41–48 · 49–50 = 27–28 · 51–54 + 54+1 = 29–33 · 55–57 = 34–36 · 58–65 = 49–56 · 66–72 = 83–89 · 73–74 = 39–40 · 75–82 = 41–48 ·
  83–90 + 90+1 = 83–91 · 1.8 s ring.
* **love-love-love**: 1–4 = 21–24 · 5–8 = 77–80 · 9–12 = 1–4 · 13–14 = 77–78 · 17–20 = 25–28 · 21–39 = 29–47 · 41–48 = 48–55 ·
  49–50 = 3–4 · 51–70 = 5–24 · 73–74 = 79–80 · 75–86 = 61–72 · 87 = 78 · 88 = 81 (final hit) · 1.5 s ring.
* **original-124**: identity 1–90; the score is rendered from `prod/audio/original-124/src/score.py` with SCORE_CONFIG
  `{"bars": {"TITLE": 4, "PAIN": 10, "GROOVE_A": 8, "AI": 12, "REVEAL": 10, "GROOVE_B": 22, "LIFT": 8, "END": 6}, "ai_chime_bar": 3,
  "ai_chime_beat": 2, "total_s": 174.9}` (STORYBOARD §3.1 with total 174.9 s for the 175 s limit). The original generator crashed for
  REVEAL ≠ 8 bars (its rising bass line was hard-coded to bars 5–8 of the section); the copy here builds on the last 4 bars of REVEAL —
  the only change. Its `beats.json` confirms every hit on its storyboard bar: stab 4:3.5, impact 5:1, tagline 6:1, pain 9:1, build 19:1,
  drop 21:1, dings 22/24/26/28:4, AI chime 31:3, reveal 41:1, gap 50:4, payoff 51:1, groove 55:1, dings 56–62:4, break 73:1, lift 75:1,
  tag 83:1, end chord 85:1, final ding 88:1. `music_has` makes the SFX tool drop its chime, dings and riser.

## Credits (end card T146 / FORM)

CC0 needs no credit; optional courtesy lines are in each map's `track.credit` (e.g. 「配乐：Wax Lyricist《Flipping In》（CC0 1.0 公共领域）」),
licence proofs in `music-cc0/<track>/LICENCE-PROOF.md`. The original score: 「配乐：团队原创（代码合成，无采样、无第三方录音）」.
