1. **Must-fix. Owner: assembly/audio (release step). 02:36.10–02:54.66, bars 81:1–90 plus the tail.** The end-card link and QR point to a site that does not show the product in the film.
   - **What is wrong.** The link pill and the QR both give `https://musicmapteam.github.io/musicSpace/` (I decoded the QR myself). As of 2026-10-07 06:34 GMT that address serves the old night-sakura "樱下音乐小院" build:
     - `/musicSpace/build.json`, `/fonts/doodle/fonts.css` and `/demo/manifest.json` all return 404.
     - The root `index.html` (1,754,470 B, last modified 2026-10-06 20:14:48 GMT) has none of 示例路线, 今晚，我这样, 交换已接受, 专辑世界杯, 默契局, 创作角, 纪念卡, 我的空间, 示例角色 · 自动回复 or 规则判断，不是 AI.
     - The filmed build 8fa52f0 is only at `/musicSpace/preview/`. Its `build.json` is byte-identical to dist-pages, and that path shows a 「预览版」 ribbon.
     - So a judge who scans the QR sees a different product, and 「打开链接，一人就能走完全程。」 is false today.
   - **Fix.** Make the root switch a gate before the video is submitted:
     1. With the owner's go-ahead after the real-phone test, run the planned publish from preview to root.
     2. Check that the root `build.json` shows 8fa52f0.
     3. Scan the QR from the final mp4 on a phone, with both WeChat and the system browser.
     4. Use the same URL as the form's Demo link (field 05).
     - If the root will not be switched by 10-09, re-render the end card with the link that will actually be judged. Do not submit v1 as it is.
   - Evidence: `review/truth/live-root-index.html`, `live-preview-build.json`, `live-root-build.json.404.html`, `full/t172.00.png`.

2. **Should-fix. Owner: A2-A3. 01:03.52–01:04.49, bars 33:3–34:1.** The privacy line is staged so it misreads.
   - **What is wrong.** 「AI 在本机判断，」 (T056) leaves at 33:3, but 「照片不上传。」 (T057, mint key word plus padlock) stays until 34:1. Meanwhile 「没把握的时候，」 (T058) types in above it at y=200. For about 1 s the column reads 「没把握的时候，／照片不上传。🔒」.
   - The words that make the product's sentence true ("AI 在本机判断") are gone. The padlock pushes it towards "photos never leave your device", which the brief forbids. Two shots later the product's own toast says 「已分享给本场成员」. The room-version string is 「判断时照片不上传；保存现场卡时才上传照片」.
   - **Fix.**
     - Keep T056 until 34:1 so the two halves always leave as one sentence.
     - Bring T058 in at 33:3 below the pair (around y 860), then `.move` it up to y 200 at 34:1, the same pattern T061 uses.
     - Drop the padlock, or put it next to 「AI 在本机判断」.
   - Evidence: `full/t64.10.png`.

3. **Should-fix. Owner: A5. 01:53.17–01:56.20, bars 59:1–60:3 (T096 is 59:3–60:3).** 「想安静的人，不会被打扰。」 promises more than the product does.
   - **What is wrong.** The product only promises 「安静参与：照样保存和分享照片，不接收新招呼。」, and the card in the same shot says 「不接收新招呼。仍可查看 TA 已分享给本场的照片」.
   - In the build, any shared photo still shows the button 「用我的照片，交换这个视角 ↗」, whoever owns it. The exchange API checks that the photo is shared, both people are members, and neither has blocked the other. It does not check participation, so a quiet member can still receive exchange requests.
   - **Fix.** Change T096 to the product's own words, 「不接收新招呼。」, then rerun glyphcheck.
   - Evidence: `full/t113.60.png`, `full/t115.80.png`.

4. **Nice. Owner: A4. 01:20.00–01:21.95, bars 42:1–43:1.** The M1 times look like a one-minute gap.
   - **What is wrong.** The polaroids read 「21:48」 and 「21:47」 with the bracket 「不到 1 分钟」, so the label looks wrong at first glance. The bracket is on screen for only 0.8 s, which is QC's reading-time warning.
   - The true values in the build are 21:48:10 (`sample-crowd` EXIF in `demo/manifest.json`) and 21:47:20 (阿遥·示例's `takenAt`), so the gap is 50 s.
   - **Fix.** Print 21:48:10 and 21:47:20, or drop the minute stamps. Start the bracket at 42:2 so it holds for at least 1.25 s.
   - Evidence: `full/t81.20.png`.

5. **Nice. Owner: A0-A1. 00:15.61–00:17.10, bars 9:1–9:4.** The AI label is still typing when the first AI photo lands.
   - **What is wrong.** The pain-section disclosure T025 types in over about 1.5 s. The stage polaroid lands at 00:16.59 (9:3) while the label still reads 「照片为 AI 生成」. It is complete at about 00:17.1.
   - **Fix.** Show T025 whole at 9:1 (POP or fade instead of TYPE), so it is complete before any photo appears.
   - Evidence: `sheets/z_e16.png`.

6. **Nice. Owner: A6-A7. 02:45.85–02:54.66, bars 86:1–90 plus the tail.** The end-card privacy wording paraphrases the product.
   - **What is wrong.** The fine print says 「数据只存在你的浏览器」. The product's own words, in the footer and the entry consent, are 「数据只存在这个浏览器」. The brief requires the product's own privacy wording.
   - **Fix.** Use 「数据只存在这个浏览器」. Optionally, also replace the W3 「隐私」 caption 「AI 在本机 · 你决定给谁看」 with the product's 「AI 在本机判断，照片不上传」.

Checked and fine, so no other notes:
- **AI photo label:** whenever an AI photo is on screen the label is there too. I checked frames every 0.5 s, plus frame-by-frame passes at 8.6, 13.3, 16.3, 36 and 55.5 s.
- **Logos, third-party images and Music Map:** no TME logos, no third-party or real-person images, and Music Map never appears (I OCR'd every frame with macOS Vision).
- **「设想」:** the sticker is on screen for all of W2 (02:24.39–02:28.29), with QQ音乐 and 酷狗 as plain type only.
- **Brief wording:** 「双方同意，才交换」 and 「随时可以撤销」 match the brief.
- **Other script lines:** every remaining line matches the build's strings.
- **Music:** the bed cross-correlates with 《Flipping In》 at the mapped source times (offset 0 ms, r 0.72–0.999), so the credit 「配乐：Wax Lyricist《Flipping In》（CC0 1.0 公共领域）」 matches `LICENCE-PROOF.md`.

All frames, contact sheets, OCR output (`ocr_hr2.jsonl`) and the live-site fetches are in `/tmp/space-video-doodle/prod/review/truth/`.