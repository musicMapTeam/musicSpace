# Third-party notices and visual-asset provenance

This file covers **Music Space 0.16.0** (repository `musicMapTeam/musicSpace`), which was split on 2026-09-30 from the merged Music Map × Music Space 0.15 (commit `3dd102c`).

- **Part 1: used by this app.** Everything the shipped app, its build or its room server actually uses or bundles.
- **Part 2: history, not used by this app.** Notices from the Music Map × Music Space era (0.4 to 0.15), kept as they were written under a status line added on 2026-09-30. The Music Map half was removed from this repository (commits `c455279`, `6f8ff2c`, `d774325`, `1f5a405`); what these sections describe stays in Git at `3dd102c` and, for the Music Map product, in [musicMapTeam/musicMap](https://github.com/musicMapTeam/musicMap). Each status line names the paths that no longer exist here.

## Part 1: used by this app

### Build tools

- [Vite](https://github.com/vitejs/vite), version **8.3.1**, MIT. Used as the development server and build tool; its full license and bundled dependency notices ship with the installed package at `node_modules/vite/LICENSE.md`.
- [vite-plugin-singlefile](https://github.com/richardtallent/vite-plugin-singlefile), version **2.3.3**, MIT. Inlines the app's scripts and styles into `dist/index.html`; its full license ships at `node_modules/vite-plugin-singlefile/LICENSE`. `web/public/` (the on-device AI pack, served as `ai/`) is copied to `dist/ai/` untouched and is not inlined, so the deployable unit is the whole `dist/` (`index.html` plus `ai/`), not one HTML file.
- Exact direct and transitive package versions and integrity values are retained in `package-lock.json`. These build dependencies are not a deployed application backend.
- The built `index.html` retains the license notices of the code bundled into it as HTML comments (added by the `retain-bundled-licenses` step in `vite.config.js`): the full MIT texts of Phosphor Icons, qrcode-generator 2.0.4, Three.js 0.186.1, OverlayScrollbars 2.16.0 and the Sakura Crossing adaptation, and the GSAP / Flip 3.15.0 notice. The TinyCLIP and onnxruntime-web license texts are deployed as files under `ai/` (see below).

### TinyCLIP: on-device viewpoint model (2026-09-30)

`web/public/ai/tc8/vision.onnx` (8,807,127 bytes) is the **image tower of TinyCLIP-ViT-8M/16 with a 3M text tower (pre-trained on YFCC-15M)**, dynamically quantised to int8, and `web/public/ai/tc8/labels.json` (17,609 bytes) holds four precomputed text vectors for the viewpoints stage / crowd / near / detail (the pack's `near` is the app's 「身边」, id `friends`), the image preprocessing constants and the file sizes. The browser runs the model locally to suggest a viewpoint for a photo the person chose; the photo is not uploaded for this. The suggestion is advisory: this is a small zero-shot model, it can be wrong, and the person can always change the viewpoint.

- Method and code: Wu et al., "TinyCLIP: CLIP Distillation via Affinity Mimicking and Weight Inheritance", ICCV 2023; [microsoft/Cream](https://github.com/microsoft/Cream/tree/main/TinyCLIP) (`TinyCLIP/`).
- Checkpoint: [wkcn/TinyCLIP-ViT-8M-16-Text-3M-YFCC15M](https://huggingface.co/wkcn/TinyCLIP-ViT-8M-16-Text-3M-YFCC15M), revision `a2a8c6eaa2549ad66eb7c31b85022bf58273a26c`.
- ONNX export actually used: [onnx-community/TinyCLIP-ViT-8M-16-Text-3M-YFCC15M-ONNX](https://huggingface.co/onnx-community/TinyCLIP-ViT-8M-16-Text-3M-YFCC15M-ONNX), revision **`9463a9c508a344c837ffefe9d724f3827bf2dc79`**, file `onnx/model.onnx` (94,071,688 bytes, SHA-256 `31d28cb07209533d10fc4fef73ac324ce17de6741a2372e7e1531a4ac8fdaeb2`). Its card states it was converted automatically with the onnx-community/convert-to-onnx Space.
- License: **MIT**, Copyright (c) Microsoft Corporation. Read on 2026-09-30: `license: mit` on both Hugging Face model cards (also returned by the Hugging Face API for both pinned revisions), and `TinyCLIP/LICENSE` in microsoft/Cream (file last changed in commit `f3a5fd8aef84b6c9bc35a9179311aa15928773e5`; that file also names CLIP, CoFi and OpenCLIP as MIT and PyTorch (eval) as BSD-style upstream code dependencies, none of which is distributed here). The complete text is copied verbatim to [`web/public/ai/tc8/LICENSE-TinyCLIP-MIT.txt`](web/public/ai/tc8/LICENSE-TinyCLIP-MIT.txt) (byte-identical to upstream `TinyCLIP/LICENSE` at that commit, compared on 2026-09-30) and is deployed next to the model.
- Training data as stated by the cards: **YFCC-15M** (the checkpoint name and the upstream model-zoo row; manual weight inheritance; ImageNet-1k zero-shot top-1 41.1 % in that table). The cards state no dataset licence terms or bias analysis, and this project makes no claim about them. YFCC-15M is generally described as a 15M-image subset of Flickr's YFCC100M collection; that was not independently checked here.
- Local modifications, all offline and reproducible with [`scripts/ai/`](scripts/ai/README.md): (1) the vision tower (`pixel_values` to `image_embeds`) was extracted from `model.onnx`; (2) its weights were dynamically quantised to int8 with onnxruntime 1.30.0 `quantize_dynamic` (QUInt8); (3) four 512-d text vectors were computed with the unmodified fp32 text tower from seven English prompts per viewpoint (`scripts/ai/prompts.mjs`; each prompt vector L2-normalised, averaged per viewpoint and normalised again). The text tower is not distributed. No fine-tuning or further training was done. Commands and SHA-256 values of every intermediate and shipped file are in `scripts/ai/README.md`.
- Hosting: the model, `labels.json` and the runtime below are served from the app's own origin; nothing is loaded from huggingface.co or a CDN at run time.
- Evaluation photos (not distributed): the accuracy figures quoted in `README.md` were measured offline on 75 CC-licensed concert photos from Wikimedia Commons. Those photos are not in this repository, not in the build and not shown in the app, so no license or attribution text for them ships with it. The figures say nothing about photos taken by real audiences.

### onnxruntime-web 1.30.0 (WebAssembly runtime for the model above)

[ONNX Runtime](https://github.com/microsoft/onnxruntime), npm package `onnxruntime-web` **1.30.0** (source tag `v1.30.0`, commit `f2c39fe2f838cf35ce7da92824f5a5e3ee6e88a7`, checked against the upstream repository on 2026-09-30), **MIT**, Copyright (c) Microsoft Corporation. It is a pinned devDependency; `npm run ai:ort` (run by `predev` and `prebuild`) copies three unmodified files from `node_modules/onnxruntime-web/dist` into `web/public/ai/ort/` (git-ignored, deployed as `ai/ort/`): `ort.wasm.min.mjs` (SHA-256 `219e6a1f…6cee3b`), `ort-wasm-simd-threaded.mjs` (`e13f7f94…c4299b`) and `ort-wasm-simd-threaded.wasm` (`3398c10d…42dee2`; full hashes in `scripts/ai/copy-ort.mjs`, which refuses any other content). It runs single-threaded on the WASM backend.

- The MIT text is copied verbatim from the tag's `LICENSE` (byte-identical, compared on 2026-09-30) to [`web/public/ai/LICENSE-onnxruntime-web-MIT.txt`](web/public/ai/LICENSE-onnxruntime-web-MIT.txt) and is deployed next to the runtime. (The npm package itself carries no `LICENSE` file, only `"license": "MIT"` in its `package.json`.)
- `ort.wasm.min.mjs` carries the upstream banner ("ONNX Runtime Web v1.30.0, Copyright (c) Microsoft Corporation, Licensed under the MIT License"). Its source map lists 34 bundled source files: 19 from `onnxruntime-common` (the same repository, MIT, Copyright (c) Microsoft Corporation) and 15 from onnxruntime-web's own `lib/`. No other npm package is bundled into it.
- `ort-wasm-simd-threaded.mjs` is the Emscripten-generated loader for the `.wasm` binary, from the same upstream build. The `.wasm` binary is a build of ONNX Runtime; upstream lists the notices of its own third-party components in [ThirdPartyNotices.txt](https://github.com/microsoft/onnxruntime/blob/v1.30.0/ThirdPartyNotices.txt) at the same tag. That file covers every ONNX Runtime build and was not audited component by component for this WASM binary; it is linked here, not copied.
- The other npm dependencies listed by the package (`flatbuffers`, `guid-typescript`, `long`, `platform`, `protobufjs`) are development-time only and are not part of the deployed output; `package-lock.json` retains their versions and integrity values.

### Capture-time reader (project code)

`web/js/ai/exif-time.js` reads the capture time from a photo in the browser, before the photo is recompressed (recompression drops every EXIF tag): `DateTimeOriginal`, else `DateTimeDigitized`, else the IFD0 `DateTime` (an editor's save time, treated as weak evidence), with the time-zone offset when the photo carries one. Formats: JPEG, HEIC / HEIF / AVIF, PNG, WebP and bare TIFF. It is project code with no third-party source and no dependencies (ported from the feasibility spike's `exif-mini.js`, which this project also wrote). During the spike its output was compared with values read by ExifTool on 96 public test images: 94 agree, and the other 2 exceed the reader's documented limit of 64 segments or chunks, where it returns nothing. ExifTool is not included or distributed; the test images and the comparison output are not committed, so this comparison cannot be re-run from this repository.

### Sakura Crossing renderer and Three runtime (2026-09-27, introduced in MVP 0.6.0)

[Sakura Crossing](https://github.com/Kenton-GMI/sakura-crossing), fixed commit [`de01898e89c7f6ab3fad93fa802f0f5ac66fbd81`](https://github.com/Kenton-GMI/sakura-crossing/tree/de01898e89c7f6ab3fad93fa802f0f5ac66fbd81), supplies the **MIT rendering code adapted in 0.6.0**. Copyright (c) 2026 Kenton Wang. A complete [local MIT notice](web/assets/licenses/sakura-crossing-MIT.txt) accompanies the modules and is embedded in the built `index.html`.

- `web/js/vendor/sakura/toon.js`: cel material bands and tinted shadow shader patch, with scene-owned material and ramp caches.
- `web/js/vendor/sakura/post.js`: depth ink, color grading and FXAA. Adapted for an orthographic camera, local scene distances, DPR ≤ 1.5 and a 2-million-pixel target budget. Linear-to-sRGB conversion remains in the grade pass.
- `web/js/vendor/sakura/palette.js`: unmodified upstream palette.
- Exact upstream paths, SHA-256 values and changes: [SOURCE.json](web/js/vendor/sakura/SOURCE.json). Upstream Three 0.180.0 is adapted to the project's 0.186.1; the relevant shader anchor was read in the installed source.

`web/js/sakura-world.js`, `sakura-scene.js` and `sakura-camera.js` contain original geometry, scene integration and camera direction written for this project (first in the Music Map × Music Space era). No upstream world, player movement, artwork textures or audio is distributed. Upstream stock audio is explicitly excluded from MIT and is not used. The earlier [0.5 visual-only research](references/research/2026-09-27/sakura-visual-reference.md) remains a historical record; the [0.6 adoption note](references/research/2026-09-27/indie-app-direction.md) describes the current scope.

[Three](https://github.com/mrdoob/three.js), package **0.186.1**, is an actual browser runtime dependency for the independently authored scene. License: **MIT**, Copyright © 2010-2026 three.js authors. The complete license is copied to [web/assets/licenses/three-MIT.txt](web/assets/licenses/three-MIT.txt); `package-lock.json` records the exact package integrity. Vite retains the full copyright and permission notice in the built `index.html`, including the runtime package. Its presence in the 0.5 production output was read during integration.

### GSAP and Flip (MVP 0.7.0)

[GSAP](https://gsap.com/), pinned npm package **3.15.0**, supplies camera interpolation, UI entrance timelines and Flip card transitions. Copyright 2008–2026, GreenSock. All rights reserved. License: [Standard No Charge GSAP License](https://gsap.com/community/standard-license/), **not MIT**. The source copyright, author and license reference are retained in [gsap-notice.txt](web/assets/licenses/gsap-notice.txt) and embedded in the built `index.html`. No GSAP source modifications. This application does not expose an animation authoring tool.

The 0.8 scene remains original procedural geometry. Its full-viewport courtyard, open shop, stage, six photo slots, worktable, interior cabinet, instanced petals, cat, physical photo lift and interruptible desktop/portrait GSAP camera director were written for this project (first as the 0.8 scene of Music Map × Music Space; the interactive record-table part was removed in `6f8ff2c`, the record shop remains as inert scenery). Photo textures use only project examples or cards already authorized by the existing application. The vendor renderer modules and their pinned upstream commit remain as documented above.

### OverlayScrollbars

- Official upstream: [KingSora/OverlayScrollbars](https://github.com/KingSora/OverlayScrollbars), npm **2.16.0**.
- Exact release source: `dfa819688a529db0085c6416a94e816bfbaeaf29`.
- MIT, Copyright (c) 2022 Rene Haas. Full notice: [`web/assets/licenses/overlayscrollbars-MIT.txt`](web/assets/licenses/overlayscrollbars-MIT.txt), also embedded in the built `index.html`.
- The unmodified ESM and CSS package is bundled by Vite for body overlay scrollbars; the project configures auto-hide and supplies its own 6px theme. No scroll interpolation, framework wrapper, or optional click-scroll plugin is included.
- Evaluated alternatives and the Codrops visual reference: [`interface-restraint.md`](references/research/2026-09-27/interface-restraint.md). No SimpleBar or Codrops code/assets are bundled.

### Phosphor Icons

`web/js/icons.js` embeds 17 SVGs from the **regular** weight of Phosphor Icons.

- Official upstream: <https://github.com/phosphor-icons/core>
- Package version: `@phosphor-icons/core` **2.1.1**
- Exact commit: `2b75f3ad12b420c9504ef05df8d2564a28f8500e`
- Retrieved: **2026-09-26**
- License: **MIT**, Copyright (c) 2023 Phosphor Icons
- Original license: <https://github.com/phosphor-icons/core/blob/2b75f3ad12b420c9504ef05df8d2564a28f8500e/LICENSE>
- Local complete license: [`web/assets/licenses/phosphor-MIT.txt`](web/assets/licenses/phosphor-MIT.txt)
- Exact per-icon source URLs and source-content SHA256 values: [`web/assets/licenses/phosphor-sources.json`](web/assets/licenses/phosphor-sources.json)

The SVG paths, view boxes, and `currentColor` fill are retained. This project adds `class="icon"`, `width="1em"`, `height="1em"`, `aria-hidden="true"`, and `focusable="false"`, and embeds the SVG strings in a local ES module. The enclosing UI control supplies the accessible label. No Phosphor font, full icon package, or runtime dependency is loaded.

| Local name | Official SVG name |
| --- | --- |
| arrow-right | arrow-right |
| arrow-left | arrow-left |
| arrow-up-right | arrow-up-right |
| plus | plus |
| x | x |
| check | check |
| swap | arrows-left-right |
| camera | camera |
| image | image |
| heart | heart |
| bookmark | bookmark |
| compass | compass |
| users | users |
| trash | trash |
| rotate | arrow-counter-clockwise |
| info | info |
| chevron-right | caret-right |

### QR invitation generation (2026-09-27)

[qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator), **2.0.4**, Copyright (c) 2009 Kazuhiko Arase, MIT. The unmodified npm ES module is bundled into the browser app to encode its invitation URL locally. No external QR service receives the URL. The lockfile retains the package integrity; a complete license is retained at `web/assets/licenses/qrcode-generator-MIT.txt` and below for runtime-package redistribution.

MIT License

Copyright (c) 2009 Kazuhiko Arase

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

### Original courtyard printwork (MVP 0.11.0)

The procedural record sleeves, shop signage and wood-grain textures in web/js/sakura-printwork.js are original project artwork. The striped awning, detailed background houses, foliage and distant hills in sakura-world.js are original geometry. No third-party artwork or additional assets were downloaded for this iteration. Only the Sakura visual direction is exposed in the application and PNG exports; the renderer licenses above remain bundled.

### AI-generated fictional concert imagery

The following images were generated for this project on **2026-09-26**, using the built-in OpenAI image generation tool:

- `web/assets/stage-scene.png`: audience-back view towards a fictional indoor stage.
- `web/assets/crowd-scene.png`: a side view across the crowd at the same imagined concert, using the first generated image only as a venue and lighting reference.

These are newly generated fictional scenes, not documentary photographs of a real event, user-uploaded memories, promotional artist photographs, or licensed music recordings. The prompts requested no brand, logo, text, watermark, identifiable celebrity, or specific real venue. Their common visual direction is dark ink-blue/teal audience lighting with warm coral stage light.

The images are not Phosphor assets and are not covered by Phosphor's MIT license. No third-party reference photographs were supplied. The original generated PNG outputs are copied into the project without cropping, repainting, or other image editing. Prompt and file provenance is recorded in [`web/assets/image-provenance.json`](web/assets/image-provenance.json).

In the app these two pictures are the demo's example photos (Lin's stage view and 阿遥's crowd view, marked "AI 示例图"). The demo gives them fictional capture times (21:47 and 21:48 on 2026-09-26) and a fictional show, "回声现场"; their viewpoints are set by hand and the on-device model above is not run on them. "AI" here means an image generator: these pictures have nothing to do with the on-device viewpoint model.

### Runtime image encoding (2026-09-27)

Original generated PNG files remain unchanged. The app loads same-dimension WebP derivatives (`stage-scene.webp`, `crowd-scene.webp`) encoded with FFmpeg/libwebp at quality 88. No composition or content was changed. Hashes and sizes are in `web/assets/image-provenance.json`. FFmpeg is an authoring tool, not bundled in the app.

### Room server (Node.js built-ins)

`server/` uses only Node.js built-ins (`node:http`, `node:crypto`, `node:zlib`, `node:sqlite`, `node:fs`, `node:path`, `node:url`, `node:util`) and has no npm runtime dependencies. API references: [Node.js 24 SQLite](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html), [Vite development proxy](https://vite.dev/config/server-options).

### Outbound links (nothing bundled)

「那晚的歌单」 links each song a person typed to QQ Music's public search page (`https://y.qq.com/n/ryqq/search?w=<title>&t=song`, opened in a new tab with `rel="noopener noreferrer"`) and offers to copy the title. The app calls no QQ Music API and embeds, downloads, hosts or supplies none of its audio, lyrics, artwork or data. Opening the link sends the song title to QQ Music as a URL query; the app passes nothing else. The link searches by title and does not identify a recording or a version, and names and links do not imply endorsement by, or permission from, QQ Music or any artist. The demo's fictional song has no link.

## Part 2: history, not used by this app

### Real collaboration catalogue (2026-09-27, MVP 0.4.0)

> **Status: history, not used by this app** (note added 2026-09-30). This catalogue (11 artists in 0.4, 12 from 0.13) belonged to the Music Map half. `web/js/map-catalogue.js` was removed from this repository in `c455279`; nothing described below is in the Music Space build. It stays in Git at `3dd102c` and in musicMapTeam/musicMap.

`web/js/map-catalogue.js` contains a manually curated set of **11 artists, 10 works, and 10 credited vocal collaborations**. It stores factual names, work titles, credited performers, version descriptions, source URLs, check dates, and outbound links. The per-work sources and the exact official video publishers are recorded in [real-catalogue-sources.md](references/research/2026-09-27/real-catalogue-sources.md).

- Primary sources include [JVR Music](https://www.jvrmusic.com.tw/), [Warner Music Taiwan](https://www.warnermusic.com.tw/), and official artist / label channels, including JVR, Cindy Yen, Jam Hsiao, JJ Lin, and Taihe Music. Exact pages, rather than these homepages, support each recorded collaboration in the source register.
- The 10 YouTube links were read through official oEmbed metadata to check titles and publishers on 2026-09-27. This is not evidence that the videos play in every region or account. The app opens external pages and does not embed, download, host, or supply music audio.
- The app does not copy lyrics, music recordings, artist photographs, album covers, or source-page artwork. Descriptions in the catalogue are independently written summaries of credited collaborations. Names and links do not imply artist endorsement, participation in a user-created event, or permission to reuse third-party media.
- The original fictional artist and song IDs remain a separately labelled demonstration catalogue. Real metadata is not presented as MusicBrainz data or as CC0: no MusicBrainz dataset was imported for this release, and the rights in the cited publication pages and media remain with their respective owners.
- The competition's restricted demo-song list was not downloaded or incorporated. Official external links do not expand that list's limited competition-use conditions.

### Hugging Face factual music metadata (MVP 0.7.0)

> **Status: history, not used by this app** (note added 2026-09-30). Music Map's open catalogue. The 120-record extract (`web/assets/data/hf-collaborations.json`) was removed in `c455279` and the download script (`scripts/datasets/download_hf_catalogue.py`) in `1f5a405`, so the two links below no longer resolve in this repository (both remain at `3dd102c`). The Music Space build contains no Hugging Face dataset content, and its `index.html` no longer carries the dataset notice.

Source: [maharshipandya/spotify-tracks-dataset](https://huggingface.co/datasets/maharshipandya/spotify-tracks-dataset/tree/635b034f69257814eff850a5c2b3346fe458134f), revision **635b034f69257814eff850a5c2b3346fe458134f**. The upstream card labels the dataset `bsd`; it supplies no standalone LICENSE or specific BSD variant. This is recorded as stated, without inferring a broader music or recording license.

The full CSV (114,000 rows, 20,118,244 bytes) is downloaded locally under ignored `data/external/spotify-tracks-dataset/`. The distributed [120-record extract](web/assets/data/hf-collaborations.json) contains factual track names, credited artist names, album names and source record identifiers. It contains no audio, lyrics, artwork, listening URL, or detailed production-role claims. See [download record](references/research/2026-09-27/huggingface-download.md) and [reproduction script](scripts/datasets/download_hf_catalogue.py).

The 10 curated vocal collaborations use separate manually checked per-role sources. See [collaboration roles](references/research/2026-09-27/collaboration-roles.md); no HF artist field is used to infer those roles.

### Original interactive record table (MVP 0.12.0)

> **Status: history, not used by this app** (note added 2026-09-30). `web/js/sakura-music.js` was removed in `6f8ff2c`. The courtyard keeps the record shop as inert scenery; the interactive record table, its controls and its links described below are gone.

`web/js/sakura-music.js` adds original procedural furniture, vinyl geometry, connecting threads and printed sleeve textures to the same courtyard scene. Artist names, collaboration titles and links come from the existing catalogues; the abstract sleeves are interface artwork, not official album covers. The projected labels, envelope controls, photo trays and album interface are original project code. No additional third-party assets, fonts or runtime libraries were introduced.

### Open-source implementation research — no source code copied (2026-09-27)

> **Status: history, not used by this app** (note added 2026-09-30). A research record for the 0.4 product and data design: nothing here was copied or bundled, then or now.

The following repositories informed the 0.4 product and data design. They are research references, not bundled dependencies or copied implementation modules. The project independently implements its graph traversal, catalogue, room permissions, and exchange flow; this section does not claim their software licenses cover music, photographs, or other third-party content.

| Reference | License read | Limited design takeaway |
| --- | --- | --- |
| [MusicBrainz Server](https://github.com/metabrainz/musicbrainz-server) | Main code [GPL-2.0-or-later](https://github.com/metabrainz/musicbrainz-server/blob/master/COPYING.md); repository-specific exceptions are documented upstream | Stable artist identity and explicit recording credits; no server code or data dump imported |
| [ListenBrainz Troi](https://github.com/metabrainz/troi-recommendation-playground) | [GPL-2.0](https://github.com/metabrainz/troi-recommendation-playground/blob/main/LICENSE) | Separate candidate selection, filtering, and explanation; no recommender or API client incorporated |
| [Kreolis/musicmap](https://github.com/Kreolis/musicmap) | [MIT](https://github.com/Kreolis/musicmap/blob/main/LICENSE) | Relate a route to a sequence of works; no audio analyser, model weights, or graph implementation copied |
| [Snapdini](https://github.com/paytah232/snapdini) | [AGPL-3.0](https://github.com/paytah232/snapdini/blob/main/LICENSE); fonts have separate upstream notices | Clear event entry and a small set of photograph perspectives; no code, fonts, or assets copied |
| [PicPeak](https://github.com/PicPeak/picpeak) | [MIT](https://github.com/PicPeak/picpeak/blob/main/LICENSE) | Distinguish event access, upload permission, and attribution; no gallery code or assets copied |

Actual README / license / source-file reading scope and adoption decisions are recorded in [music-discovery-review.md](references/research/2026-09-27/music-discovery-review.md) and [social-product-review.md](references/research/2026-09-27/social-product-review.md). If a future change copies substantive code or assets, its actual version, license obligations, and modifications must be recorded separately. The QR library above is an actual bundled dependency and retains its own complete MIT notice.

### Historical 0.2 / 0.3 video and cover authoring tools (2026-09-27)

> **Status: history, not used by this app** (note added 2026-09-30). Authoring tools for earlier Music Map × Music Space deliverables (`delivery/video-source/`, kept as history); never dependencies of the app.

- [HyperFrames](https://github.com/heygen-com/hyperframes), version **0.8.78**, [Apache License 2.0](https://github.com/heygen-com/hyperframes/blob/main/LICENSE). Used through the version-pinned CLI to render `delivery/video-source/index.html` and `cover.html`. The project does not vendor or distribute the HyperFrames CLI package.
- **GSAP 3.14.2**, [Standard “No Charge” GSAP License](https://gsap.com/community/standard-license/), Copyright (c) 2025 Webflow. The composition sources reference the unmodified [versioned CDN script](https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js); HyperFrames inlines it into the temporary rendering page. The official license page was checked on **2026-09-27**; its stated last modification date is **2025-05-30**. Proprietary notices in the library must be retained; this project does not modify the library or redistribute a local copy.

These are video-production tools only, not Music Map / Music Space application runtime dependencies. The delivered MP4 and PNG contain rendered imagery, not either tool's runtime code. The composition, typography, scene arrangement, and animation timing were authored for this project; the incorporated screenshots and ticket image come from the running application and its export function. Tool licenses do not replace the separate visual-asset provenance recorded above.

### Current 0.4 screen recording and cover (2026-09-27)

> **Status: history, not used by this app** (note added 2026-09-30). "Current" in this heading meant current in 0.4. The recording and cover are the Music Map × Music Space 0.4 delivery, not Music Space materials; the tools are not application dependencies.

The current video captures actual application operations using Playwright's native Screencast API through Tabbit, then cuts the WebM clips and adds original Chinese subtitles with FFmpeg 9.0.1. The cover is a browser rendering of the project's original HTML and its actual exported ticket PNG. These authoring tools are not application dependencies; no tool binaries or runtime code are bundled in the MP4 or PNG. Source clips, timestamps, holds, file hashes, and the AI-generated demonstration-photo disclosure are documented in `delivery/recording-source/README.md` and `source-summary.json`. The previous HyperFrames/GSAP composition remains historical source, not the renderer for the current video.
