**Film v1 narration readability review: 11 problems (1 must-fix, 6 should-fix, 4 nice)**

Evidence (frames, phone-size sheets, crops, measurements) is in `/tmp/space-video-doodle/prod/review/read/`. Phone size means the film shown 390 px wide, so 128 px type becomes about 26 px, 84 px about 17 px, 56 px about 11 px, and 36/32/30 px about 7/6.5/6 px. Bars use the flipping-in map.

1. **01:02.43–01:04.39 · bars 33:1–34:1 · A2-A3 · must-fix**
   - **Problem at 33:1:** 「照片不上传。」 lands on top of 「人海。」 (still popping out) while 「AI 在本机判断，」 jumps about 235 px up, having finished typing 0.1 s earlier. For 5 frames the required wording is a three-line overprint (`crops/c10-privacy-jump.png`).
   - **Problem at 33:3–34:1:** 「没把握的时候，」 types in at the top of the column (y 150–249) above 「照片不上传。」 and the padlock (y 575–729). For about 1 s the column reads 「没把握的时候，/照片不上传。」, a false condition on the privacy claim. The whole wrong sentence is on screen at 01:04.30 (`crops/c4-order-privacy.png`).
   - **Fix:**
     - Set T055 `until:'32:4.5'`.
     - Run T056's move over 32:4.5→32:4.9, so T057 lands on clear paper.
     - At 33:3, fade T057 and the padlock to about 30%: `.move('33:3', Tc('33:3')+0.1, {o:0.3})`. Their script windows stay the same.

2. **00:16.59–00:17.66 · 9:3–10:1 · A0-A1 · should-fix**
   - **Problem:** 「你拍了舞台，」 hits 「散场了。」. The 1.4× pink 「舞台」 covers the lower half of 「散」 for 1.07 s (boxes T020 681–1240×57–247, T021 298–1012×177–370). It is visible at 1080p and on a phone (`crops/c1-sanchang.png`, `sheets/phone-01.png` #16).
   - **Fix:** move T020 to `x:1340` so its box starts at 1060 or later, or give it `until:'9:3'` (it still gets 0.98 s). Don't push T021 down, because polaroid A sits under it.

3. **Five places in A2-A3 (and one in A0-A1) where the incoming line lands on the outgoing one · should-fix**
   - **Where:**
     - 00:36.10 (19:3, A0-A1)
     - 00:42.93 (23:1)
     - 00:56.59 (30:1)
     - 00:58.54 (31:1)
     - 01:14.15 (39:1)
   - **Problem:** the default pop-out (`dm/core.js` OUT.pop: swell to 1.08, then shrink, 6 frames) starts at `until`. That is the same frame the next line slams in at 1.6× in the same place, so you get 5–6 frames of mashed double type on the downbeat. Examples: 「能把那一面，换回来？」 over 「还没认识，就走散了。」; 「带上你的小人，」 and 「断拍」 over 「同场的人／再进同一间 Livehouse。」; 「21:48」 over 「放一张你的照片。」; 「拍的是哪一面？」 over 「21:48」; 「规则判断，不是 AI。」 over 「3 分钟以内，」 (`crops/c3b`, `c3c`, `c3d`, `c3e`).
   - **Fix:** A4 already avoids this with `outFx:'cut'`. Do the same on T031, T041, T042, T050, T051 and T065. Alternatively, assembly can change the shared default so the pop finishes on `until` instead of starting there.

4. **A4 reading order · should-fix**
   - **Where:**
     - 01:27.80 (46:1), 01:29.75 (47:1), 01:31.70 (48:1)
     - 01:43.29–01:44.45 (53:4.75–54:3)
   - **Problem at 46:1–48:1:** the alternating top and bottom slots put each pair's first line above the previous pair's last line for 1 s. Reading top-down crosses the pairs: 「换不换，／换 TA 看到的。」, 「我同意，／你们俩说了算。」, 「还要 TA 也同意。／交给 TA 确认。」.
   - **Problem at 54:1:** 「随时可以撤销。」 (required wording, which had only 0.9 s in place) slides 250 px down while being read. It then sits under the 「然后呢？」 card, reading as if revoking were the next step.
   - **Fix:**
     - When a pair's first line enters, fade the surviving line to about 30%: T076 at 46:1, T078 at 47:1, T080 at 48:1.
     - For T086, drop the keys move and slam it straight to its final low-left spot. Then either fade it when the card lands, or pop it at 54:2 and drop the card on 54:2.

5. **Disclosures too small on a phone · from 00:00.00 · assembly (and A2-A3, A5, A6-A7) · should-fix**
   - **Problem:** at phone size the required small print is 6–7 px tall, which is unreadable (`sheets/phone-*.png`):
     - 「照片为 AI 生成的示例图」 at 32 px (film opening tag, 00:00–00:07.80) and 36 px (A1, A2 E4, A3, A4, A5), and 30 px in A6 W5 (02:36.10).
     - Chips T053 (00:57.56) and T100 (01:58.05) at 36 px.
     - End-card T145/T146 at 32 px.
   - **Fix:**
     - Raise the `fine` default and the `film.js` tag to 44–48 px, and W5's 30 px note to 44 px.
     - Set T053 and T100 to 48 px.
     - Set the end-card small print to 40 px.

6. **00:00.49–00:07.80 · bars 1:2–4:4.5 · A0-A1 · should-fix**
   - **Problem:** the eight hook stamps are the only words in the first 8 s, and they are weak:
     - The `.stamp` style uses coloured ink on a half-transparent fill under a distressed mask. Yellow #c99700 is about 2.6:1 and mint #1f9f83 about 3.2:1.
     - 「视角」 sits on the AI card's body copy, 「同一刻」 on the black button label, 「招手」 on the chat bubbles, 「交换」 on the photos, and 「上墙」 is mint on mint.
     - At phone size only 「换装」 and 「留念」 read (`crops/c5-hook.png`).
   - **Fix:** use an opaque `var(--card)` fill and a lighter mask, darken yellow to about #8a6a00, go from 56 to 68–72 px, and move those four stamps onto paper margins. The same style change helps 「示例角色 · 自动回复」 (00:51.71, about 2.5:1 on the floor).

7. **01:20.98–01:21.71 · 42:3–42:4.5 · A4 · should-fix**
   - **Problem:** 「不到 1 分钟」 fades in, then the whip at 42:4.5 blurs it. It is cleanly readable for only about 0.5 s; 5 units need 1.25 s (QC credited 0.80 s).
   - **Fix:** stamp 21:48 on 41:4, 21:47 on 41:4.5, and the bracket plus T072 on 42:1. That gives about 1.7 s before the whip.

8. **Thin pink notes · A2-A3 · nice**
   - **Where:** T044 (00:44.88, 24:1), T062 (01:09.27, 36:3), T067 (01:16.10, 40:1).
   - **Problem:** thin brush strokes in #ff5c8a on cream (about 2.6:1) are faint on a phone. 「上墙啦！」 is fully typed for only 0.55 s before the cut.
   - **Fix:** use `--stamp-pink` #e9396b or add a 2 px ink stroke, go from 84 to 96 px, and pop T062 in instead of typing it.

9. **Milder order problems (same cause as note 4) · A0-A1, A2-A3, A5 · nice**
   - **Where (newer line sits above the older one):**
     - 00:35.12 (19:1): 「要是……」 over 「还没认识，就走散了。」
     - 00:58.54 (31:1): 「拍的是哪一面？」 over 「拍摄时间，照片自己记得。」
     - 01:14.15 (39:1): 「规则判断，不是 AI。」 over 「就是同一刻。」
     - 01:49.27 (57:1): 「私聊，」 over 「对方愿意，才成朋友。」
     - 01:55.12 (60:1): 「散场以后，继续聊。」 over 「不会被打扰。」
     - 02:16.59 (71:1): 「散场后，仍有地方回来。」 over 「在你的浏览器里生成。」
   - **Also:** 「保存，上墙。」 jumps 300 px mid-read at 35:3 (01:07.35).
   - **Fix:** fade the older line to about 30% as in note 4. Let T061 type at its final y instead of jumping.

10. **00:07.07 · 4:3.5 · A0-A1 · nice**
    - **Problem:** 「留念」 is readable for 0.60 s before the 4:4.5 wipe (QC warning).
    - **Fix:** move the CUT-08 card and the T008 stamp to 4:3, which gives 0.85 s.

11. **End card from 02:42.68 · 84:2.5 · A6-A7 · nice**
    - **Problem:** the URL pill is 56 px (the script says 84), about 11 px on a phone. The first line of T145 ends on a stray 「·」.
    - **Fix:** set the URL to 64–72 px (it fits at the top right), and break T145 before the 「·」 or drop it.

No issues with missing glyphs: 俩, 呢 and 陌 fall back to the same typeface's raw font and render correctly. No lasting title-safe problems either; the only edge cases are 0.05–0.10 s during whip pans and entrances. Everything else meets the reading-time rule except notes 7, 8 and 10.