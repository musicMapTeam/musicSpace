Rhythm and sync review of film v1. I measured every frame of the mp4 and the audio. At the micro level the timing holds up. All 591 visual events sit on the 16th-note grid. Every cut and wipe reveal shows up within one frame of its beat; the payoff cut lands +4.7 ms after the 51:1 downbeat. The mp4 audio matches the mix wav with 0.0 ms lag. Even after removing the boil frames, no hold reaches 2.5 s. The real problems are the music map, a few type handovers, some camera pre-moves and one SFX.

1. **must-fix · 01:37.56–01:41.46 (51:1–53:1) · assembly/audio · the music sags right after the payoff**
   - **What's wrong:** under the `flipping-in` map, 51:1 plays Flipping In bar 103, a thin bass-and-keys re-entry at −17.7 dB. Bar 52 stays thin (−17.9 dB, 300–3000 Hz band at −30.2 dB), and 「两面都齐了。」 slams there at 01:40.49. The full band with horns only arrives on 53:1 (−14.5 dB, mids +10 dB), under M7 scrolling to the revoke fine print.
   - In the bed, the payoff is only the 3rd-biggest downbeat (6:1 +22.8 dB, 74:1 +19.0, 51:1 +17.9). The boom and impact SFX make it #1 in the mix, but the music peaks two bars later on the wrong shot.
   - **Fix:** re-mix v2 on `flipping-in-b` (the music pass's own recommendation): `out/film-v1.sh flipping-in-b music-space-video-v2`. 51:1 becomes bar 105: +23.2 dB, the #1 downbeat of 89, full band from the hit. The two maps' bar grids differ by at most 2.0 ms, so no act changes are needed and the picture chunks can be reused.
   - **Follow-ups with -b:**
     - 65–72 would play bars 79–86 (mids 8–18 dB lower, about 1 dB quieter) under S7–S11. If that sags, set 65–72 = bars 107–114; v1 already uses the 118→107 splice cleanly at 67:1.
     - The full band now enters on 75:1 (W2 「设想」) instead of 77:1, so W2's entrance must hit (A6-A7).
     - The band's ending hits fall on 89:1.5, 89:4.5 and 90:1.5, so move C1's 89:1 logo wiggle to 89:1.5 (A6-A7).

2. **must-fix · 00:39.03 (21:1), build 00:35.12–00:39.03 (19:1–20:4) · assembly/audio · the drop is weak**
   - **What's wrong:** the product's first appearance sits on bar 75. Its downbeat hit is +8.8 dB (rank 13/89) and the bar level rises only 2.7 dB over bar 20. Two earlier entries hit much harder: 9:1 「散场了。」 at +17.8 dB and 6:1 at +22.8. So the biggest musical entry of the first half belongs to the pain section, not the product.
   - Across 19–20 the bed thins to two bass notes per bar. 「能把那一面，换回来？」 at 19:3 lands on an onset of 0.01, and the riser SFX builds into a drop that never comes.
   - In the mix, 21:1 ranks 11th, below 9:1 (+17.2 dB) and the 50:1 wait bar (+11.6). Its boom is at −9 dB, against −3 dB at 41:1 and +2 dB at 51:1.
   - **Fix:** `flipping-in-b` (same switch as note 1) puts the stop (bars 61–62) under 19–20 and drops bar 75 on 21:1 at +22.6 dB (rank 3). If v1's map stays, at least raise the 21:1 boom to −3 dB.

3. **should-fix · 8 title handovers · A0-A1, A2-A3, A5 (or assembly in dm/text.js) · the line change smears the beat**
   - **What's wrong:** when a line ends on the beat where the next one slams into the same spot, both are on screen for about 6 frames (100 ms) and the beat reads as a garbled double exposure. The outgoing default pop-out (swell to 1.08 for 2 frames, then shrink over 4) overlaps the incoming 1.6× SLAM.
   - **Where:**

     | Time | Bar | Act | Handover |
     |---|---|---|---|
     | 00:36.10 | 19:3 | A0-A1 | T031 → T033 |
     | 00:42.93 | 23:1 | A2-A3 | T041/T042 → T043, over the 断拍 chip |
     | 00:56.59 | 30:1 | A2-A3 | T050 → 「21:48」 |
     | 01:02.44 | 33:1 | A2-A3 | 人海 exits, T056 jumps up while still typing, 照片不上传。 slams |
     | 01:07.32 | 35:3 | A2-A3 | T060 exits while T061 reflows |
     | 01:14.15 | 39:1 | A2-A3 | T065 → T066 stamp |
     | 01:50.25 | 57:3 | A5 | T091 → T093 |
     | 02:13.66 | 69:3 | A5 | T109 → T110 |

   - **Fix:** give the outgoing line `outFx:'cut'` on that beat (H2 already does this for T010/T011). Alternatively, in dm/text.js, start a title's pop-out 6 frames before `until`.

4. **should-fix · 00:00.78 (1:2.6) and 00:01.75 (1:4.6) · A0-A1 · camera pull-backs fire between beats**
   - **What's wrong:** the H1 camera keys '1:2.6'→'1:3' and '1:4.6'→'2:1' use outExpo. Both pull-backs start 0.1 beat after the "and" and peak about 190 ms before the slaps they make room for.
   - They are the biggest accents of the first two seconds: motion 21.9 and 19.2, against 8.6 and 10.6 for the slaps at 1:3 and 2:1. The opening reads as flams off the grid.
   - **Fix:** in act-A0-A1.js, move '1:2.6'→'1:2.5' and '1:4.6'→'1:4.5' (on the hi-hat "and", onsets 0.56/0.48), or start each pull-back on its slap's beat.

5. **should-fix · 00:59.51 (31:3) · assembly/audio (tools/sfx.py) · the AI chime lands late**
   - **What's wrong:** `s_chime` plays a glock run from the event time and the bell at +180 ms. In the mix the bell (−18.3 dB, 12 dB over the run) lands at 59.70 s = 31:3.39, between the 16th and the 8th. The chip appears exactly on 31:3, so the AI moment's sound arrives after it.
   - **Fix:** pre-roll the chime by 0.18 s so the bell sits on 31:3 (the bus already pre-rolls whoosh/swish by 60 ms), or play the bell first and the run after it.

6. **should-fix · 01:01.46 (32:3), 01:30.73 (47:3), 02:01.95 (63:3), 02:09.76 (67:3) · A2-A3, A4, A5 · type-on lines run past the next downbeat**
   - **What's wrong:** four TYPE lines (one character per 16th) are still typing when the next title or cut lands:
     - T056 ends at 33:1.25, under 照片不上传。
     - T080 ends at 48:1.25.
     - T102 「揭晓前，谁也看不到。」 ends at 64:1.5, still ticking under the 「选到一起了！」 reveal.
     - T108 ends at 68:1.25: its last characters appear after the cut to S9, and it stays over S9's title until 68:3.
   - **Fix:** type these at 32nds, or start them on x:2.5 so the last character lands by x:4.5. End T108 on the 68:1 cut.

7. **should-fix · 02:43.90–02:47.81 (85:1–87:1) · A6-A7 + audio · end card is still while the music is at full level**
   - **What's wrong:** 83–86 is the stillest picture in the film (motion 0.50 with boil removed, near-static from 86:1; 1.1–3.0 everywhere else). It sits on the loudest music level (−15.1 dB, same as A5).
   - The QR pop on 85:1, the call to action, has no musical accent: rank 79/89 in the mix, only a pop SFX. Then v1 fades for 6.9 s.
   - 「另一面。」 at 83:2.5 is the film's only title off beats 1 and 3. That position came from the original score's tag hits, which Flipping In does not have.
   - **Fix:**
     - Keep the card pulsing while the QR stays still: the cast row hops on every beat 85–88 and the stars pop on 8ths.
     - Give 85:1 a real hit (tape plus impact).
     - For Flipping In maps, move T141 to 83:3.
     - With -b, the tag rides bars 119–120 (the 88:1 heart pop meets a +19 dB hit) and ends on the band's own hits.

8. **nice · 01:46.15 (55:2.6) · A5 · same flam as H1**
   - **What's wrong:** the view punch onto the greet button peaks 176 ms before the 55:3 tap, and it is bigger than the tap (motion 9.6 vs 7.0).
   - **Fix:** move '55:2.6'→'55:2.5' (accent 0.59) or start it on 55:3.

9. **nice · 00:11.03–00:13.43 (6:3.6–7:4.5) · A0-A1 · near-hold on the title card**
   - **What's wrong:** with boil removed, this is 2.40 s of near-static picture: three small stars and a 9 px underline. It is the longest static stretch in the film, right where the bass drops out (bar 61).
   - **Fix:** add one visible gesture on the stop, e.g. the polaroids trade places through the ⇄ on 7:1, or start the type's flight to the landing card on 7:3.

10. **nice · 02:12.68–02:13.68 (69:1–69:3) · A5 · invisible ticks**
    - **What's wrong:** the memory-card ticks on 69:1 and 69:2 are a few pixels inside the phone, so there is 1.0 s with no visible change in the loudest groove.
    - **Fix:** mint ✓ doodles beside the phone on 69:1, 69:2 and 69:3, or punch onto the checkboxes on 69:1.

11. **nice · 02:32.20 (79:1) · A6-A7 / audio · weak accent on 「曲终，」**
    - **What's wrong:** the emotional line lands on an ordinary groove downbeat (mix +6.0 dB, rank 43/89) with a single impact SFX. 21:1, 41:1 and 51:1 all get boom plus impact.
    - **Fix:** add a boom at −3 dB on 79:1.

12. **nice · whole film · assembly (tools/qc.py) · the QC motion check cannot see holds**
    - **What's wrong:** the paper grain and boil step every 5th frame (12 fps; mean |dI| 3.5 on those frames vs 1.6 on the rest). That alone guarantees "longest low-motion 0.08 s". On non-boil frames the longest stretches are 2.40 s (note 9) and 1.63 s (00:29.35, bar 16).
    - **Fix:** run the motion and frozen checks only on frames where f % 5 ≠ 0.

Files are in /tmp/space-video-doodle/prod/review/rhythm/:
- measurements.json
- sheets/ (drop.png, payoff.png, seams1.png, seams2.png, h1-camera.png, t033.png, handover.png, ai33.png, typecross.png, endcard.png, h2hold.png, bar69.png)
- tools/