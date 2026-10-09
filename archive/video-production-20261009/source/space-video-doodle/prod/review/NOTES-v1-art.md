**Film v1 art and impact review: 16 notes (2 must-fix, 7 should-fix, 7 nice), most important first**

Each note gives the time in the film and the storyboard bar, using the flipping-in map (123 BPM, bar = 1.951 s). Evidence is in `/tmp/space-video-doodle/prod/review/art/`: `sheets/` has one frame per beat, `verify/` and `strip/` have the crops and strips, and `metrics.json` has the paper and colour fractions per frame. Audio statements are measurements only; nobody listened.

1. **[must-fix] 01:13.17–01:15.12 · 38:3–39:3 · A2-A3** (same fault at 01:02.44–01:03.41 · 33:1–33:3 and 01:11.46–01:12.20 · 37:3.5–38:1)
   - **Problem:** the highlighter bands paint over the UI words they are meant to mark.
     - On the lifted rule card, 「相差不超过 3 分钟」 under the yellow band measures RGB 212,177,62 on a band of about 255,212,71. That is about 1.3:1 contrast; the same line outside the band is about 12:1. The on-screen proof of the 3-minute rule disappears while 「3 分钟以内」 is shown.
     - The mint bands wash 「AI 在本机判断，照片不上传」 down to about 2:1.
     - The wall cards' 「拍摄于 21:48」 go pale.
   - **Likely cause:** A4's swipe at 46:3 keeps its ink because `act-A4.js:210` sets `mix-blend-mode` on the stroke element. `act-A2-A3.js:47` (`hlOn`) and `dm/strokes.js:138` (`DM.highlight`) set it on the inner path. That path sits inside the stroke's own boiling (transformed) layer, so it paints normally over the text.
   - **Fix:**
     - Set `st.el.style.mixBlendMode='multiply'` in both helpers, or put the band under the text.
     - Re-render bars 33 and 37–39.
     - Evidence: `verify/highlighters.png`, `verify/hl-mint.png`, `verify/f-73.65.png`.

2. **[must-fix] 01:03.41–01:04.39 · 33:3–34:1 · A2-A3**
   - **Problem:** 「没把握的时候，」 types in directly above the still-visible 「照片不上传。」 and its padlock. The column reads 「没把握的时候，照片不上传。」, a conditional privacy claim that implies photos are uploaded when the AI is sure. That breaks the product-wording rule.
   - **Fix:**
     - Type T058 below T057 (around y 820) and move it up only when 「照片不上传」 leaves on 34:1. Alternatively, slide 「照片不上传。」 with its padlock into a chip by the phone on 33:3.
     - Add a check in `film.js`: warn when a new title enters above an older one that is still visible.

3. **[should-fix] 00:15.61–00:39.02 · 9:1–21:1 (P1–P3, the pain section) · A0-A1**
   - **Problem:** this is the emptiest stretch of the film. In most of the film, 60–80% of the frame is plain paper (median of per-bar medians 74%). In the pain section it is 87% (bar 9 96%; bars 14–19 86–90%). The approved animatic's pain beats were 67–74%, with phones and polaroids of about 450–520 px filling the frame (`animatic-contact-2x4.png`).
     - 「散场了。」 stands alone for a whole bar.
     - The polaroids are about 420 px.
     - The stranger's phone is about 330 px at the right edge, with the middle third of the frame empty.
     - The avatars are about 330 px tall, in the bottom third.
     - 23 s of small objects on cream paper is the abstract, weak look the owner rejected.
   - **Fix:** go back to the animatic's scale.
     - Land the polaroids under 「散场了。」 on 9:1.
     - Phones around 550 px; the P2 photo around 1100 px; the stranger's phone around 600 px tall, centre-right; avatars around 480 px.
     - Keep the quiet palette but stop leaving the frame empty.

4. **[should-fix] 01:37.56 · 51:1 (payoff) · A4** (plus removing starbursts in A2-A3, A5, A6-A7)
   - **Problem:** the film's biggest moment has no visual of its own.
     - Its composition (phone + yellow starburst + display title) repeats the 21:1 drop.
     - The starburst appears 10 times: 5:1, 5:3 (pink), 21:1, 32:1, 41:1, 51:1, 61:1, 64:1, 70:1, 74:1.
     - The music under it (Flipping In bar 103) is thin. The tempo map itself marks the payoff "partial"; the full kit only arrives on 53:1.
   - **Fix:**
     - Keep the burst only on 5:1, 21:1 and 51:1. Replace the others with marker rings, stamps or sparkles.
     - On 51:1, lift the product's own mint 「交换已接受」 sticker out of the phone at about 3× (as A3 does with the AI chip on 32:1). Fly the two M1 polaroids in on either side of it.
     - Audition the `flipping-in-b` map, which puts the payoff on Flipping In bar 105.

5. **[should-fix] 00:07.80 · 5:1 (title slam) and 02:32.20 · 79:1 (「曲终，」) · assembly/audio**
   - **Problem:** the two key lines get no musical accent. Mix level change from the 8th note before the downbeat to the 8th after:

     | Downbeat | Change |
     |---|---|
     | 5:1 title | −0.4 dB |
     | 79:1 「曲终，」 | +0.9 dB |
     | 21:1 drop (for comparison) | +5.1 dB |
     | 41:1 collision (for comparison) | +5.8 dB |
     | 51:1 payoff (for comparison) | +18.1 dB |

     Both lines land mid-phrase (Flipping In bars 59 and 107). On 5:1 only the slam's own SFX plays. The tempo map says an impact SFX carries 5:1, but no impact is placed there.
   - **Fix:**
     - Mute the bed from 4:4.5 to 5:1 (under the wipe) and put an impact at 0 dB on 5:1.
     - Duck the bed by about 20 dB from 79:1 to 79:2.5 (0.73 s, under the 0.8 s silence limit) with a warm impact. Bring the groove back on 79:3 with 「人不散。」 and the returning avatars, so 「曲终，」 actually stops the song.

6. **[should-fix] 00:16.59 · 9:3 (P1/P2, through 00:31.22) vs 01:18.05 · 41:1 (M1) · A0-A1** (script lines T021/T022)
   - **Problem:** "you" and "TA" swap roles and photos between the pain and the product demo.
     - P1 says 「你拍了舞台，TA 拍了人海」 with the stage photo on the left, and P2 circles 「你！」 in TA's crowd photo.
     - M1 and M6 say 「你拍人海，TA 拍舞台」 and the exchange gives you a stage shot. So the payoff never returns "the best photo of you" that P2 promised.
     - P1 and the title card use the `stage-scene`/`crowd-scene` pair, which look alike at about 420 px (`verify/pain-photos.png`). M1 uses a different pair.
   - **Fix:**
     - Use `sample-crowd.jpg` (yours) and `yao-stage.jpg` (TA's) everywhere: title card, P1, P2, M1.
     - Swap T021/T022 to 「你拍了人海，」 / 「TA 拍了舞台。」.
     - Circle 「你！」 on a raised hand in TA's stage photo.

7. **[should-fix] 01:04.39–01:06.34 · 34:1–35:1 and 02:22.44–02:24.39 · 74:1–75:1 · A2-A3, A6-A7** (the dm font stack)
   - **Problem:** two Display glyphs misread at title size. This is the same class of problem as the known 入/个 trap; the glyph check passes them because the glyphs exist.
     - 它 in 「它就说不确定。」 looks like 已/巳.
     - 多 in 「都可以多一层。」 looks like ヨ.
     - Evidence: `verify/crop-ta.png`, `verify/glyphs-film.png`.
   - **Fix:**
     - Route 它 and 多 to Doodle Marker inside Display lines, or reword T059 to 「AI 就说不确定。」.
     - Add both characters to the glyph check's deny list.

8. **[should-fix] 00:35.12–00:36.10 · 19:1–19:3; 01:29.76–01:30.73 · 47:1–47:3; 01:31.71–01:32.68 · 48:1–48:3 · A0-A1, A4**
   - **Problem:** a new line enters above an older one that is still on screen, so the column reads in the wrong order:
     - 「要是…… / 还没认识，就走散了。」: the hopeful turn reads as more pain.
     - 「我同意， / 你们俩说了算。」
     - 「还要 TA 也同意。 / 交给 TA 确认。」

     The geometry log has about 12 such overlaps lasting around 1 s; these three change the meaning. Evidence: `verify/stacking.png`.
   - **Fix:** apply one column rule: new lines enter at the bottom and push older ones up, dimmed to about 40%. Never enter above a line that is still visible.

9. **[should-fix] 00:13.41–00:14.63 · 7:4.5–8:3 (H3 match cut) · A0-A1**
   - **Problem:** the match happens at thumbnail size, so it never registers.
     - The 240 px title shrinks to about 100 px across the polaroids (about 6 frames of type over the photos).
     - It then cuts to the whole landing page at 1:1, where the product's 「同一刻，另一面。」 card is about 140 px.
     - Evidence: `verify/matchcut.png`.
   - **Fix:**
     - Cut on 8:1 to the 4K landing capture zoomed about 2.5–3×, with the product title matching the video title's size and position.
     - Pull back over 8:1–8:3 and circle 「就是这一刻！」 on 8:3.

10. **[nice] The 8 scribble wipes at 4:4.5, 8:4.5, 20:4.5, 26:4.5, 40:4.5, 54:4.5, 78:4.5, 82:4.5 (e.g. 00:38.78) · assembly (dm wipe)**
    - **Problem:** they are flat mint/yellow/pink polygons with smooth caps and no ink edge or paper grain. They are the only off-style element in the film (`verify/wipes.png`).
    - **Fix:** give the wipe bands a 5 px ink outline, a jittered boiling marker edge, and the grain multiplied on top.

11. **[nice] 00:00.00–00:07.56 · 1:1–4:4.5 (H1 collage) · A0-A1**
    - **Problem:** CUT-01 (the 3D room) and CUT-03 (the 3D wall) land as whole desktop pages with header, nav and footer. The livehouse, the product's best image, is only about 600×280 px of the first card.
    - **Fix:** crop both to the 3D canvas.

12. **[nice] 01:08.29–01:10.24 · 36:1–37:1 (3D wall insert) · A2-A3**
    - **Problem:** the wall is shown whole. The polaroids are about 130 px and the new fifth one appears at that size, so 「上墙啦！」 lands on a mostly empty frame.
    - **Fix:** punch in about 1.6× from the 4K master at 36:1.

13. **[nice] Whole film · assembly (`film.js`)**
    - **Problem:** 「照片为 AI 生成的示例图」 moves between all four corners and switches between a boxed tag and plain text:

      | Time | Position and style |
      |---|---|
      | 00:00–00:07.8 | top-left, boxed |
      | 00:08.8–00:39.0 | bottom-right, plain |
      | 00:55.7–01:43.9 | bottom-left, plain |
      | 01:53.2–01:57.1 | bottom-left, boxed |
      | 02:10.8–02:20.5 | top-right, plain |
      | 02:36.1–02:40.0 | bottom-right |

    - **Fix:** use one boxed tag in one corner (bottom-left), driven by a single film-level overlay.

14. **[nice] 02:43.90–02:54.66 · 85:1 to end (end card) · A6-A7**
    - **Problem:** the QR modules are about 325 px; the storyboard asks for at least 380 px.
    - **Fix:** scale the QR card about 1.2× (move the link pill up).

15. **[nice] 02:06.83–02:08.78 · 66:1–67:1 (community room) · A5**
    - **Problem:** the zoom of about 2.5–3× on the phone's 3D header (used to keep the Music Map chip out of frame) makes the 3D render soft and stair-stepped next to the crisp chips (`full/crop-community-100.png`).
    - **Fix:** zoom no more than about 1.3× and frame the chip out, or cover it with a tape doodle.

16. **[nice] 01:55.12–01:56.10 · 60:1–60:3 (cut from the quiet-person shot to the chat room) · A5**
    - **Problem:** the desktop caption card 「不会被打扰。」 stays over the phone layout for a beat. 「想安静的人，」 also collapses through a mini card about 170 px wide in the middle of the frame. It reads as a leftover (`strip/s3-s4.png`).
    - **Fix:** hard-cut T095 on 60:1, and restyle T096 as a paper card for the beat it carries over.