# Showcase demo photos (static site)

Tooling behind `web/static-runtime/demo-assets/`: the six JPEGs and `manifest.json` that the seeded show night of the static
site (`https://musicmapteam.github.io/musicSpace/`, `demo/` in the Pages tree) shows and offers. **One-off, macOS-only developer tooling**
(`/usr/bin/sips`): it never runs in the app, in `npm run build`, in `npm run build:pages` or in CI. The outputs are committed; you need
this folder only to re-cut them.

## Where the pictures come from

- All six are **crops of the repository's two AI-generated 1536x1024 images**, `web/assets/stage-scene.png` and
  `web/assets/crowd-scene.png`: synthetic, fictional concert imagery made with OpenAI's built-in `image_gen` on 2026-09-26. Tool, prompts
  and sha256 of both are in [`web/assets/image-provenance.json`](../../web/assets/image-provenance.json); the build script refuses a
  source whose hash differs from it.
- **No third-party image, stock picture or picture of a real person is used.** The show (「回声现场」), the venue (「月台 Livehouse」), the
  people (阿遥, 小满, 北屿, 林间) and every time are invented. Since 2026-10-07 the app does not label them one by one: the About panel's
  one sentence says that the venue, the audience and the photos of the online edition are demo content (AGENTS.md, 2026-10-07). A crop, then a JPEG at quality 80; the only retouch is one documented levels
  lift on `man-near.jpg` (below), because that crop was too dark to read.
- Listed with the other assets in [`THIRD_PARTY_NOTICES.md`](../../THIRD_PARTY_NOTICES.md) ("Static demo site: showcase photos").

## The six files

| File | Used as | Source | Box x, y, w, h | Size | Bytes |
| --- | --- | --- | --- | --- | --- |
| `yao-stage.jpg` | 阿遥, 舞台, 21:47:20 | `crowd-scene.png` | 0, 60, 620, 413 | 620x413 | 70,016 |
| `man-crowd.jpg` | 小满, 人海, 21:48:05 | `crowd-scene.png` | 200, 380, 620, 413 | 620x413 | 56,842 |
| `bei-balcony.jpg` | 北屿, 细节, 21:49:30 | `stage-scene.png` | 1000, 0, 536, 357 | 536x357 | 34,042 |
| `man-near.jpg` | 小满, 身边, 22:21:10 (levels lift) | `crowd-scene.png` | 0, 650, 700, 374 | 700x374 | 75,391 |
| `sample-stage.jpg` | 「舞台那张」, a visitor's one-tap photo | `stage-scene.png` | 340, 120, 840, 560 | 840x560 | 90,522 |
| `sample-crowd.jpg` | 「人海那张」, a visitor's one-tap photo | `crowd-scene.png` | 836, 200, 700, 600 | 700x600 | 81,292 |

- The four cast photos are uploaded by the seed (`web/static-runtime/showcase/seed.js`) through the room API, as their characters, with
  the facts those characters "typed": capture time and viewpoint, both `manual`. The files carry **no** capture time and no AI label; their
  viewpoints are their authors' choices. Times and sides live in `roster.js`.
- The two samples carry their **fictional** capture time inside the file, in EXIF: `DateTimeOriginal` 2026-09-26 21:47:50 (stage) and
  21:48:10 (crowd), `OffsetTimeOriginal` +08:00, so that the upload form reads a real capture time with `web/js/ai/exif-time.js` and
  shows it like any photo's (「拍摄于 21:48 · 来自照片自带的信息」). Until 2026-10-07 the app also noted next to them that the time was
  made up; that note is gone with the other labels (the About sentence covers the photos of the online edition).
- Every file passes the room worker's photo limits (`sanitizeAvatarJpeg`: JPEG, at most 300 KB, 2400 px and 4 MP). No two crops of one
  source overlap by more than 35 % of the smaller one (the largest overlap is 27.9 %, `man-crowd` and `man-near`, so the wall never
  shows one picture twice). Total 408,105 bytes; first boot fetches only the four cast photos (236,291 bytes), the samples load when tapped.
- `man-near.jpg` is the crowd's back rows in the dark: as cut it measures a mean luminance of 9 of 255 (the other five 23 to 75) and showed
  as a black square in a polaroid. Its lossless cut gets one levels step before the JPEG, the same table on R, G and B (`tone` in `PLAN`):
  black point 2, white point 70, gamma 0.85, that is 255 · ((level − 2) / 68)^0.85, clamped. It then measures 37. Nothing else is changed
  on it or on any other file, and never on a sample (their pixels are the ones the AI was measured on; the script refuses a `tone` there).
- `manifest.json` records, per file: source, crop box, size, bytes, sha256, `tone` for the one file that has it and, for the samples,
  `fictionalExifTime` and `pixelSha256`.

## The EXIF stamp

`exif-inject.mjs` writes one Exif APP1 segment (`DateTimeOriginal`, `OffsetTimeOriginal`) right after the JFIF header of the file `sips`
wrote. `sips` has an Exif segment of its own (colour space and pixel size, no time); it stays, behind the stamped one, because the
reader tries every APP1 and because these are the exact bytes that were measured (below). The image data is never decoded again.
`stripCaptureTime()` removes the stamped segment and gives back the encoder's own bytes; `pixelSha256` is the hash of that.

## What the on-device AI said about the sample pixels (2026-10-05, to be re-measured in the shipped build)

Measured with the real model (TinyCLIP-ViT-8M/16 image tower, int8) through the app's own path (compress, then classify), on the
**same pixels** as the files here, in a prototype of this site, over five different resamplers:

| Sample | Result | Margin over the second class (the app's "sure" gate is .02) |
| --- | --- | --- |
| `sample-crowd.jpg` | 人海, **sure** (the form pre-selects it and says 「AI 判断：人海」) | .033 to .038 |
| `sample-stage.jpg` | **unsure** (the form says 「不确定，请选择」 and offers its two best guesses) | .005 to .007 |

These are observations on two fictional pictures, not an accuracy figure for the product. They belong to these exact pixels, so they
are **not carried over** to a re-encode, and they are to be measured again in the shipped build (`docs/event/evidence/static-pages-qa.md`).
That is why the pixel hashes are pinned in `MEASURED_SAMPLE_PIXELS` (`build-demo-photos.mjs`) and again checked by
`tests/static-showcase-seed.test.js`: the build refuses to write samples whose pixels differ unless you pass
`--accept-new-sample-pixels` after measuring. If `sample-crowd` stops being sure, swap the crop; never loosen the gate.

## Rebuilding

```sh
node scripts/demo/build-demo-photos.mjs                    # cut, verify, write the six JPEGs and manifest.json
node scripts/demo/build-demo-photos.mjs --check            # cut into memory, compare with the committed files, exit 1 on any difference
node scripts/demo/build-demo-photos.mjs --accept-new-sample-pixels   # only after the sample pixels changed on purpose and were measured
```

- `sips` crops with `-c height width --cropOffset y x` and encodes in a second step (`-s format jpeg -s formatOptions 80`). On the
  macOS this was made on (26.6.2) a rebuild reproduces the committed bytes exactly (`--check`); another macOS version may encode
  differently, and then the sample guard above stops the write.
- `sips` answers a crop that starts at the left edge **and** ends exactly on the bottom edge (`x = 0`, `y + h = 1024`, that is
  `man-near`) with the whole image. The script therefore compares every cut with the source pixels, repeats a wrong one on the mirrored
  image (flip both ways, crop the mirrored box, flip back; all lossless) and stops if a cut is still not the box.
- After a rebuild: **raise `SEED_REV`** in `web/static-runtime/showcase/roster.js` when a cast photo changed (a browser keeps the photos
  it was seeded with until the version changes), re-measure the AI when a sample changed, then run
  `node --test tests/static-showcase-seed.test.js`; it checks hashes, sizes, worker limits, overlap, the EXIF time of both samples and the
  measured pixels, and it pins a fingerprint of the seeded world (photo bytes included) to `SEED_REV`, so a re-cut that forgets the bump fails.
- What the bump does: `SHOWCASE_VERSION` (`r` plus 10 hex digits of the roster's hash and `SEED_REV`) changes, a browser that holds the
  old world finds another version in its marker, wipes its disposable data (the visitor's demo data with it, by design: the data is
  disposable) and lays the new world out on its next boot, with the toast 「现场已更新」. Any edit of the roster does the same
  by itself; `SEED_REV` covers what the roster cannot show: these photo bytes and the steps of `seed.js`.
- `SEED_REV` history: 1 the first world; 2 `man-near.jpg` re-encoded with the levels lift; 3 (2026-10-07) the complete-product copy:
  the names lose 「·示例」 (阿遥, 小满, 北屿, 林间), the room is 「回声现场」 at 「月台 Livehouse」, the seeded lines drop the
  automatic-reply sentence, the samples are 「人海那张」 / 「舞台那张」 without a note, and the seed links the room to the venue's fan
  community 「月台 Livehouse 乐迷社群」 (hosted by 阿遥) with the next show 「回声现场 Vol.2」 posted in it (`ROOM.community`, `openCommunity`
  in `seed.js`). The photo bytes did not change.

## Files

| File | What it is |
| --- | --- |
| `build-demo-photos.mjs` | the plan (`PLAN`: file, source, box, tone, EXIF time), the cut, the levels step (`toneTable`, `writePng`), the verification, `manifest.json`; exports `PLAN`, `MEASURED_SAMPLE_PIXELS`, `LIMITS` for the test |
| `exif-inject.mjs` | `stampCaptureTime`, `stripCaptureTime`, `hasCaptureTime`, `exifSegment` |
