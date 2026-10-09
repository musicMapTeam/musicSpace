# Music Map (「音乐探索」) 3D: Doodle restyle survey and throw-away prototype (2026-10-07)

Scope: the courtyard and record-shop scene of `web/original-map/**` (the `sakura-*.js` modules). No repository file was edited. The prototype is a copy in
`/tmp/space-map/proto/doodle/web/original-map/` (unchanged reference copy plus a timing hook: `/tmp/space-map/proto/base/`). Full prototype diff against the
repo: `/tmp/space-map/proto/doodle-vs-repo.diff`. Companion UI survey (another agent): `/tmp/space-map/SURVEY-UI.md`. The file split and contract below match
its §4.3.

## 0. Summary

* **`web/avatar/doodle-pass.js` fits as-is.** The map already draws through a "scene → depth+colour target → full-screen passes" pipeline (vendored Sakura
  `Pipeline`). Swapping `pipeline.render()/setSize()` for `createDoodlePass(...).render()/setSize()` and compiling the vendored cel materials through
  `patchDoodleCel` is about 10 lines of wiring. No fork of the pass, no second renderer, and no change to the room's files.
* **Prototype result** (screenshots in §1): the courtyard becomes a pop-up paper diorama on the dotted page (kraft board, yellow-soft yard, mint shop with
  an ink roof and a pink/white awning, pink cherry trees), with ink outlines, light hatching only in real shadows, paper grain and a 7 fps line boil. The
  record table (the first map screen a judge sees: 「音乐探索」 opens `#/explore`) reads as ink-framed sleeves on card paper with ink edges. Glue code:
  `doodle-courtyard.js` 79 lines + `doodle-prints.js` 130 lines, plus 117 changed lines in four `sakura-*.js` files.
* **Frame cost is about the same as now** (production builds, Apple M4, Metal): 0.65–3.2 ms per frame for the doodle version vs 0.8–2.9 ms now (×0.64 to
  ×1.23 by camera stop), even though the doodle version renders 1.5–1.8× more scene pixels. On a software renderer it is 2.6–3.3× **faster** than now,
  because the pass's low-end path drops supersampling. Real phones were not measured.
* **Two changes beyond the colours carry most of the look.** Every camera stop gets its own key-light direction, the shop roof casts shadows only in the
  courtyard view, and the table paper does not receive shadows. Without this the interiors are fully hatched. The far neighbourhood and the night glow
  (halos, beam, fog, sky) go, because the pass has no distance fade for its ink.
* **The 3D and the UI must land together.** Doodle 3D under today's night chrome (dark scrims, cream text, dark glass) looks broken; see
  `3d-CONTACT-nightui.png`. I recommend the same switch the room uses: paper scene when `--ds-paper` is on `:root`.

## 1. Screenshots (all under /tmp/space-map/shots/)

| What | File |
|---|---|
| Desktop 1440×900, current vs doodle (home / explore / records) | `3d-CONTACT-desktop.png` |
| Phone 390×844 @2x, current vs doodle (home / explore / records) | `3d-CONTACT-phone.png` |
| Scene only (UI hidden), current vs doodle | `3d-CONTACT-scene-only.png` |
| Record table with ink: round after one flip+move, free roam from 林俊杰 | `3d-table/SHEET.png`, detail `3d-table/CROP-roam-doodle.png` |
| Doodle 3D under the unchanged night UI (why the two must ship together) | `3d-CONTACT-nightui.png` |
| Variants: yard colour, roof colour, line width, `?renderer=classic` fallback | `3d-yard/SHEET.png`, `3d-roof/SHEET.png`, `3d-line/SHEET.png` + `CROP-home.png`, `3d-fallback-classic-paper/SHEET.png` |
| Single frames: current `3d-base/*.png`, doodle `3d-doodle-final/*.png`, production Pages-tree build `3d-prod/*.png` | |

In the doodle shots the paper UI is a 20-line stand-in (`css/proto-ui-shim.css`, loaded only with `?ui=paper`) that re-points the night variables at
tokens. It is not a UI proposal. Some night-only text, such as the round hand's title, is still unreadable there.

## 2. The current scene (what the 3D builder inherits)

* **Renderer** (`sakura-scene.js`): `WebGLRenderer({antialias:false, stencil:false, powerPreference:'low-power'})` at pixel ratio 1, sRGB output, no
  tone mapping, PCF shadow map 2048² from one light (`sun`, the "moon"), `shadowMap.autoUpdate=false` (updated on stop changes and record-table changes),
  `localClippingEnabled` for the table paper.
* **Camera**: perspective, fov 39–46. Three stops (`home` courtyard, `explore` record table top-down, `records` cabinet) per desktop/portrait, plus a
  "tall" explore stop (`sakura-camera.js`). The stop is fitted into the free room between the paper UI, which `sakura-framing.js` measures (WATCH
  selectors), then centred with `setViewOffset`. `far` follows the camera.
* **Lights**: 8 permanent lights (hemisphere, sun, fill, 3 point, 2 spot). gsap tweens their intensities per stop (`PRESETS`), and a first-visit
  "lamps on" intro runs once.
* **Materials**: vendored Sakura cel (`vendor/sakura/toon.js`: `MeshToonMaterial`, a band ramp, and a violet shadow tint injected by `onBeforeCompile`)
  for the set. `MeshBasicMaterial` for prints, bulbs, distant houses and petals. Additive halo sprites and a stage-beam cone. Colours: 16 palette entries
  plus about 35 hard-coded night values in `sakura-world.js` and `sakura-music.js`.
* **Geometry**: procedural. Instanced canopies, meadow, pebbles and petals; `sakura-batch.js` merges static repeats. 155–239 draw calls per frame.
* **Post** (`vendor/sakura/post.js`): scene → half-float target with depth → ink (depth second difference, faded 23–43 m) → split-tone grade and
  vignette → FXAA → canvas. Budget 2 MP, ratio ≤1.5.
* **Animation**: a 30 fps idle loop (drifting petals, record spin, cat breathing), 60 fps while the camera travels. Nothing runs when hidden, off-screen
  or under reduced motion; changes then request one coalesced frame.
* **Record table** (`sakura-music.js`): a furniture group behind the counter. Sleeves (card stock, a 256² cover canvas, vinyl, grooves, a selection
  halo); face-down backs share one texture; edges are flattened tube dashes revealed by `drawRange`. HTML name and song tags with leader lines and ≥44 px
  touch bands, pan/pinch/wheel zoom 1–2.8, and gsap flip, bump and ceremony animations.
* **Prints** (`sakura-printwork.js`, plus `label()` in the scene): 3 sleeves, the shop marquee 「樱下放映 / RECORDS & LITTLE MOMENTS」, a badge, the poster
  「樱下 ACOUSTIC SESSION」 and wood grain, all lettered in Arial/YaHei.
* **Pre-existing console noise**: 72 warnings per load, `THREE.Material: 'flatShading' is not a property of THREE.MeshToonMaterial` (the vendored toon.js
  on three r186). The live site shows the same. No errors.

## 3. Reusing web/avatar/doodle-pass.js

**API** (read-only reuse; `web/event-room/venue-art.js` re-exports it next to `DOODLE_COLORS`/`DOODLE_KRAFT`):

* `createDoodlePass(renderer, scene, getCamera, {ink, paper, pixelBudget, maxPixelRatio, lowEnd})` returns
  `{uniforms, size, lowEnd, setSize(w,h,{exact}), render(), boil(), dispose()}`, or `null` without WebGL2, highp or 4096 textures.
* `patchDoodleCel(shader, {terminator, key})` turns a `MeshToonMaterial` program into a flat paper colour plus a lit/shade code in alpha. It returns
  false if three's chunk changed.
* Also: `doodleWanted(search, storage)`, `doodleLowEnd`, `doodleSupport`, `DOODLE_CODE`.

**Wiring in the map** (all done in the prototype):

1. Create the pass right after the scene, before any material compiles. Set `scene.background = paper` and `fog = null`. The composite then paints
   paper plus the 24 px dot grid wherever nothing is drawn.
2. Wrap the vendored cel factory (`doodleCelMaterials`): while the pass is on, each toon material's `onBeforeCompile` calls `patchDoodleCel` on the
   pristine shader, otherwise the vendor tint. Cache key `map-doodle-cel`. `vendor/sakura/*` stays untouched.
3. `draw()` calls `doodle.render()`, `resize()` calls `doodle.setSize(w,h)` (the pass owns the pixel ratio), and `dispose()` disposes it. The vendored
   `Pipeline` stays as the fallback.
4. Light with one white key light at intensity 1. Do **not add** the hemisphere, fill, point and spot lights. At intensity 0 they still cost per-pixel
   work, and any lit point light would also flip pixels to the "lit" band. This alone brought the close stops from +30–50% to parity, with
   0.04% pixel difference. `applyLighting` and the night intro are skipped.
5. Boil: step `uniforms.uSeed` about 7 times a second inside the existing 30 fps tick. There is no timer and no extra pass, and `pass.boil()` is not
   needed because the map redraws anyway. Reduced motion means no tick, so the ink stays still. Low-end devices get no boil.
6. Use `doodleWanted(location.search, null)`: honour `?doodle=0` from the address only, and never write the room's session key from the map page.

**Around the pass** (needed for the look; all 3D-side):

* **Unlit means untouched.** Use `MeshBasicMaterial` for anything printed: sleeve faces and backs, signs, posters, bulbs. They get no hatching and their
  patterns are not re-inked. Remove additive sprites and the beam: additive blending corrupts the alpha band code.
* **Zero `emissive`** on cel materials (night blossom and windows). The pass adds emissive to the flat colour.
* **Per-stop key light** (set in `onShot`; shadows update on stop change only):

  | Stop | Key light from | Roof casts shadows |
  |---|---|---|
  | home | (7.5, 12, 2) — today's | yes |
  | explore | (1.2, 12, 2.5) — overhead, so the walls don't hatch the table | no |
  | records | (−4, 8, 9) — from the camera side | no |

  The table sheet and its sleeves get `receiveShadow=false`. The terminator stays at the pass default 0.12.
* **Line width** (`uniforms.uLineWidth`): the pass default of 2.5 CSS px, except 1.8 px in the phone courtyard stop, where the diorama is small.
* **Optional intro**: on the first visit the ink draws itself in (`uLine` 0→1 in 0.7 s), replacing "lamps on". Skipped under reduced motion; tested.
* **Shader-error fallback**: as `three-scene.js` `leaveDoodle()` does — dispose the pass, set `state.active=false`, mark the cel materials for
  recompile, and use the classic `Pipeline` with the paper palette. The prototype does not implement this yet.
* **Classic fallback look** (`?renderer=classic` in the prototype): the paper palette through the vendored cel+ink+grade pipeline. Use neutral lights,
  no vignette, and a warm grey `#d9cfbd` in place of the violet tint. Acceptable (`3d-fallback-classic-paper/SHEET.png`).

## 4. The look (prototype decisions)

* **Composition — "page" variant, recommended:** the yard is a pop-up diorama on the dotted page, standing on a kraft board (`roundBox` 14.25×0.26×11.15).
  * Removed: the 58×48 outer ground, the 5 hills, the 5 neighbour houses, the 2 distant trees, the halos, the beam, sky and fog.
  * Why: the pass inks every depth edge at full strength, so a busy far background turns into scribble.
  * Alternative: `?ground=board` keeps the neighbourhood on a kraft field; it is heavier (`3d-yard/SHEET.png`, last tile).
* **Palette** (night value → token; prototype swap table in `doodle-courtyard.js`):

  | Part | Token |
  |---|---|
  | shop frame, shutters, counter, cabinet, fence posts and rails, poles | `mint` |
  | walls | `paper` |
  | stones, gables, awning white | `card` |
  | awning red, pots, cups | `pink` |
  | planks, trunks, wood grain | `DOODLE_KRAFT` |
  | crowns | `pink-soft` with `pink` accents |
  | windows, bulbs, brass | `yellow` |
  | meadow | `mint` / `mint-soft` |
  | ink parts | `ink` |
  | yard | `yellow-soft` |
  | roof | `ink-2` |

  Record table:

  | Part | Token |
  |---|---|
  | sheet | `card` |
  | skirt | `ink-2` |
  | back stock | `paper-deep` |
  | halos (selected / target / path) | `mint` / `pink` / `orange` |
  | edges (quiet / active / route & visited / highlighted / answer) | `ink-3` / `ink` / `orange` / `pink` / `sky` |

  * The swap table had to be split twice (yard, roof). For the real change, write semantic values at the call sites; keep no new hex values outside
    tokens.
* **Prints** (`doodle-prints.js`): marker posters with layered lettering (colour offset shadow plus ink outline), ink wobble frames, and Doodle
  Logo/Display/Marker faces. They repaint after `document.fonts.load()`.
  * Shop sign: 「唱片店 · RECORDS」.
  * Decorative sleeves: FOLLOW A VOICE / SIDE B / ONE MORE SONG — invented, not attributed to any real artist.
  * Badge: SIDE B. Poster: ACOUSTIC SESSION. Small signs: SIDE B, 33 / 45.
  * Face-up records: the artist's catalogue colour, a card-white pattern and an ink frame, with no names; names stay in the HTML tags.
  * Face-down records: paper-deep, ink hatch, a layered 「?」.
  * 「樱下放映」 and 「NIGHT BLOOM」 are gone.
* **Decisions for the owner or orchestrator** (my pick first):
  1. Ground: page / board.
  2. Yard: yellow-soft / mint-soft / sky-soft.
  3. Roof: ink-2 (echoes the room's ink stage) / pink / mint.
  4. Sign words. The copy plan may override; the 3D builder paints whatever is chosen.

## 5. Measurements

Method: `/tmp/space-map/proto/tools/perf-batch.cjs`.

* The page is opened at a stop with reduced motion on, so the page's own loop is idle. The scene's own `draw()` is called 120× back-to-back (scene plus
  post, exactly what the idle loop runs), with one `readPixels` sync per batch: cost per frame = batch ÷ 120. Median of 5 batches.
* 3 rounds alternate current and doodle. Chrome uses `--use-angle=metal`; the machine is an Apple M4.
* The machine was shared with other agents (load average 14–20); hence the interleaving.
* GPU timer queries came back larger than the wall time on ANGLE-Metal, so they are not used.

**Production builds** (`/tmp/space-map/proto/build-*/musicSpace/`, served by `serve-prefix.mjs` under `/musicSpace/`), ms per frame:

| Viewport · stop | Current (scene image) | Doodle (scene image) | Ratio |
|---|---|---|---|
| phone · home | 0.79 (585×1266) | 0.65 (780×1688) | 0.92 |
| phone · explore | 1.20 | 0.78 | 0.64 |
| phone · records | 0.83 | 0.85 | 1.02 |
| desktop · home | 1.97 (1788×1118) | 2.05 (2160×1350) | 1.07 |
| desktop · explore | 2.93 | 3.23 | 1.10 |
| desktop · records | 2.52 | 3.09 | 1.23 |

* **Software renderer** (SwiftShader; the pass's `lowEnd` path, ratio 1, no boil), ms per frame: phone home 103 → 39, phone explore 118 → 36,
  desktop home 223 → 72, desktop explore 330 → 120.
* **Other**: render targets ≈ 47 MB vs 48 MB (desktop) and 16 vs 18 MB (phone). Draw calls 131–214 vs 155–239. Shader programs 13–17 vs 19–22.
* **Bundle**: the single-file map page goes from 744,668 to 773,162 bytes, +28 KB including the 1 KB UI stand-in.
* **Checks** (`checks.cjs`, `prodcheck.cjs`):
  * Reduced motion gives a still canvas (4 identical hashes); normal motion animates.
  * At 320×568 and 390×844: no horizontal overflow, every scene tag and pin ≥44 px and on-screen, 0 page errors.
  * Production build under `/musicSpace/music-map/`: `../fonts/doodle/fonts.css` loads, `document.fonts.check` is true for Logo, Display and Marker, no
    failed requests, nothing requested outside the prefix.
* **Not measured**: real phones, Safari, the Node build.

## 6. Exclusive file split (same as SURVEY-UI §4.3)

**3D builder owns:**

* `web/original-map/js/sakura-scene.js`, `sakura-world.js`, `sakura-music.js`, `sakura-printwork.js`: the real work.
* `sakura-camera.js` and `sakura-framing.js`: only if framing or the tag-size estimates must follow the UI.
* `sakura-batch.js` and `themes.js`: no change expected. Keep `data-theme='sakura'`; the CSS keys on it.
* `js/vendor/sakura/**`: no change expected. Optional: a documented `flatShading` drop in `toon.js` plus `SOURCE.json`, to remove the 72 warnings.
* **New**: `js/sakura-doodle.js` (the switch, palette, cel wrapper, pass wiring, per-stop key light and line width — from the prototype's
  `doodle-courtyard.js`) and `js/sakura-doodle-prints.js` (from `doodle-prints.js`).
* **New tests**, e.g. `tests/original-map-scene-doodle.test.js`:
  * every colour in `sakura-*.js` resolves to a token value or `DOODLE_KRAFT`;
  * the wrapper patches a real `MeshToonMaterial` program (three runs in Node) with doodle on and with the vendor tint when off;
  * the print painters run against a stub 2D context without fonts, and no 「樱下放映」/NIGHT remains;
  * `?doodle=0` parsing writes no storage.
  * No `music-space-*` literals in the new files: `static-storage-guard` scans `web/original-map/js`.

**Read-only imports**: `web/avatar/doodle-pass.js`, `web/event-room/venue-art.js` (`DOODLE_COLORS`, `DOODLE_KRAFT`), `web/event-room/doodle/tokens.css`
(values mirrored).

**Not the 3D builder's**: `index.html`, `css/**` (including the styles of 3D-created DOM), `app.js`, `home.js`, `map.js`, the other UI/data modules,
and both Vite configs (the 3D work needs no config change).

## 7. Integration points with the UI

1. **Look switch.** At mount, the 3D goes paper plus pass when `--ds-paper` is on `:root` — the UI imports `tokens.css`, the same signal as
   `three-scene.js`. Otherwise it stays night. `?doodle=0` keeps the paper set with the classic renderer. Add
   `#sakura-world[data-render-style="doodle|classic|night"]` for QA and tests.
2. **Night CSS that must go with it** (UI):
   * the top scrim `.spatial-world::after`;
   * the hero glow `.home-hero::before`;
   * the phone 我的发现 scrim `body[data-view=records] .brand::before` — replace it with a paper chip behind the brand, because the new shop sign sits
     right behind the masthead in that shot;
   * `--night-sky` page and `.spatial-world` background → paper, so there is no violet flash before the first frame;
   * `<meta name="theme-color">` `#23214a` → `#f7efdf`;
   * the dark-glass compass, caption and pin styles.
3. **DOM made by 3D, styled by UI** (names stay stable):
   * `canvas.sakura-scene__canvas`, `.world-compass button[data-world-view][aria-pressed]`, `.world-hotspots`, `.world-pin`, `.world-caption>strong`;
   * `.world-music-label(--node)` with `small`, `strong` and `i.world-music-hit`;
   * `.world-music-link>span`;
   * states `is-selected/adjacent/visited/highlighted/current/target/route/muted/active/answer/has-leader`;
   * CSS variables `--record-tone`, `--leader-*`, `--touch-*`, and `data-touch`;
   * host `data-shot`, `data-travelling`, `data-music-zoom` (map.js reads it), and `body[data-spatial-shot]`.
4. **Tag metrics.** Keep painted tags within a few px of today: `labelSize()` estimates 13/14/16 px text and 29–38 px height until a ResizeObserver
   corrects it. Hard shadows ≤3 px.
5. **Framing.** UI keeps the WATCH classes; a new persistent overlay must be a `dialog[open]` or be added to WATCH by the 3D builder (suggest
   `[data-scene-obstacle]`).
6. **Fonts.** The UI links `fonts.css` per build (SURVEY-UI §1.5: Pages `../fonts/doodle/`, Node `../event-room/fonts/doodle/`). The 3D awaits
   `document.fonts.load()` for the faces and texts it paints, then repaints. Never import font files from JS: the single-file build would inline them.
7. **Strings inside 3D files** (3D builder edits, copy per COPY-PLAN style):
   * The canvas aria-label still describes the night (「夜晚的樱下音乐小院，串灯亮着…」); proposal from SURVEY-UI: 「纸做的音乐小院，唱片店开着门。点「唱片店」标记或下方导航前往。」
   * Compass, caption and pin labels stay. Prints are as in §4.
8. **「唱片店」 pin.** Its anchor `(0, 2.6, 1)` now covers the new shop sign. Move it to the counter front `(0, 1.9, 1.6)` or above the ridge
   `(0, 4.3, −1.5)`, and check that `placeLabel` still places it on phone.
9. **Unchanged.** The `api.spatial.publish / setMusic / musicControl` contract, `onAction` and `onShot`, toast placement around tags, the WebGL-off 2D
   table and `body.spatial-fallback` (UI).

## 8. Suggested build order for the 3D builder

1. Port `doodle-courtyard.js` into `sakura-doodle.js` and wire it (§3, items 1–6), including the shader-error fallback.
2. Write the semantic palette in `sakura-world.js` and `sakura-music.js`; apply the page variant and the board.
3. Make sleeve faces and backs unlit and stop shadows on the table sheet and sleeves.
4. Add the prints and the fonts repaint.
5. Add the per-stop key light, roof shadows and line width; optionally the ink intro.
6. Fix the pin anchor and the aria-label.
7. Add the tests.
8. Run joint QA with the UI builder: phone, desktop and 320 px; every stop and table state (round, flip, ceremony, roam, setlist); reduced motion;
   WebGL off; `?doodle=0`; Pages tree at `/musicSpace/` and `/musicSpace/preview/`; a Node build smoke check.

**Risks:**

* Weaker phone GPUs: the doodle version renders about 1.8× the pixels on 2× phones. If real phones stutter, pass `pixelBudget: 1.0e6` to
  `createDoodlePass` on narrow screens.
* Any new camera stop needs its own key-light direction, or it hatches.
* The pass is shared with the room. Use only its exported API.

## 9. Reproduce

```
# dev servers (prototype copies only; caches under /tmp)
PROTO=/tmp/space-map/proto/base   PORT=5291 node_modules/.bin/vite --config /tmp/space-map/proto/tools/vite.proto.mjs   # current
PROTO=/tmp/space-map/proto/doodle PORT=5292 node_modules/.bin/vite --config /tmp/space-map/proto/tools/vite.proto.mjs   # doodle (?ui=paper, ?doodle=0, ?renderer=classic, ?ground=board, ?yard=, ?roof=, ?line=, ?lights=all)
# production builds of the copies + Pages-like serving
(cd /tmp/space-map/proto/<v> && vite build --config vite.proto-build.mjs); node scripts/pages/serve-prefix.mjs /tmp/space-map/proto/build-<v>/musicSpace /musicSpace/ <port>
# shots / timing / checks
node /tmp/space-map/proto/tools/shoot.cjs <url> <label> home,explore,records "?ui=paper"
node /tmp/space-map/proto/tools/perf-batch.cjs 120          # ROUNDS=, TARGETS='{"name":"url",...}', VIEWS=, --soft
node /tmp/space-map/proto/tools/checks.cjs ; node /tmp/space-map/proto/tools/prodcheck.cjs ; node /tmp/space-map/proto/tools/table.cjs
```

Logs: `/tmp/space-map/proto/tools/perf-batch-prod2.log` (table above), `perf-soft-prod.log`, `perf-lights.log`, `checks.log`.
