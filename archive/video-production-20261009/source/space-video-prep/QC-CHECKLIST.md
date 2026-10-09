# QC checklist for the final video (form field 06)

Form rule (from the user's pasted form, memory `tme-hackathon-submission-form`): video **≤ 3 minutes, ≤ 500 MB, voice-over or subtitles, no watermark or noise, at most 9 videos**. Brief: visually rich, music included, original or CC0 music only.

Run `node assembly/qc.mjs <video.mp4> --contact` (writes `<video>.qc.json` and `<video>.qc-contact.png`; add `--link <url>` if the judged link ever changes), then do the manual part below. Record the results in `delivery/README.md` (duration, bytes, sha256, recording environment).

## A. Automated (qc.mjs)

| Check | Pass condition | Why |
|---|---|---|
| Duration | ≤ 175 s (WARN ≤ 180, FAIL > 180) | hard limit 3:00, margin so a player rounding cannot exceed it |
| File size | ≤ 350 MB (WARN ≤ 500, FAIL > 500) | hard limit 500 MB; 1080p60 CRF 18 for 165 s is ≈ 100–150 MB |
| Container / codec | MP4, H.264 High, yuv420p | plays everywhere (WeChat, browsers, phones) |
| Resolution / fps | 1920×1080, constant 60 (or 30/25/24/50) | |
| Colour tags | bt709, tv range | no washed-out colours on players |
| Audio | AAC 48 kHz stereo | |
| Integrated loudness | −14…−18 LUFS (target −16) | music-only bed, no clipping on phones |
| True peak | ≤ −1 dBTP | |
| Loudness range | ≤ 12 LU | |
| Silent gaps | none > 0.8 s below −50 dB | no dead air / gate artefacts |
| Black frames | none > 0.4 s inside | accidental gaps between shots |
| Frozen picture | none > 3 s except the end card | a stuck recording; in the rehearsal cut RC4 holds and slates trigger it, they must disappear in the final |
| End-card QR | decodes to the judged link (`https://musicmapteam.github.io/musicSpace/`) | the QR is a promise |
| SHA-256 | printed | write into `delivery/README.md` |

## B. Manual (watch the whole thing at 100 % on a laptop, then 30 s of it on a phone)

1. **No watermark / noise**: no browser chrome, no Playwright / Tabbit / recorder tray, no cursor artefacts outside the intended arrow + ripple, no mic/system noise (there is no voice track; music only).
2. **Subtitles legible**: every Chinese caption readable at phone size (≥ 40 px at 1080p), none cut off, none covering a control that matters (captions sit in the 88 px band), on screen long enough to read (≥ 0.25 s per character is a good floor; the generator uses 3.5–9 s for 14–27 characters).
3. **Honest labels visible** (see STORYBOARD §4): hook note 「示例角色与照片均为虚构（AI 生成）」; cast labelled 「·示例」; 「AI 判断：…」 and 「不确定，请选择」 shown; pairing/grouping captions say *rules, not AI*; consent sentence readable before 「把这两张交给对方确认」; band note on every product shot; M3 (if kept) labelled 「完整版」 and 「演示：同一台电脑上的两个独立浏览器身份」.
4. **No claims that are not on screen**: no real users, no launch, no accuracy figure, no real-phone validation, no cross-device exchange on the Pages link, "AI only suggests the viewpoint".
5. **No private data / tokens**: no real names, emails, tokens, local paths, preview ribbons, devtools, URLs other than `musicmapteam.github.io/musicSpace/`; the QR scans to that link.
6. **Build truth**: footage from the frozen Pages build (not Node, not `/preview/`, not RC4 rehearsal); no `SPACE_WORKAROUNDS` CSS; radio-button layout correct in the entry panel; no red 「连接暂时没有回应」 or other error states; model-download progress not shown (or shown deliberately).
7. **Music provenance**: the chosen track's proof folder (CC0 licence line + hash) or the original-score script is saved next to the delivery; no lyrics, no commercial recording.
8. **Rhythm**: cuts land on bars (the music hits: 10.0 s title, 32.5 s drop, chip chime, 77.5 s reveal, accepted swell, 130 s lift, 155 s end chord); no shot longer than ~10 s without a visual change (camera director, zoom, caption change).
9. **Ending**: end card holds ≥ 8 s with the link readable; the last frame is not cut mid-music (3.5 s fade-out).
10. **Re-watch the rehearsal tags are gone**: no "REHEARSAL / TO CAPTURE / SLATE" tag anywhere (these only exist in `--animatic` / `--rehearsal` renders).

## C. Sign-off table

| Item | Result | Who / when |
|---|---|---|
| qc.mjs exit code 0 | | |
| Duration / bytes / sha256 | | |
| Manual 1–10 | | |
| Link check on a phone (scan the QR from the screen) | | |
| Audition of the music (a human listened) | | |
| Teammate sign-off (user-owned) | | |
