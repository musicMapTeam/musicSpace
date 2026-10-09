# Music Map (「音乐探索」) — UI survey for the Doodle restyle and copy cleanup

Survey only (no repository edits). Repo `/Users/alakazan/workplace/tme/musicSpace`, branch `feat/complete-product-copy` @ `8fa52f0` (clean at survey start; the parallel copy workflow has since edited web/event-room/** and others —
nothing under `web/original-map/` or the two map configs changed).
Baseline evidence: production Pages build `STATIC_OUT=/tmp/space-map/base/dist-pages npm run build:pages` (map page 744,469 B), served by
`scripts/pages/serve-prefix.mjs … /musicSpace/ 4791`, walked with real GPU Chrome. Screenshots: `/tmp/space-map/shots/base/` (phone + desktop,
40 states each, plus `nogl-*` WebGL-off, `w320-*` 320×640, `*-x-*` friend link / arrival / credit sources). Text dumps: `/tmp/space-map/phone-texts.txt`,
`shots/base/walk.json`, `shots/base/edge.json`. String inventory (AST-extracted, every CJK literal with file:line): `/tmp/space-map/strings-js.tsv`.
Tools: `/tmp/space-map/tools/{strings.mjs,walk.cjs,edge.cjs,arrive.cjs,vite.map-dev.config.mjs}`.

Parallel copy plan: `/tmp/space-copy/COPY-PLAN.md` (appeared 21:47) is applied here: its STYLE rules (CJK/Latin spacing; paragraphs, empty states and
About end with 。, buttons/labels/toasts do not; hints ≤16 characters; errors = what happened + what to do), its action words (重新载入 = reload the page,
刷新 = re-read data, 重试 = retry an operation, 再想想 = back out), and its banned list for UI copy (示例, 虚构, 模拟, 演示, 只存在这个浏览器, 不代表…, 核对,
未核实, 真实 as a claim, …). It renames the room's 「Music Map · 沿音乐探索 ↗」 to 「音乐探索 ↗」 and the entry aria-label to 「音乐探索」, writes the room's offline
line as 「离线了，联网后再打开音乐探索。」, and lists `web/original-map` as out of its scope (its §Risks 9).

---------------------------------------------------------------------------------------------------------------------------------------------------

## 0. Summary

* **Judge path.** The event room's header button 「音乐探索 ↗」 opens `siteUrl('music-map/') + '#/explore'` (`web/event-room/original-map-entry.js:12`), so the
  first map screen a judge sees is the **record shop with a 寻声 round already dealt** (费玉清 → 邓紫棋), not the courtyard. Restyle priority:
  record shop round (phone+desktop) → papers it opens (edge/来源, setlist, credits) → courtyard home → 我的发现 → open catalogue / about / edge states.
* **No test asserts any web/original-map UI string.** Map-related checks are build/structure only (§2.6). Copy can change freely; add our own tests.
* **Fictional content** (`情景示例 · 虚构`) is a separate invented catalogue (9 invented singers, 27 songs, 12 duets, 8 tags) that never mixes with real
  artists and is **unreachable in Music Space** (new storage key, every new session is real). Recommendation: delete the fictional catalogue and every
  UI branch that labels it (§3), plus a defensive load-time filter. Nothing involving real artists is fictional.
* **Fonts.** Both map builds are single-file (`vite-plugin-singlefile`, `assetsInlineLimit: 10 MB`): importing `fonts.css` through JS/CSS would inline
  ~2.4 MB of woff2 as base64. Load it with a `<link>` injected at build time per config: Pages `../fonts/doodle/`, Node `../event-room/fonts/doodle/` (§1.5).
* **CSS** is a 21-file override cascade (~2,400 rules, ~1,000 hex colours) built around a *night* scene (`body:not(.spatial-fallback)` = cream text on
  night sky + dark glass; `body.spatial-fallback` = light paper). Doodle has no night: neutralise the night branch and add one Doodle layer imported last
  (§1.3, §4.1). The 3D must switch to paper **in the same change set** as the UI, or ink-on-paper UI will sit on a dark night scene.
* **Per-link citations** (`edge.sourceLabel/sourceUrl/evidence/checkedAt`, `song.creditSources[]` + per-role `sourceId`, QQ link credit / reason) move into one
  reusable 「来源」 disclosure (§2.4). The tiny per-role superscript source links (6×15 px) and the inline citation links disappear from the main UI.
* **Exclusive split** (§4.3): 3D builder = `sakura-*.js`, `themes.js`, `vendor/sakura/**` (+ new 3D files); UI builder = everything else in
  `web/original-map/**` (index.html, all CSS incl. styles for 3D-created overlays, app/home/map/open-catalogue/share-card/space-bridge/icons/motion/
  map-data/…), the two map Vite configs, new UI tests. Data files are read-only for both.

---------------------------------------------------------------------------------------------------------------------------------------------------

## 1. Structure

### 1.1 Routes, screens and states

Routes are hash views in `app.js` (`views = ['home','explore','records']`; legacy `#/space`, `#/live` → home). `render()` mounts one view into
`#main-content`; one persistent scene (`#sakura-world`) changes camera shot per view. Panels inside a view are `<dialog class="map-dialog map-dialog--{panel}">`
drawn by `map.js panelHTML()` from `state.map.view.panel`.

| State | How reached | Rendered by | Styled mainly by | Shots (`shots/base/`) |
|---|---|---|---|---|
| Shell: masthead (brand, 关于), return bar, bottom nav (phone), about dialog, storage warning, toast | always | `app.js shell()` 253–312; `space-bridge.js` adds return bar / 「歌曲」 / draft buttons / offline status | compact, app-studio, night-shell, courtyard-ui, space-bridge, base | all |
| Scene overlays: compass (desktop nav), caption, 「唱片店」 pin, record-table name tags + song tags, 2D fallback marker | 3D | `sakura-scene.js` 54–66, 252–259; `sakura-music.js` 154–156, 240–241 | spatial-world, night-shell, courtyard-ui, map-spatial (tags), theme-sakura (fallback) | desktop-01/06/20 |
| **小院 home** (courtyard cover: hero, singer search + picks, 寻声 slip, foot links) | `#/home`, 「小院」 | `home.js mountHome()` | night-shell (cover/hero placement), home-map, courtyard-ui | *-01..03, *-38 |
| **唱片店 · 寻声 round** (question slip, 提示/换一组/目录, hint note, stamp, friend note, hand of cards, route bar) | `#/explore` (judge entry), 「两位歌手之间…」, 「开一局寻声」, friend link `?from=&to=#/explore` | `map.js roundHTML() 547`, `roundHandHTML() 490`, `roundCardHTML() 460`, `hintNoteHTML() 390`, `stampHTML() 411`, `friendNoteHTML() 538`, `menuHTML() 454`, `zoomToolsHTML() 450` | map-round (head/hand/setlist), map-spatial (menu, zoom, layout), listen | *-06..09, *-12, *-x-friend-note |
| Round closed bar (抵达/揭晓, 再来一局, 连线歌单, 完整图鉴, 出题给朋友, 保存战绩卡) | after arrive / reveal | `roundClosedBarHTML() 524` | map-round | *-19 |
| Ceremony (reveal/arrive animation, 「跳过」) | arrive / 揭晓答案 | `roundHTML` + `sakura-music` ceremony | map-round | *-14, *-x-arrive-ceremony |
| **完整图鉴 atlas / free roam** (title slip, 开一局寻声/找音乐人/目录, dock: roam bar, selection, 「N 条连接」 list) | 「完整图鉴」, home pick, search result, chat song (`music-space-map-artist` event) | `atlasHTML() 626`, `roamBarHTML() 605` | map-spatial (atlas, dock, roam bar), map-studio | *-20, *-21, *-28, *-29, *-33 |
| Papers (dialogs): `edge` 共同演唱, `credits` 作品署名, `artist` 作品, `relations` 连接来源, `search` 找音乐人, `challenge` 开一局寻声 / 换个起点再出一题, `share` 出题给朋友 (fallback link), `reveal` 放弃并揭晓, `recap` (setlist 连线歌单 / roam 本次发现·探索回顾 / round progress / legacy recap), `history` 我的发现, `delete`, `reset`, `replace` | buttons in shop / records | `panelHTML() 880–971` + `setlistHTML() 800`, `roamRecapHTML() 743`, `roundProgressHTML() 788`, `recapHTML() 772` (legacy), `creditsHTML() 292`, `tracksHTML() 310`, `timelineHTML() 704`, `roamRouteHTML() 715`, `listenHTML() 259`, `evidenceHTML() 278`, `undoHTML() 343` | map (base), map-round (type floors, setlist, recap), scene-layout (placement), night-shell (paper), map-credits, listen | *-10/11, *-13, *-15..17, *-22..27, *-30..32, *-36, *-37, *-x-arrive-setlist, *-x-credits-sources-open |
| **我的发现** (tabs 探索记录 / 留下的歌; record rows; saved songs) | `#/records`, 「我的发现」 | `app.js mountRecords() 315`, `map.js recordsHTML() 973 / recordRowHTML() 860`, `open-catalogue.js mountSavedMusic() 108` | map (records), product-finish, night-shell (collection sheet, touch floor), scene-layout, open-catalogue | *-34..37 |
| 开放曲库 dialog | 「开放曲库」 anywhere (`[data-open-catalogue]`) | `open-catalogue.js mountOpenCatalogue() 53` | open-catalogue | *-05 |
| 关于 dialog | masthead (i) | `app.js shell()` 269–273 | courtyard-ui, compact, app-studio, night-shell | *-04 |
| Share-card preview (寻声战绩卡 / 发现卡片 PNG) | 「保存战绩卡」, 「保存发现卡片」 | `share-card.js presentPng() 578` + canvas builders 386 / 459 | share-card | *-18, *-x-arrive-card |
| Storage failed / cross-tab conflict | write failure / another tab writes | `app.js updateChrome() 227–236`, `render() 336–341` | base, app-studio | *-40 |
| Offline return attempt | 「← 返回现场」 while offline | `space-bridge.js online()` 13 | space-bridge | *-39 |
| WebGL off (2D table, light paper page) | no WebGL | `sakura-scene.js` 37–46 adds `body.spatial-fallback`; `map.js stageHTML() 420` + `positionNodes` | map-spatial §WebGL off, map-round §2D table, night-shell §WebGL off | nogl-* |
| Empty states | no session / no records / no saved songs / search miss | `mapHTML() 690`, `recordsHTML()`, `mountSavedMusic()`, `searchResultsHTML() 694`, home note | base, map, open-catalogue | *-02, *-35 |

Unreachable in Music Space (dead branches): fictional catalogue (§3), legacy non-fog 「合作挑战」 sessions (`recapHTML`, `map-route-bar`, 「挑战回顾/继续挑战/返回图鉴/挑战结果/回顾路线」) — `startRound` always creates fogged rounds and no Space-era save can contain the older types.

### 1.2 Who renders what (DOM ownership)

* `app.js` builds the shell once: `.app-masthead.app-studio-shell` (`.brand`, `.primary-nav`, `.masthead-tools` with `#demo-help`), `#sakura-world`,
  `.app-body` (`#storage-warning`, `#main-content`), `.mobile-nav`, `#about-dialog`. Toast `#toast` is in `index.html`.
* `space-bridge.js` (second module script) prepends `.space-map-return` (「← 返回现场」, 「原版三维唱片桌」 note, optional 「歌曲」 context button) into
  `.masthead-tools`, adds `.space-map-status`, and decorates every real track's 留下 button with `.space-map-draft` (「带回聊天草稿」「作为接龙起点」) when
  the map was opened with a chat/relay scope. It imports `runtime-preview/src/map-catalogue.js` and `web/shared/site-base.js` (outside the root).
* `themes.js` → `sakura-scene.js` creates in `#sakura-world`: canvas, `.world-compass` (小院/唱片店/我的发现, desktop nav), `.world-hotspots`
  (`.world-pin` 「唱片店」, plus `sakura-music.js` name tags `.world-music-label--node` and song tags `.world-music-link`), `.world-caption`;
  on WebGL failure `.sakura-scene__fallback` and `body.spatial-fallback`.
* Body/state hooks used by CSS: `body[data-view]`, `body[data-spatial-section]` (app.js), `body[data-spatial-shot]`, `[data-spatial-travelling]` (app.js
  onShot from 3D), host `[data-shot]`, `[data-travelling]`, `[data-music-zoom]` (3D), `html[data-theme="sakura"]` (index.html + themes.js).
* `sakura-framing.js` (3D) measures UI papers to frame the camera: `WATCH = .app-masthead, .brand, .masthead-tools, .mobile-nav, .world-compass,
  .world-caption, .map-studio-head, .map-studio-title, .map-studio-tools, .map-stage-top, .map-round-slip, .map-round-tools, .map-round-note,
  .map-round-hand, .map-studio-dock, .map-undo, .home-paper, .home-hero, .main-content, dialog[open]`. An element counts as an obstacle when it has a
  background (or is in the INK list). Name-tag sizes are estimated from 13/14/16 px fonts until ResizeObserver reports the painted box.

### 1.3 CSS architecture

Import order (later wins at equal specificity) — `app.js` 1–21, then `space-bridge.css` from the second module:

| # | File | Lines/rules | Role | Doodle action |
|---|---|---|---|---|
| 1 | base.css | 161/130 | legacy dark tokens (`--bg #0C1016`, `--font-display` = system sans, `--font-mono`), toast, storage warning, empty state, **global reduced-motion kill switch** (l.160) | bridge vars; keep RM switch |
| 2 | map.css | 589/523 | legacy record-shop base: dialogs, tracks, records, search, timeline (34 dead classes) | restyle via layer; prune dead |
| 3 | themes.css | 69/54 | light paper tokens + shared controls (`.button`, `--button-fill`) | bridge |
| 4 | theme-sakura.css | 33/15 | sakura palette, `.sakura-scene__fallback` | replace palette |
| 5 | overlayscrollbars.css (npm) | — | scrollbar base | keep |
| 6 | compact.css | 53/46 | masthead/nav sizes, about sizes, `os-theme-music` scrollbar | restyle scrollbar |
| 7 | app-studio.css | 117/102 | studio panels, dialog radius/shadow, toast, storage warning placement | override |
| 8 | map-studio.css | 143/107 | studio vars `--map-*`, older atlas layout (17 dead classes) | bridge |
| 9 | map-credits.css | 87/42 | credits table, `details.map-credits` | restyle; superscripts go (§2.4) |
| 10 | spatial-world.css | 64/55 | `#sakura-world` fixed full-bleed, compass, pins, caption | restyle (UI owns these styles) |
| 11 | open-catalogue.css | 49/47 | 开放曲库 + saved-music rows | restyle |
| 12 | product-finish.css | 15/13 | 我的发现 heading/tabs | restyle |
| 13 | courtyard-ui.css | 83/69 | sakura token overrides, about dialog, courtyard surfaces | bridge/override |
| 14 | spatial-objects.css | 78/39 | `--object-*` paper objects | bridge |
| 15 | map-spatial.css | 403/291 | scene name tags, 目录 menu, zoom, atlas dock, roam bar, scene layout, **WebGL-off 2D table**, phone | restyle (largest surface after map-round) |
| 16 | scene-layout.css | 28/15 | measured placement of pages/dialogs beside the scene | keep geometry |
| 17 | map-round.css | 695/488 | 寻声: slip, tools, hint tape, hand crate + cards (flip keyframes), toast in shop, 2D round, dialog type floors, roam recap, setlist ticket, friend note, phone, no-WebGL | restyle (judge-first) |
| 18 | home-map.css | 67/33 | home search, picks, 寻声 slip | restyle |
| 19 | night-shell.css | 300/153 | **night** tokens (`--night-*`, `--paper-lit`, `--font-serif` Songti), scrims, cream text glow, dark-glass tools/compass/nav, lamplight paper shadows, front-door cover placement, phone/tablet, WebGL-off branch | retire colour/glass/scrim rules; keep placement |
| 20 | share-card.css | 58/22 | PNG preview dialog | restyle |
| 21 | listen.css | 62/31 | 去 QQ 音乐听 link / none note | restyle |
| 22 | space-bridge.css (minified) | 5/24 | return bar, draft buttons, offline status | restyle in place (it loads after everything) |

Selector conventions: `html[data-theme='sakura'] …` (≈480 rules), `html[data-theme] …` (≈200), and the night/paper fork
`body:not(.spatial-fallback)` vs `body.spatial-fallback` (≈110). Night rules are typically (0,3,2)+component, so a Doodle layer must match that
specificity (event-room rule: "geometry at the SAME specificity as the legacy rule, later file wins") or use a look attribute
(`html[data-look='doodle'][data-theme] body …` = (0,2,2) before the component).
Most-used custom properties: `--font-display` (67 uses; currently system sans), `--muted` 54, `--line` 41, `--mint` 40, `--text` 35, `--map-sea` 26,
`--node-tone` 23 (per-artist colour from data), `--map-*`, `--round-*`, `--paper-*`, `--night-*`, `--object-*`, `--studio-*`. A token bridge
(legacy var → `--ds-*`) recolours a large share in one place; the rest are literal hex values that need component overrides.
Dead CSS: ~70 classes no JS emits (e.g. `.map-heading*`, `.map-neighbor*`, `.map-artist-panel*`, `.map-challenge-banner*`, `.map-foot`,
`.map-stage-caption`, `.map-demo-label`, `.map-catalogue__switch`, `.map-experience--compact`, `.section-heading`, `.brand-light`). Safe to delete; it removes
override fights. (False positives to keep: `map-dialog--{panel}`, `is-{near|far|even}`, `map-experience--{presentation}` are built dynamically.)
Motion: CSS keyframes `map-stamp`, `map-card-turn`, `map-ink`, `map-setlist-in`, `map-arrive`, `map-type-arrive`, `map-focus-arrive`, `home-line-*`, `home-rise`;
GSAP in `motion.js` (dialog pop, page fade) checks `prefers-reduced-motion`; base.css zeroes all CSS animation/transition under reduced motion.
Icons: `icons.js` = Phosphor regular (filled paths, MIT); the event room's Doodle icons are 2.2 px round-cap strokes with `filter:url(#ds-wobble)`.

### 1.4 Build and serve

| Build | Command / config | Output | Served at | Notes |
|---|---|---|---|---|
| Pages (judged) | `npm run build:pages` → `scripts/pages/build.mjs` runs `vite.static-map.config.js` second | `$STATIC_OUT/music-map/index.html` (single file, 744 KB) + `$STATIC_OUT/shared/three-0.186.1/` | `/musicSpace/music-map/` and `/musicSpace/preview/music-map/` (GitHub Pages; locally `serve-prefix.mjs <dir> /musicSpace/ <port>`) | root `web/original-map`, `base:'./'`; three is external `../shared/three-0.186.1/`; `map-notices` appends 6 licence comments; `staticHtmlPlugin({page:'map'})` moves the module script to the end of body, writes metas `space-site-root=../`, `space-event-room=../`, `space-build`, modulepreload hints, noscript/nomodule copy ("…Music Map…", owned by the parallel workflow). Event room is the site root; fonts at `<root>/fonts/doodle/` |
| Node | `npm run build:map` (`vite.map.config.js`; part of `build:all` — do not run) | `dist/music-map/index.html` | Node server `server/index.js serveStatic` at `/music-map/`; event room at `/event-room/`, its fonts at `/event-room/fonts/doodle/` | three at `/shared/three-0.186.1/`; no meta hints, so `siteRoot()` = `/`, `eventRoomUrl()` = `/event-room/` |
| Dev (shared) | `http://127.0.0.1:5190/` | — | `/music-map/` is served from a **built copy** (repo `dist-pages/` unless `DOODLE_DIST` was set; the repo copy is from `7cbe4d3`), no HMR | do not stop |
| Dev (map HMR) | `npx vite --config /tmp/space-map/tools/vite.map-dev.config.mjs --port <free>` (verified on 5197, then stopped) | — | `http://127.0.0.1:<port>/` (`#/explore` etc.) | extends `vite.map.config.js`, `publicDir` = `web/event-room/public` so `/fonts/doodle/fonts.css` resolves, dev-only `<link>` injection; three resolves from node_modules in dev |

Checks on the built map page (`scripts/pages/verify-tree.mjs checkHtml(…,'map')`, run by `scripts/test/static-build.test.mjs`): no root-absolute `/shared/`
or `location.assign('/music-map…')`/`'/event-room/'` navigation; metas `space-site-root ../`, `space-event-room ../`, `space-build`; modulepreload
`../shared/three-0.186.1/three.module.js|three.core.js`; module script after `<body>` and inline; the six licence comments (three, sakura-crossing, gsap,
overlayscrollbars, phosphor, qrcode-generator); `<noscript>` + `nomodule`. A static classic `<script>` in the map HTML makes `transformStaticHtml` throw.

### 1.5 Fonts: how they can load in each build

Facts: `web/event-room/public/fonts/doodle/fonts.css` uses page-relative `url("./display-0.woff2")`, so it works wherever it is served. It is copied by
the event-room builds to `<pages root>/fonts/doodle/` and `dist/event-room/fonts/doodle/`. The map builds inline every imported asset (10 MB limit) —
**never `import` fonts.css from JS/CSS** (≈2.4 MB of base64 in the page). `tokens.css`/`type.css`/`kit.css` contain no font files and can be imported
(`@import '../../../event-room/doodle/tokens.css'` from `css/doodle/*.css`; Vite resolves outside-root CSS imports; dev `fs.allow` is the repo root).

Options:
1. **Build-time `<link>` per config (recommended).** A tiny `transformIndexHtml` (`order:'post'`, `apply:'build'`) in each map config injects
   `<link rel="preload" as="font" type="font/woff2" crossorigin href="{F}marker-0.woff2">`, same for `display-0`, and `<link rel="stylesheet" href="{F}fonts.css">`
   with `F = '../fonts/doodle/'` in `vite.static-map.config.js` (works for `/musicSpace/` and `/musicSpace/preview/`, and for the 5190 copy) and
   `F = '../event-room/fonts/doodle/'` in `vite.map.config.js` (Node). Starts downloading during HTML parse, reuses the room's cached slices, survives
   singlefile and `transformStaticHtml` (they only touch bundle assets / three hints), passes verify-tree. Re-verify both outputs after the change.
2. Runtime: `new URL('fonts/doodle/fonts.css', eventRoomUrl()).href` appended to `<head>` from `app.js` (site-base derived; works in all builds). Downside:
   in the Pages page it starts only after the ~700 KB inline module is parsed (FOUT). Acceptable as a fallback if option 1 hits a snag.
3. `<link … vite-ignore>` in `index.html` (Vite 8 supports the attribute) — one path cannot serve both Pages and Node, so not alone.

Coverage/cost: all 910 CJK characters in `web/original-map/js` are in Doodle Marker and Hand; Doodle Display lacks 9 (`傑詠溫吳別玓寗彣暐` — aliases and
credit names) and 20 of the open-catalogue's traditional characters → use Display only for titles/simplified artist names, Marker/Hand for credits,
aliases and catalogue rows. The map's first screens need slices 0+1 of Display/Marker/Hand (≈537 KB total, ≈250 KB more than the room's first screen
already cached). Doodle Note only has `NOTE_PHRASES` characters (usable here: 「你在这里」「好近」「好远」「再来一首」「看这里」「留下来」); new phrases need the font
script re-run (outside our scope). New map copy with characters never used in `web/` falls back to system fonts until the font script is re-run.

---------------------------------------------------------------------------------------------------------------------------------------------------

## 2. User-visible strings

Codes: **K** keep · **S** shorten (proposal given) · **R** remove · **A** move to 关于 / 数据来源 · **F** fold into the 「来源」 disclosure · **X** removed with
the fictional catalogue (§3) · **L** legacy branch, unreachable (remove with its code or leave). aria/title strings are listed where they change.
Numbers in `{}` are dynamic. Lines are `web/original-map/js/<file>:<line>` unless stated.

### 2.1 Glossary and tone (proposal; align with COPY-PLAN.md)

* Page name in UI: **「音乐探索」** (same as the room's button). Visible brand: Doodle logo 「MUSIC SPACE」 + sticker 「音乐探索」. 「Music Map」 leaves the visible UI;
  it appears once in 关于 → 数据来源 as the origin. Drop the night-theme subtitle 「樱下放映 · 夜场唱片店」 everywhere in UI copy (the 3D sign is the 3D builder's).
* Keep: 小院 · 唱片店 · 我的发现 · 寻声 · 完整图鉴 · 连线歌单 · 开放曲库 · 留下 / 留下的歌 · 翻开 / 前往 / 退一步 · 提示 · 返回现场. New: 「来源」 (per song/duet),
  「数据来源」 (About section), 「关于音乐探索」.
* Drop the catalogue label 「真实合作精选」 from eyebrows/meta (one catalogue left). Keep 「本专题」 only where it qualifies a factual 最短/还隔/最少 claim.
* Tone (COPY-PLAN STYLE): short, neutral; storage errors read 「…没存上，浏览器存储不可用」; page reload = 「重新载入」, retry = 「重试」; no Web Locks/HTTPS/备份
  explanations in the main UI; no 真实/核对/不代表/只存在这个浏览器 in UI copy (citation dates read 「访问于 {date}」).
* `↗` only for links that leave the site (QQ 音乐, sources). Internal buttons that open a paper (作品, 回顾, 开放曲库, 去探索, search results) lose it.

### 2.2 Inventory by screen

**A. Page and shell** (`index.html`, `app.js`, `space-bridge.js`)

| Where | Current | Code | Proposal |
|---|---|---|---|
| index.html:5 | theme-color `#23214a` | S | `#f7efdf` (paper) |
| index.html:6 | meta description 「Music Map：从喜欢，走向未知。…每一条合唱关系都附有来源。」 | S | 「Music Space · 音乐探索：从一位喜欢的歌手出发，沿着合唱找到下一位、下一首。」 |
| index.html:9, app.js:237–239 | title 「Music Map · 从喜欢，走向未知 / 唱片店 / 我的发现」 | S | 「Music Space · 音乐探索」 / 「Music Space · 唱片店」 / 「Music Space · 我的发现」 |
| index.html:12 | 跳到内容 | K | |
| app.js:256 | brand aria 「Music Map · 樱下放映 · 夜场唱片店，回到小院」 | S | 「音乐探索，回到小院」 |
| app.js:258 | wordmark 「Music Map」 + small 「樱下放映 · 夜场唱片店」 | S | logo 「MUSIC SPACE」 (aria-hidden) + sticker 「音乐探索」; subtitle R |
| app.js:244–246 | nav 小院 / 唱片店 / 我的发现; aria 主要导航 / 手机导航 | K | |
| app.js:261 | aria 「关于 Music Map」 | S | 「关于音乐探索」 |
| space-bridge.js:10 | 「← 返回现场」 | K | (hand-drawn arrow icon) |
| space-bridge.js:11 | 「原版三维唱片桌」 | R | meta label |
| space-bridge.js:16 | button 「歌曲」, title 「从《X》的作者继续探索」 | S | button 「《X》」(or 「这首歌」); aria/title 「从《X》的演唱者继续探索」 (it goes to `song.artists[0]`, a singer, not an author) |
| space-bridge.js:26 | 「带回聊天草稿」「作为接龙起点」 | K | |
| space-bridge.js:13 | 「当前离线，请恢复连接后重试返回。探索记录与聊天草稿仍保留。」 | S | 「离线了，联网后再返回现场。」 (same pattern as the room's entry line) |
| space-bridge.js:28 | 「无法保存草稿，请保留当前页面后重试。」 | S | 「草稿没存上，请再试一次。」 |

**B. 小院 home** (`home.js`)

| Where | Current | Code | Proposal |
|---|---|---|---|
| 54 | kicker 「音乐探索 · 夜场唱片店」 | R | duplicate of the masthead sticker |
| 55 | h1 「从喜欢，」「走向未知。」 | K | the screen's layered title (`.ds-title`, 「走向未知」 `.ds-key`/`.ds-hl`) |
| 56 | 「从一位喜欢的歌手出发，沿着真实的合唱，翻开下一位、找到下一首。」 | S | 「从一位喜欢的歌手出发，沿着合唱找到下一首。」 (no 真实 claim) |
| 57 | steps 「选一位歌手 / 沿合唱走到下一位 / 把路上的歌留下」 (aria 怎么探索) | R | instructional |
| 61–62 | 「今天，从谁开始？」, placeholder 「如 周杰伦、JJ Lin」 | K | |
| 93–94 | aria 「匹配的歌手」「可以从这几位出发」「从X出发」 | K | |
| 95 | 「本专题还没收录「X」，先从这几位出发试试。」 | S | 「这里还没有「X」，先从这几位开始吧。」 |
| 46–47 | 「继续寻声」「两位歌手之间，隔着几首歌？」; meta 「{pair} · 已走 N 步」「朋友出的题 · {pair}」「寻声 · {pair}」「寻声 · 在唱片店开一局」 | K | |
| 45 | prefix 「情景示例 · 」 | X | |
| 72–74 | 「我的发现 N」「留下的歌 N」「开放曲库 ↗」 | K | drop ↗ (opens a dialog) |

**C. 唱片店 · 寻声 round** (`map.js`)

| Where | Current | Code | Proposal |
|---|---|---|---|
| 563 | eyebrow 「寻声 · 真实合作精选 / 朋友出的题 / 情景示例 · 虚构 { · 已抵达| · 已揭晓}」 | S/X | 「寻声」, 「寻声 · 朋友出的题」, 「寻声 · 已抵达」, 「寻声 · 已揭晓」 |
| 577/583 | 「A → B，隔着几首歌？」 | K | layered title of the screen |
| 566–568 | 「第 N 步」「认识 a/b」「翻开 c/d」「还隔 N 首」; closed 「N 步抵达」「你停在X（N 步）」「本专题最短 N 首」 | K | numbers in Digits |
| 414 | stamp 近 更近了 / 远 绕远了 / 平 一样远 | K | sticker stamp |
| 36/570 | 「提示 · 还隔几首」「提示 · 往哪翻」「揭晓答案」 (+ aria 提示第一级…) | K | |
| 587, 455 | 「换一组」「目录」 | K | |
| 572 | menu 寻声: 「自选起点和终点」「把这道题发给朋友 <small>不带答案</small>」「放弃并揭晓」「连线歌单」 | S | drop the small 「不带答案」 (kept in aria) |
| 573 | 图谱: 「完整图鉴 <small>会显示全部合作</small>」 | S | 「完整图鉴 · 全部摊开」 (keep a spoiler cue) |
| 574–575 | 资料: 开放曲库 · 我的发现; 视野: − 全图 + (aria 唱片桌视野 / 缩小唱片桌 / 显示整张唱片桌 / 放大唱片桌) | K | |
| 402–404 | hint ① long 「从X出发，在本专题收录的合作里最少还隔 N 首；你面前 a 首里有 b 首会让你更近。」, ② 「退一步回到X：从那里走更近，这一步也会撤销。」「试试《T》：它在一条最短的路上。桌上铅笔线标出了方向。」「…沿它「前往」。」 | R | keep only the short forms below (the toast already says it) |
| 406–407 | short 「还隔 N 首 · 面前 a 首里 b 首更近」「退一步回到X更近」「试试《T》· 铅笔线指了方向」「试试《T》· 沿它前往」 | K | |
| 541–542 | friend note 「朋友出的题：A → B，隔着几首歌？」 + rule `ROUND_RULE` 「翻开所在歌手手边的合唱，沿翻开的合唱前往；翻开和提示不计步。」 | S | title K; rule → 「先翻开，再沿它前往；翻开和提示不算步数。」 |
| 543 | aria 「收起朋友的题签」 | K | |
| 506 | hand meta 「乐团 · 本专题 N 首合作 · 已翻开 n」 | S | 「N 首合唱 · 翻开 n」 (+ 「乐团 · 」 for 五月天) |
| 470/474 | sealed card 「和 ? 合唱」「翻开」「试试这张」 (aria 「翻开《T》，看看X和谁合唱（提示：试试这张）」) | K | |
| 479–481 | 「终点」「来过」「前往 X →」 (aria 「沿《T》前往X，抵达终点」) | K | |
| 486 | (i) icon, aria 「看《T》的版本与来源」 | F | visible text chip 「来源」 (aria 「《T》的来源」) opening the edge paper with 来源 open |
| 274, 242 | 「去 QQ 音乐听 ↗」 / short 「QQ」; none 「QQ 音乐 · 同版本待确认」「QQ 音乐暂无同一版本」 | K/S | link K; none → 「QQ 音乐暂无」 (reason → F) |
| 508 | dead end 「死胡同 这是X在本专题唯一的合唱。退一步，换条路。」 | S | 「死胡同 · 退一步换条路」 |
| 508 | tip 「怎么玩 翻开一首，才知道 TA 和谁合唱；沿翻开的歌「前往」，才算走一步。」 | S | 「先翻开，看 TA 和谁合唱」 (sticky note; shown until the first flip, as now) |
| 510–512 | 「退一步」, aria 「退一步：返回上一位并撤销一步（提示：回去更近）」「回到起点」「当前路线，第 N 步」 | K | |
| 530–532, 521 | closed: 「抵达/揭晓」 seal, 「已抵达 · N 步」「已揭晓」, 「再来一局 →」「连线歌单」「完整图鉴」, 「出题给朋友」「保存战绩卡」 (+ aria) | K | |
| 585 | 「跳过 →」 (aria 跳过…动画，直接看连线歌单) | K | |
| 690 | empty 「桌上还没有唱片」 + 「开一局寻声：只给起点和终点，一张张翻开它们之间的合唱。」 + 「开一局 →」 | S | p → 「只给起点和终点，一张张翻开中间的合唱」 or R |
| 433, 440, 443 | 2D table aria 「唱片桌：已认识 N 张，M 张还盖着」「完整音乐关系网，N 位艺人…」, flags 终点/你在这里/停在这里 | K | (a11y; optional 「N 位艺人」→「N 位歌手」) |

**D. 完整图鉴 / roam** (`map.js`)

| Where | Current | Code | Proposal |
|---|---|---|---|
| 641 | 「完整图鉴」 / 「合作挑战」 | K / L | |
| 666 | tag 「情景示例 · 虚构」 | X | |
| 646–648 | sub 「从X出发 · 途经 N 位 · 已结束」 + trail; 「策展标签 · 人工整理，不代表合作」 | K / X | |
| 650–651 | 「回到寻声 →」「开一局寻声 →」 / 「返回图鉴」 | K / L | |
| 667 | 「找音乐人」 | K | |
| 653 | mode switch 「合作 / 策展标签」 (aria 关系类型) | X | |
| 656–657 | menu 寻声 [开一局寻声 · 自选起点和终点]; 资料 [开放曲库 · 「连接与来源」 · 我的发现 · 「挑战结果/回顾路线」] | K/S/L | 「连接与来源」 → 「TA 的合唱」 |
| 618–622, 611–616 | roam bar 「返回上一位」「回到起点」「本次发现 · N 首」「结束探索」; ended 「已结束」「回顾 · N 首」「继续本次探索 →」 (+ aria) | K | |
| 677 | selection 「X」 + 「乐团 · N 次合作 · M 首作品 · 你在这里/停在这里」, 「作品 ↗」, 「和 TA 隔几首？」 | S | meta 「N 首合唱 · 你在这里」 (N 次合作 == M 首作品 for the real data); 「作品 ↗」 → 「TA 的歌」 |
| 678–679 | 「N 条连接」, empty 「暂未收录连接」 | S | 「N 首合唱」, 「还没有合唱。」 |
| 663 | legacy route bar 「N 首收藏」 | L | |

**E. Papers** (`map.js panelHTML`)

| Paper | Current | Code | Proposal |
|---|---|---|---|
| search 896 | eyebrow 「真实合作精选」; h2 「找音乐人」; label 「29 位已收录」; placeholder 「名字，如 周杰伦、JJ Lin」; result tag 「本专题收录 N 首合作」 + 「↗」 | R/K/S/K/S | eyebrow R; label 「29 位歌手」; tag rendered as 「N 首合唱」 (display-time; data unchanged); drop ↗ |
| search 696 | empty 「本专题暂未收录。可以试试「周杰伦」或「林俊杰」。」 / fictional 「…「林间」或「乔屿」」 | S/X | 「没找到，试试「周杰伦」或「林俊杰」。」 |
| challenge 905 | eyebrow 「真实合作精选 · 出题」; h2 「开一局寻声」/「换个起点，再出一题」; desc 「选好起点和终点，桌上只翻开这两张唱片。开局前不会告诉你答案。」 / 「…发给朋友的只有这两位歌手和规则；答案、你的路线和收藏都不会带上。」 | R/K/S | eyebrow R; desc → 「开局前不告诉你答案。」 / 「朋友只拿到起点和终点。」 |
| challenge 905 | 「起点」「终点」, options 「X（乐团）」, 「开局 →」「出题给朋友」「自己先走一局」 | K | |
| challenge 905 | footer 「{ROUND_RULE}仅使用本图谱已收录的共同演唱。」 | R | rule lives in 关于 |
| errors 170–172 | 「请选择当前图谱内的艺人。」「出发点和终点相同，换一位想遇见的艺人吧。」「本专题已收录的合作关系尚未连通，请换个起点或终点。」 | S | 「请选这里收录的歌手。」「起点和终点相同，换一位吧。」「这两位之间还连不上，换一位试试。」 (panel problem lines end with 。) |
| share 910 | eyebrow 「出题给朋友 · 不带答案」; h2 「A → B，隔着几首歌？」; desc 「把这条链接发给朋友，TA 会拿到同一道题：只有起点、终点和规则，没有答案，也没有你的路线、收藏和历史。」; 「题目链接」; message; 「复制链接」「回到连线歌单」「再出一题」「完成」 | S/K/S/K | eyebrow 「出题给朋友」; desc 「链接只带起点和终点，不带答案。」 |
| reveal 912 | 「寻声 · 揭晓」「放弃并揭晓答案？」 + 「本局记为「已揭晓」，不算抵达；已翻开的唱片和你的路线都保留。」 + 「揭晓答案 →」「再想想」 | S | desc 「这一局记为已揭晓，翻开的唱片还在。」 |
| artist (round) 922–923 | eyebrow 「寻声 · 乐团 · 终点/你在这里/来过/已认出」; sealed 「终点的 N 首合作还封着，不能从终点倒推。」「还有 N 首封着，在下方手牌里翻开。」「还有 N 首封着，走到 TA 面前才能翻开。」; empty 「本专题暂未收录合作。」 | K/S | 「终点的 N 首还盖着。」「还有 N 首盖着，在手牌里翻开。」「还有 N 首盖着，走到 TA 这里才能翻开。」「还没有合唱。」 |
| artist (atlas) 924 | eyebrow 「真实合作精选 · 乐团 · 入选合作」 / 「示例作品」; 「从这里开始探索」 | S/X/K | eyebrow 「N 首合唱」 (+乐团) |
| edge 935 | eyebrow 「共同演唱」; names (select buttons); track row; **source link** `evidenceHTML` (`sourceLabel ↗`); fog note 「完整制作署名在本局结束后的连线歌单里展开，以免提前认出还盖着的音乐人。」; ended note 「这次探索已结束；继续后才能沿这首歌走到X。」; 「前往X →」「继续本次探索 →」「从X出发」 | K/F/S | link → 来源; fog note 「完整署名在这一局结束后可看」; ended 「继续这次探索，才能走到X」 |
| credits 941 | 「作品署名」, title, recording label, table 「姓名 / 负责内容」, **role superscript links** (`aria 「X的Y署名来源：…，新标签页」`), bottom listen line + 「站内没有音频，链接会离开本站」, 「留下作品 / 已留下」 | K/F/R | superscripts → 来源 (per-source role list); 「站内没有音频…」 R (↗ says it; 关于 says no audio) |
| credits 941 | fog-only note 「署名表按来源原样列出；非演唱署名不表示合唱。」 | R | dead (only rendered when `!fog` yet guarded by `fog`) |
| creditsHTML 301–303 | 「作品署名 N 位 ›」; 「署名来源 N」 list + 「核对于 D」 + 「核对于 D。仅列已核实署名，未列出不表示未参与。」 | K/F | sources block → 来源; footnote kept inside 来源 as 「只列有出处的署名，参与者可能更多。」 |
| relations 945 | eyebrow 「真实合作精选 · 合作关系」; h2 「连接来源」; desc 「图中连线表示共同演唱；每首作品可展开制作署名。」 / fictional desc; rows 「A ↔ B」 (aria 查看与B的连接); empty 「本图谱暂无收录。」 | R/S/R/X/K/S | h2 「X 的合唱」; empty 「还没有合唱。」 |
| recap: roam 757–769 | eyebrow 「{情景示例 · 虚构 · }{探索回顾 · 已结束 / 本次发现 · 进行中}」; h2 「这一路，留下的喜欢」/「本次发现」; dl 日期/起点/途经艺人/留下; 「留下的歌」; 「这次还没有留下歌曲。」; 「我走过的路 N 段 / 还在起点」; 「途经艺人 N 位」 (+ roles, 「从 TA 再出发 →」); card p 「把起点、遇见的歌手和留下的歌存成一张图片。图片只在这台设备上生成，发不发由你决定。」 + 「保存发现卡片」; 「继续本次探索 →」「开始新探索」「回到小院」; note 「仅保存在当前浏览器，清除浏览器数据会丢失。继续后再次结束，会更新这一条记录。」 | X/S/K/S/K/R/K/R | eyebrow 「进行中」/「已结束」; empty 「这次还没留下歌。」; card p R (button stays); storage note R |
| recap: round progress 791–796 | 「寻声 · 进行中 · D」, h2, stats 步/首已翻开/次提示, 「当前路线」, 「已翻开的合作」, 「还没有翻开的合作。」, 「继续这一局 →」, note 「翻开的唱片、提示与路线仅保存在当前浏览器。」 | K/S/R | 「翻开的合唱」, 「还没有翻开的合唱。」; note R |
| recap: setlist 838–857 | eyebrow 「{连线歌单/揭晓} · {真实合作精选/情景示例 · 虚构}」; h2 「{揭晓：}A 与 B，{隔着/最少隔着} N 首歌」; verdict 「你的路线 N 首 · 一步不绕/多绕了 M 首」「你停在X（N 步）」 | S/X/K | eyebrow 「连线歌单」/「揭晓」; h2 = layered title, N as `.ds-key` digits |
| setlist share 843–847 | h3 「这道题，也给朋友走一走」; p 「只带起点、终点和规则；答案、你的路线、收藏和历史都不会带上。」; 「出题给朋友」「保存战绩卡」「换个起点再出一题」 | K/R/K | |
| setlist tickets 816–833 | roles 起点/终点/第 N 站; title (→ credits); version label; **source link**; 「去 QQ 音乐听 ↗」; QQ credit 「QQ 音乐署名：X」; none 「QQ 音乐暂无同一版本」 + reason; 「留下 / 已留下」; fictional 「示例合作 · 虚构，无音源」 | K/F/X | source link, QQ credit, reason → 来源 |
| setlist stats 850–853 | 有效步数 · 本专题最短 · 翻开 · 认识 · 提示 · 实际前往 | S | keep 3: 「步数」「本专题最短」「提示」 |
| setlist 836, 855–856 | 「另一条同样短的路线 N」「本专题最短的路线 N」; 「分支记录 N 次前往」; 「再来一局 →」「留下这 N 首 / 已留下这 N 首」「看完整图鉴」 | K | |
| setlist 857 | footnote 「路线只来自本专题已核实的共同演唱录音；“最短”仅指本专题收录范围。站内没有音频；「去 QQ 音乐听」会离开本站，只在 QQ 音乐有同一录音时出现。」 / fictional footnote | A/X | → 关于·数据来源 (the 「本专题最短」 label keeps the claim qualified) |
| history 953 | eyebrow 「探索记录 · 仅存当前浏览器」; h2 「我的发现」; empty 「还没有探索记录。」 | S/K | eyebrow 「探索记录」 |
| delete 955 | 「删除这次探索？」 + 「将删除从X出发的路线、分支和作品清单，无法恢复。」 + 「删除记录」「保留」 | S | desc 「删除后无法恢复。」 |
| reset 956 | 「回到X？」 + 「当前路线与步数归零，已翻开的唱片保留 / 作品清单和分支记录保留。」 + 「回到起点」「继续当前路线」 | S | 「步数归零，翻开的唱片还在。」 / 「路线回到起点，留下的歌还在。」 |
| replace 960 | 「本次探索 · 进行中」; 「结束当前探索，并从X开始新的探索？」; 「从A出发的这次探索（途经 N 位 · 留下 M 首）会标记为已结束，留在「我的发现」里，随时可以回看或继续。」; 「结束并开始 →」「取消」 | K/S/S/K | h2 「结束这次探索，从X重新出发？」; desc 「这次探索会留在「我的发现」里。」 |
| dialogs 964, 970 | aria 连线歌单/本次发现/探索回顾/…/「音乐探索面板」; 「关闭面板」 | K | |
| legacy recap 772–785 | 「挑战回顾」「探索回顾」「位艺人」「首留下」「留下的作品」「抵达路线/当前路线」「继续挑战/继续探索」「返回图鉴」 + storage note | L | |

**F. Track rows and shared bits** (`tracksHTML`, `listenHTML`, `undoHTML`, `timelineHTML`, `roamRouteHTML`)

| Where | Current | Code | Proposal |
|---|---|---|---|
| 323 | title button 「T ↗」 (opens credits paper; aria 「查看《T》的作品署名」) | S | title + small 「署名 ›」 chip, no ↗ |
| 318–320 | detail: kept-from note (e.g. 「沿A与B的合作《T》留下」), version label, credit summary (data) | K | (optional S: 「沿《T》留下」) |
| 324 | save toggle aria 「留下/移除《T》」, title 「留下这首作品」「已留下，点击移除」 | K | |
| 264–268 | listen 「去 QQ 音乐听 ↗」 (aria 「在 QQ 音乐打开《T》同一录音（新窗口）」), credit 「QQ 音乐署名：X」, none + reason/title | K/F | credit and reason → 来源 |
| 279 | evidence link 「{sourceLabel} ↗」 (aria 「查看…，新标签页」) | F | |
| 345 | undo 「已移除《T》 撤销」 | K | |
| 706–710 | 「分支记录 N 次前往」; 「回到起点/退回 X · 撤销对应步数」; hop 「A → B 近/远/平」 + 「合作关系 · 《T》」 / 「已记录的连接」; empty 「还没有连接记录。」 | K/S | 「合作关系 · 」 → 「合唱 · 」 |
| 725–737 | 「还没有走到下一位。」; 「↩ 返回起点，重新探索」「返回X，换个方向」; hop basis 「合作关系 · 《T》」 + evidence link | K/S/F | |
| 330, 709, 923, 924, 935, 941, 1465, 1537, 1543 | stored keep-sources 「沿…留下」「通过…留下」「在寻声中留下」「在X的作品里留下」「从关系网中留下」「查看作品制作署名后留下」「从连线歌单留下」「在曲目收藏中留下」「在探索回顾中留下」 | K | shown under kept songs; stored in saves, so old saves keep old text |

**G. 我的发现** (`app.js mountRecords`, `map.js recordsHTML/recordRowHTML`, `open-catalogue.js mountSavedMusic`)

| Where | Current | Code | Proposal |
|---|---|---|---|
| app.js:319 | h1 「我的发现」, 「去唱片店」, tabs 「探索记录」「留下的歌」 (aria 我的发现分类) | K | tabs as sticker tabs |
| map.js:977 | 「探索记录」 + 「N 次探索」; empty 「还没有探索记录」 + 「从一位喜欢的歌手出发，路上留下的歌和走过的路都会记在这里。」 + 「开始探索」「开一局寻声」 | K/S | p 「从一位歌手出发，走过的路会记在这里。」 |
| map.js:977 | 「仅存当前浏览器，清除浏览器数据会丢失。」 | R/A | 关于 keeps one line |
| map.js:864–875 | row meta 「真实合作精选 · {寻声 · 朋友出的题/寻声/挑战/漫游} · {已抵达/已揭晓/已结束/进行中} · D」; title 「起点 X」/「A → B」; details 「翻开 n 首 · 提示 n 次 · n 步」「途经 n 位 · 留下 n 首」 | S/K | drop 「真实合作精选 · 」 |
| map.js:876 | 「回顾 ↗」「继续」, delete aria 「删除从X出发的记录」 | S/K | 「回顾」 (no ↗) |
| open-catalogue.js:112–115 | 「留下的歌」「N 首」, aria 收藏的歌曲; empty 「遇到喜欢的歌，就留在这里。」 + 「去探索 ↗」 | K/S | button 「去唱片店 →」 |
| open-catalogue.js:121–123 | detail 「{开放曲库 · 共同署名 / 真实合作精选} · D留下 · 资料来源」 | S/F | 「D 留下」 + 「开放曲库」 chip for hf rows; 「资料来源」 link → 来源 |
| open-catalogue.js:38 | 「移除」 (aria 移除《T》) | K | |
| open-catalogue.js:131/134 | toasts 「已移除」, 「这首歌尚未移除，请检查浏览器存储空间后重试」 | K/S | 「没移除成功，浏览器存储不可用」 |

**H. 开放曲库** (`open-catalogue.js`)

| Where | Current | Code | Proposal |
|---|---|---|---|
| 59 | eyebrow 「THE OPEN CRATE」, h2 「开放曲库 126」, aria 关闭开放曲库 | K | eyebrow in Doodle Logo as a sticker |
| 60 | placeholder 「搜歌曲、艺人」 (aria 搜索开放曲库) | K | |
| 61 | 「共同署名艺人 · 制作分工未收录」 | S | 「共同署名，不一定是合唱」 (honesty qualifier stays) |
| 62 | footer 「Hugging Face 数据来源 ↗」 | A | → 关于 · 数据来源; footer keeps a small 「数据来源」 text button that opens 关于 at that section |
| 72 | row detail 「专辑：X · 原始记录 N」 | S/F | 「专辑《X》」; 「数据集第 N 行」 inside the row's 来源 |
| 82 | 「这箱唱片里还没有。换个关键词吧。」 | S | 「没找到，换个词试试。」 |
| 83 | 「N 首 / 本地全库 114,000 行」 | S/A | 「N 首」; dataset size → 数据来源 |
| 77–78 | 「已留下，可在「我的发现 · 留下的歌」找到」「已移除」「收藏还未保存，请检查浏览器存储空间后重试」 | S/K/S | 「已留下」; 「没存上，浏览器存储不可用」 |
| 11 | 「旧探索记录仍保留，歌曲收藏暂未同步到浏览器」 | S | 「留下的歌暂时没同步」 |
| 20 | title 「留下这首歌」「已留下，点击移除」 | K | |

**I. 关于** (`app.js:269–273`)

| Current | Code | Proposal |
|---|---|---|
| h2 「Music Map」, close aria 关闭关于 | S | 「关于音乐探索」 |
| intro 「从喜欢，走向未知。」 | K | |
| 寻声 「在唱片店选好起点和终点，只能翻开所在歌手手边的合唱；沿翻开的合唱前往才算一步，翻开、提示和查看都不计步。」 | S | 「选好起点和终点，翻开手边的合唱，沿它走到下一位；翻开和提示不算步数。」 |
| 图鉴 「唱片店里的完整图鉴摊开收录的全部合唱，可从任意一位歌手出发自由漫游。」 | S | 「摊开全部合唱，从任意一位歌手出发随便走。」 |
| 来源 「每条连线都是一首真实的共同演唱录音，附有来源；制作署名只列已核实的部分。」 | S | 「每条连线是一首合唱录音，点歌旁的「来源」看出处。」 |
| 曲库 「开放曲库只列公开数据集里的共同署名，不一定是合唱，也不连入关系图。」 | S | 「公开数据集里的共同署名，不一定是合唱，不进入连线。」 |
| 音频 「站内没有音频；{31} 首可在 QQ 音乐打开同一录音，其余标明原因。」 | S | 「这里不播放音乐；{31} 首可以去 QQ 音乐听同一录音。」 |
| 数据 「探索记录和留下的歌只存在这个浏览器里，清除网站数据后无法找回。」 | R | storage note; 「只存在这个浏览器」 is banned outside the product About's one sentence |
| (new) | A | section 「数据来源」, draft in §2.5 |
| 「知道了」 | K | |

**J. Storage, conflict, offline** (`app.js`)

| Where | Current | Code | Proposal |
|---|---|---|---|
| 232 | 「另一标签页已更新或清除了探索记录，本页已停止写入，避免覆盖。当前页内容仍保留；请重载最新记录后继续。」 | S | 「另一个标签页改了探索记录，这一页先不保存了。重新载入后继续。」 |
| 233 | 「这次修改尚未保存。请检查浏览器存储空间，并使用支持 Web Locks 的现代浏览器（HTTPS 或本地文件）。当前页内容仍保留，可先下载备份。」 | S | 「这次修改没存上：浏览器存储不可用。可以先下载备份。」 |
| 265 | 「重试保存」「重载最新记录」「下载本页探索备份」 | S | 「重试」「重新载入」「下载备份」 |
| 295 | toasts 「已保存到当前浏览器」「仍未保存，当前页内容保留，请查看存储提示」 | S | 「已保存」「还是没存上」 |
| 298 | confirm 「本页还有未保存的探索。请先下载本页备份；重载会放弃本页未保存的修改。确定重载最新记录吗？」 | S | 「重新载入会丢掉这一页没保存的探索，确定吗？」 |
| 338 | 「探索记录已在另一页更新」 + 「本页暂时停止编辑。请用上方「重载最新记录」继续；未保存的内容可先下载备份，取消重载会留在本页。」 | S | h1 「探索记录在别的标签页更新了」 + 「重新载入后继续。」 |
| 306 | download name `music-map-exploration-backup.json` | S | `music-space-explore-backup.json` (optional) |

**K. Toasts** (`map.js` unless noted)

K: 1261 「A和B没有直接合唱 · 只选中看看」, 1309/1313 + share-card.js:71 「题目链接已复制」「链接已选中，可以长按或用快捷键复制」, 1381 「是X！前往即抵达」「绕回来了：你来过X」「《T》：A × B · 认识 n/N」, 1398 「提示 ①：还隔 N 首，面前 a 首会更近」「提示 ②：退一步回到X」「提示 ②：试试《T》」, 1452/1649/2158/2186 「新的一局：A → B，隔着几首歌？」「继续这一局：…」, 1468 「这几首都已留下」, 1502 「沿《T》走到X」, 1508 「抵达X！N 步」, 1549 「已移除，可撤销」「已留下 · 本次发现 N 首」, 1571 「已恢复」, 1623 「已删除这条记录」, 2170 「开不了这一局：{error}」, 2186 「朋友的题摆上桌了：从X出发，先翻开一首合唱」, 1202/580 「图片暂时未能生成，请稍后再试」, 33 roam start 「从X出发 · 点相连的歌手就走过去」.

| Where | Current | Proposal |
|---|---|---|
| 37 | 「这张还盖着：在你所在的唱片翻开合作，才会认出 TA」 | 「还盖着：先在手牌里翻开它」 |
| 1175 | 「{回到/退回}X · 还隔 N 首 · 已翻开的唱片保留」 | drop 「 · 已翻开的唱片保留」 |
| 1178 | 「回到起点：X · 留下的歌都还在」 | 「回到起点：X」 |
| 1260 | 「这次探索已结束 · 点「继续本次探索」再接着走」 | 「这次探索已结束，点「继续」接着走」 |
| 1352 | 「上一段探索已留在「我的发现」 · 从X出发 · …」 | 「上一段探索已存进「我的发现」」 |
| 1390 / 1450 | 「本专题已收录的合作还连不到终点」「本专题已收录的合作尚未连通」 | 「这里还连不到终点」「这两位之间还连不上」 |
| 1442 | 「上一局已存入记录。新的一局：…」 | drop 「上一局已存入记录。」 |
| 1462/1530/1559 | 「收藏还未保存/恢复，请检查浏览器存储空间后重试」 | 「没存上/没恢复，浏览器存储不可用」 |
| 1468 | 「已留下 N 首，可在「我的发现 · 留下的歌」找到」 / 「（示例，仅存这次记录）」 | 「已留下 N 首」 / X |
| 1510 | 「前往X · 第 N 步 · 近 · 更近了，还隔 M 首」 | 「前往X · 更近了，还隔 M 首」 |
| 1549 | 「已留下这首作品」 | 「已留下」 |
| 1592 | 「继续本次探索 · 再次结束会更新这条记录」 | 「继续这次探索」 |
| 2141 | 「原探索记录已删除，保留当前探索。」 | 「那条记录已删除」 |
| 2166–2170 | 「朋友的题目链接打不开：{里面的歌手不在本专题收录范围内/起点和终点是同一位歌手/本专题收录的合唱还连不通这两位}。先在唱片店逛逛吧。」; 「这道寻声题里的歌手不在本专题收录范围内。」 | 「这道题打不开：{歌手不在这里/起点和终点相同/两位之间还连不上}」 |
| 2193 | 「这位歌手不在本专题收录范围内，先从唱片店看看吧。」 | 「这里还没有这位歌手」 |

**L. Share cards** (`share-card.js`; PNG text is drawn on canvas)

| Where | Current | Code | Proposal |
|---|---|---|---|
| 200–203 | PNG heading: 「Music Map」 wordmark (`heading()`), sakura petals, festoon lights, night sky | S | Doodle lettering 「Music Space · 音乐探索」 on paper |
| 396, 468 | 「寻声 · 两位歌手之间，隔着几首歌？」「发现卡片 · 从喜欢，走向未知」 | K | |
| 402 | 「朋友出的题 · 寻声」「寻声 · 真实合作精选」 | S | 「朋友出的题 · 寻声」「寻声」 |
| 406–430, 379 | 起点/终点/抵达/揭晓/「中间的歌手，翻开才知道」/「我的战绩」/「我走了 N 步」/「抵达终点 · 用了 N 次提示/没用提示」/「已揭晓 · 没有走到终点…」/「未走到」 | K | |
| 434 | 「扫码走同一道题 · 只带起点和终点」 | S | 「扫码走同一道题」 |
| 23 | footer 「每条连线都是一首真实的合唱录音」 | S | 「每条连线都是一首合唱录音」 (drop the 真实 claim; still true) |
| 483–565 | 「探索 · 回顾/进行中」「从…出发」「途经 N 位 · 留下 N 首 · D」「另 N 位」「节选 · 共 N 位/首」「→：沿合唱走过去 · ↩：退回后换个方向」「按遇见的先后 · D」「留下的歌」「等 N 首」 | K | |
| 548 | 「这次还没有留下歌曲。走过的路，都在网页的探索回顾里。」 | S | 「这次还没留下歌」 |
| 58, 67 | share text 「A 和 B 之间隔着几首歌？来 Music Map 翻翻看」, title 「Music Map · 寻声」 | S | 「…来 Music Space 翻翻看」, 「Music Space · 寻声」 |
| preview 588 | 「PNG · 1080 × 1350」 | R | |
| preview 588 | 「也可以长按图片保存」, 「下载图片」「分享图片」「关闭」, 636 「暂时无法分享，可以先下载图片。」 | K | |
| map.js:1324 | note 「图片只画起点、终点和盖着的唱片，不写中间的歌手和歌名。」 | R | |
| map.js:1335 | note 「完整的路线和来源仍在网页的探索回顾里；长内容在图片上只画了一部分，标了「节选」」 | S | 「图上只画了一部分」 when excerpted, else R |
| map.js:1323/1334 | alt texts | K | |
| 440/571 | file names `music-map-xunsheng-*.png`, `music-map-discovery-*.png` | S | `music-space-*` (optional) |

**M. Strings in 3D-owned files** (for the 3D builder; UI builder must not edit these files)

| Where | Current | Proposal |
|---|---|---|
| sakura-scene.js:52 | canvas aria 「夜晚的樱下音乐小院，串灯亮着，唱片店开着门。可通过物件标记或下方导航前往小院、唱片店与我的发现。」 | describe the new paper diorama, e.g. 「纸做的音乐小院，唱片店开着门。点「唱片店」标记或下方导航前往。」 |
| sakura-scene.js:56–57, 65, 262, 339 | compass aria 「音乐小院」, buttons/caption 小院 · 唱片店 · 我的发现, pin 「唱片店」 | K (if the nav is ever renamed, app.js and sakura-scene.js change together) |
| sakura-music.js:196, 204, 324–326 | 「终点」「你在这里」, aria 「终点：X」「查看 X，N 首收录，你在这里」「查看A与B的{合作/策展标签}：T」, tag 「《T》」 | 「查看 X，N 首合唱…」 optional; 「策展标签」 branch is fictional-only (X) |
| sakura-printwork.js / sakura-world.js | in-world prints 「樱下放映」「RECORDS & LITTLE MOMENTS」「NIGHT BLOOM」「SIDE B」「ONE MORE SONG」「樱下」「ACOUSTIC SESSION」「33⅓」「33 / 45」 | invented decorative prints, not attributed to any real artist; redraw or keep at the 3D builder's discretion (「NIGHT BLOOM」 names the night look) |

**N. Data strings** (`map-catalogue.js` = byte-identical copy of `runtime-preview/src/map-catalogue.js`; `assets/data/hf-collaborations.json`). Never
edit text in data. Display rules: `edge.sourceLabel/sourceUrl/evidence/checkedAt`, `song.creditSources[]`, per-role `sourceId`, `listenLinks[0].credit`,
`listenReason`, `listenCheckedAt` → 「来源」; `versionLabel`/`recordingLabel` stay visible as the version line; `creditSummary` stays as the row preview;
`artist.tag` (「本专题收录 N 首合作」) is rewritten at display time; `artist.bio` is unused; HF `licenseNote`, `selection`, `counts`, `source.*` → 数据来源.

**O. Outside our scope that mention the map** (report, do not edit): `scripts/build/static-html-plugin.mjs` PAGES.map noScript 「需要开启 JavaScript 才能打开
Music Map。」 and noModule 「这个浏览器版本太旧，打不开 Music Map。…」 (COPY-PLAN keeps them; rename to 音乐探索 only if the owner adopts this glossary); `web/event-room/original-map-entry.js:9,11`
(「当前离线，恢复连接后再打开音乐探索；聊天草稿会保留。」「浏览器无法保留返回位置，请允许本机存储后重试。」) and the room button's aria (already planned → 「音乐探索」).

### 2.3 Copy volume after cleanup (rough)

Removed from the main UI: 9 storage/meta notes, 4 legal/audio/meta footnotes, 2 privacy explanations on keepsakes, the home step list, the long hint
sentences, 「原版三维唱片桌」, every 「真实合作精选」 label, every 「情景示例 · 虚构」 branch (6 sites + data). Moved: dataset/licence/audio facts → 关于 · 数据来源;
per-link citations → 「来源」.

### 2.4 The 「来源」 disclosure (fold, never delete)

One helper in `map.js`, e.g. `sourcesHTML({ edge, song, fogged })` →
`<details class="map-sources"><summary>来源</summary>…</details>` (summary ≥44 px, Marker font, no ↗ on the summary). Content, all from existing data:

1. 演唱：`<a href=edge.sourceUrl>{edge.sourceLabel} ↗</a>` + the evidence sentence `edge.evidence` (currently never shown for real edges) + 「访问于 {edge.checkedAt}」.
2. 制作署名 (only when `!fogged`; it can name artists not yet met in a round): for each `song.creditSources` after the first: `<a>{label} ↗</a>` + the roles it
   supports, built from `song.credits.filter(c => c.sourceId === source.id)` (「作词 方文山 · 编曲 林迈可 …」) + its own date when different.
3. QQ 音乐：linked → 「同一录音」 + 「QQ 音乐署名：{credit}」 when `!creditMatches` + 「访问于 2026-09-29」; not linked → `listenReason` + date.
   The two `recordingLabel`s that end in 「（未核对与影片是否同一场…）」 (`real-not-truly-happy-sky-live` and `real-leave-the-earth-live`, map-catalogue.js:727, 742) show the label without the
   parenthesis in the main UI and the full label here (display-time split; data unchanged), so the qualifier stays reachable.
4. Footnote: 「只列有出处的署名，参与者可能更多。」

Use it in: edge paper (replaces `evidenceHTML` + fog note), setlist tickets (replaces source link, QQ credit, reason), credits paper (replaces the
superscripts and the 「署名来源」 details — the table keeps names and roles only), `creditsHTML` inside track rows, relations paper, roam route hops,
saved-song rows for real songs (replaces 「资料来源」), round hand cards (the (i) icon becomes a visible 「来源」 chip that opens the edge paper with the
disclosure open). HF rows: 「开放曲库 · Hugging Face 数据集第 {recordNumber} 行」 + dataset link. Counts: 37 songs, 1–4 sources per song, up to 46
credit rows per song (orchestral credits), so the disclosure scrolls inside the paper. Fog rule as today: during an active round only flipped edges
show 来源, and only items 1, 3, 4.

### 2.5 Draft 「数据来源」 section (关于)

* 合唱目录：29 位歌手、37 首共同演唱录音。每首都附有出处（官方 MV、唱片公司页面或发行平台的署名），资料访问于 2026 年 9 月 27–28 日；出处在每首歌的「来源」里。
* 去 QQ 音乐听：31 首在 QQ 音乐有同一录音（2026 年 9 月 29 日按页面信息确认，没有试听比对）；另外 6 首在「来源」里写了原因。这里不播放音乐。
* 开放曲库：126 首，取自 Hugging Face 数据集 maharshipandya/spotify-tracks-dataset（快照 635b034）里 mandopop、cantopop 的共同署名记录（全库 114,000 行）。
  数据卡只标了 bsd 许可，没有注明具体版本；这里只用曲名、艺人和专辑，不含音频。[数据集 ↗]
* 路线和「最短」只算这里收录的 37 首合唱。
* 字体：Doodle 字体由站酷庆科黄油体、霞鹜漫黑、悠哉、龙藏体、Luckiest Guy、得意黑裁切改名而来（SIL OFL 1.1 / Apache 2.0）。[许可全文 ↗ = site-base `fonts/doodle/LICENSES.txt`]
* 代码：three.js、Sakura Crossing 渲染、OverlayScrollbars、Phosphor Icons、qrcode-generator（MIT），GSAP（Standard No Charge 许可）；许可全文随网页源码附带。
* 唱片店、寻声和合唱目录沿用 Music Map。

Every sentence above is backed by repo data (`map-catalogue.js` dates/counts, `qqLinks`/`qqUnavailable`, `hf-collaborations.json`, `fonts/doodle/LICENSES.txt`,
`assets/licenses/*`). Re-check the font/code list if the 3D builder adds or drops a dependency.

### 2.6 Tests that touch the map (none assert its strings)

* `tests/static-storage-guard.test.js` scans `web/original-map/js` for `music-space-…` literals; new keys must start with `music-space-map-` (kept prefix).
* `scripts/test/static-build.test.mjs` + `scripts/pages/verify-tree.mjs checkHtml('map')` (structure of the built page, §1.4).
* `tests/static-copy-transform.test.js` (storage keep-lists incl. `music-space-map-*`), `tests/site-base.test.js` (map URLs), `tests/original-map-entry.test.js`
  (room-side entry), `tests/music-map.test.js` (runtime-preview catalogue + `web/music-map/` — not the original map).
* Proposed new UI tests: a banned-word scan like COPY-PLAN §Risks 8, over the map's rendered HTML for every state and the built `music-map/index.html`:
  示例|虚构|模拟|演示|只存在这个浏览器|仅保存在当前浏览器|清除浏览器数据|原版三维唱片桌|真实合作精选|不代表|未核实|核对 (data strings excepted only inside 「来源」); `sourcesHTML` for each
  of the 37 edges contains its `sourceUrl`, every `creditSources[].url` and every credited name when not fogged, and no credit source when fogged;
  built HTML of both map configs contains the fonts `<link>` with the right relative path; 关于 contains the dataset revision and licence label.

---------------------------------------------------------------------------------------------------------------------------------------------------

## 3. Fictional content

* What: `map-data.js` `fictionalArtists` (林间, 乔屿, 夏禾, 陆遥, 白川, 南枝, 阿澄, 许岸, 孤岛来客 — invented names with invented tags/bios), 27 invented song
  titles, 12 invented 「共同演唱」 duets (`evidence: 示例合作作品…；虚构关系，仅用于交互演示。`), 8 「策展标签」 style links, catalogue `fictional` (label 「情景示例」)
  with 3 rounds. UI labels: home.js:45, map.js:563, 653 (mode switch), 666, 696, 757, 830, 839, 857, 924, 945, 1468; sakura-music.js:324.
* Real artists involved? **No.** IDs live in a separate namespace, `getNeighbors`/`isReachable` filter by dataset, and no fictional edge touches a real ID.
* Reachable in Music Space? **No.** The only source of fictional sessions is a 0.15 save; the Space map reads only `music-space-map-exploration:v1`, which no
  Space build ever filled with fictional sessions; new rounds (`openNextRound(…,'real')`, `startRound`), roams (`start()` requires `dataset==='real'`),
  friend links (`known` check) and chat songs (`realSongs` only) are real-only.
* Recommendation: **remove** the fictional catalogue and all its branches (do not just unlabel), and in `prepareStoredMap` drop any stored session whose
  `start`/`target` is not a real artist (defensive, one-time). Also remove the legacy non-fog 「合作挑战」 branch (§1.1) while there. Keep the in-world 3D
  prints (invented, unattributed) — 3D builder's call.
* Other honesty checks: 「每条连线都是一首合唱录音」 (PNG footer, about; 「真实」 dropped per COPY-PLAN) is backed per edge; 「最短/最少/还隔」 must keep 「本专题」 or the 数据来源 line; the open
  catalogue must keep 「不一定是合唱」; the QQ 「署名」 difference and missing-version reasons stay reachable in 来源; 「去 QQ 音乐听」 only appears for verified
  same-version pages (data rule, unchanged).

---------------------------------------------------------------------------------------------------------------------------------------------------

## 4. Doodle restyle plan (UI) and ownership

### 4.1 Approach

1. `index.html`: `data-look="doodle"` on `<html>` (keep `data-theme="sakura"`: ~480 rules and themes.js depend on it), theme-color `#f7efdf`, a hidden
   `<svg class="ds-defs">` with the `#ds-wobble` filter (copy of the event room's), no font link (configs inject it, §1.5).
2. New layer `web/original-map/css/doodle/` imported **last** from `app.js` (after `listen.css`); it `@import`s the shared, read-only
   `event-room/doodle/tokens.css`, `type.css`, `kit.css` (not `index.css`/chrome — those style the room). Files: `bridge.css` (legacy vars → `--ds-*`,
   `--font-display`→`--ds-font-ui`, `--font-serif`→`--ds-font-display`, `--font-mono`→`--ds-font-digits`, night/glass/paper/object/studio/round/map vars →
   paper, card, ink, marker colours), `controls.css`, `shell.css`, `home.css`, `shop.css` (round + atlas + tags + menu), `papers.css`, `records.css`,
   `catalogue.css`, `fallback.css`. `space-bridge.css` is restyled in place (it loads after the layer).
3. Retire the night branch: colour/glass/scrim/glow rules in `night-shell.css`, `courtyard-ui.css`, `map-round.css` (`--round-glass*`), `spatial-world.css`;
   keep their geometry. Optionally delete the ~70 dead classes.
4. Markup hooks we own may add `.ds-*` classes, `<span class="ds-tape|ds-deco …" aria-hidden="true">` and wrappers; keep every class/id/data-* that JS,
   `sakura-framing.js`, toast placement or tests use.
5. Rules from `docs/design/doodle.md`: one or two layered titles per screen, body 16 px (≥15), hard offset shadows only, ≤2 marker colours per component,
   small text on marker fills in ink, tilt only on stickers/tape/polaroids, decorations ≤2–3 per area and hidden ≤360 px, focus = 3 px dashed ink,
   tap targets ≥44 px, no new hex (use tokens / `DOODLE_COLORS`), reduced motion = no motion, forced colours = no decorations.

### 4.2 Component by component

| Component | Doodle recipe |
|---|---|
| Page ground | `--ds-paper` + `--ds-dots`; no night scrim (`.spatial-world::after`), no text glow; WebGL-off page is the same paper |
| Masthead | left: `.ds-logo` 「MUSIC SPACE」 (≈22 px) + sticker chip 「音乐探索」 (yellow, −2°); right: 「← 返回现场」 secondary button (card, ink 2 px, mint hard shadow, ≥44 px) and a round sticker button for 关于 (44 px, like the room's 「···」); ≤360 px hide the chip; fix the 320 px brand overlap |
| Bottom nav (phone `.mobile-nav`) and compass (desktop `.world-compass`) | sticker tabs like the room's camera dock: paper card, ink border, active = yellow + `--ds-shadow` + −1.5°; icons 2.2 px round strokes with `#ds-wobble` (icons.js holds 18 Phosphor glyphs, the nav uses heart/compass/bookmark; redraw the used ones as hand-drawn strokes, or restyle; keep the phosphor licence comment either way) |
| Home cover | hero `.ds-title` at `--ds-size-hero` with 「走向未知」 `.ds-key`; one-line lede in Hand; search card `.ds-card` + yellow tape; input card, ink 2 px, `--ds-radius-2`, focus `4px 4px 0 var(--ds-mint)`; picks = marker chips with the artist tone dot, ≥44 px; 寻声 slip = ticket card with mint shadow; foot = wavy text buttons + pink Digits count badges |
| Question slip (round) | paper card + tape; question in Display (from name `.ds-hl` mint, to name `.ds-key` pink); status numbers in Digits; stamps 近/远/平 as rotated round stickers (Note font possible for 「好近」「好远」) |
| Round tools | three chips in a row: 提示 (yellow, 「?」 badge), 换一组 (card), 目录 (card ▾); 目录 paper = ink-bordered sheet, Marker group headings, rows ≥44 px; zoom − 全图 + = round sticker buttons |
| Hint note / friend note | yellow tape strip with Hand text; friend note = pink-taped card with sticker close 「×」 |
| Hand | kraft tray (`--ds-paper-deep`) with ink border replaces the dark crate; cards = sleeve stickers (card, ink 2 px, ±1° alternating, hard shadow), sealed card shows a Display 「?」; 翻开 / 前往 = primary (ink, cream text, pink shadow); 「来源」 chip; 「去 QQ 音乐听 ↗」 small secondary; badges 终点 (pink chip) / 来过 (mint chip); tip / dead-end = handwritten notes; 退一步 secondary, reset round 44 px, trail = small chips with arrows. Fix: buttons drop to 38 px at 320×640 today; tip text clips at the tray edge on phones |
| Closed bar | round 「抵达/揭晓」 stamp sticker; Display h2; 再来一局 primary, 连线歌单/完整图鉴 secondary, share row secondary |
| Atlas | title slip with tape; tools row as chips; dock = card with tape: roam bar buttons (secondary; 结束探索 pink-outlined), selection (artist stamp + Display name + meta), 「N 首合唱」 details list rows ≥44 px |
| Scene name tags (3D-created DOM, UI CSS) | card fill, ink 2 px, small hard shadow (≤2–3 px so the label engine's spacing still holds), Marker 14/16 px; current = ink fill + card text, target = pink fill + ink text, selected = mint top bar, flags 「终点」「你在这里」 as chips; song tags = small card with coloured left rule (route yellow, answer dashed); keep `.world-music-hit` bands; leader lines in ink |
| Papers (`.map-dialog`, about, catalogue, share preview) | phone: bottom paper drawer; desktop: side paper (current placement); ink border + `--ds-shadow-lg` + tape; close = round sticker 「×」; eyebrow = small marker chip; one Display h2 with colour shadow; body Hand 16 px; dashed ink dividers; `details` summaries with a drawn chevron, ≥44 px; save toggles = round stickers (card → mint with ✓) |
| 来源 disclosure | small ink-outlined summary 「来源」; body = numbered list on `--ds-paper-deep`, links wavy-underlined pink, dates in Digits |
| Setlist | ticket stubs with dashed tear lines and Digits numbers; stops = polaroid-like sleeves (±1.5°); h2 count as `.ds-key`; 3-cell stat strip; actions bar pinned at the bottom as today |
| Credits table | dashed rules, names Marker, roles Hand; no superscripts |
| 我的发现 | paper sheet; tabs = sticker tabs (active yellow); record rows = sleeve cards with a Digits disc label; actions secondary + 44 px icon delete |
| Open catalogue | 「THE OPEN CRATE」 as a Logo sticker; search per input recipe; rows = numbered cards (Digits), title Marker, artists Hand (not Display: missing traditional glyphs) |
| Toast | speech bubble: card, ink border, tail, `--ds-pop`; placement logic in app.js unchanged |
| Storage warning / conflict / offline | pink-taped note cards with ink border; buttons secondary |
| Share-card PNG | redraw on paper + dots, ink lines, marker colours, Doodle fonts (`await document.fonts.load(...)` per family before drawing; Display only for simplified names); QR stays black on white |
| WebGL-off 2D table | paper table drawn by map.js/SVG: sleeves = ink squares, lines = ink strokes, route = yellow, answer dashed, tags as above |
| Scrollbars | `os-theme-music`: ink thumb on paper |
| Motion | card flip / stamp / setlist-in keep their keyframes in Doodle form; panel pop `scale(.96)→1`; all off under reduced motion (base.css switch + kit.css) |

Suggested order: fonts + tokens + bridge + controls → shell/nav → record shop round (judge entry) → papers + 来源 → atlas → home → records/catalogue/about →
share card → fallback/edge states → copy pass + fictional removal + tests. QA each step at 390×844, 1440×900, 320×640, WebGL off, reduced motion, in
the Pages build under `/musicSpace/` and `/musicSpace/preview/`.

### 4.3 Exclusive file split

**3D builder (scene/renderer) — exclusive:**
`web/original-map/js/sakura-scene.js`, `sakura-world.js`, `sakura-printwork.js`, `sakura-music.js`, `sakura-camera.js`, `sakura-framing.js`,
`sakura-batch.js`, `themes.js`, `js/vendor/sakura/{palette.js,post.js,toon.js,SOURCE.json}` (prefer adding a new pass file over editing vendor code),
any new 3D files it creates (e.g. `js/sakura-doodle.js`), and its own new tests (e.g. `tests/original-map-scene*.test.js`).

**UI builder (UI/CSS/markup) — exclusive:**
`web/original-map/index.html`; `web/original-map/css/**` (all 21 files + the new `css/doodle/` layer + `space-bridge.css`, **including** the styles of
3D-created DOM: `.world-compass`, `.world-caption`, `.world-pin`, `.world-hotspots`, `.world-music-label*`, `.world-music-link*`, `.world-music-hit`,
`.sakura-scene`, `.sakura-scene__fallback`); `web/original-map/js/app.js`, `home.js`, `map.js`, `open-catalogue.js`, `share-card.js`, `space-bridge.js`,
`icons.js`, `motion.js`, `map-data.js`, `map-network.js`, `music-library.js`, `exploration-storage.js`; `web/original-map/assets/favicon.svg`;
`web/original-map/README.md`; `vite.static-map.config.js`, `vite.map.config.js` (font link only); new UI tests (e.g. `tests/original-map-copy.test.js`,
`tests/original-map-sources.test.js`).

**Read-only for both:** `web/original-map/js/map-catalogue.js` (identical copy in `runtime-preview/src/`), `assets/data/hf-collaborations.json`,
`assets/licenses/*` (verify-tree requires all six notices), `web/event-room/doodle/*`, `web/event-room/public/fonts/doodle/*`,
`web/event-room/venue-art.js`, `web/avatar/doodle-pass.js`, `web/shared/site-base.js`.

**Contracts between the two:**
1. Overlay DOM made by 3D and styled by UI: class names above plus states `is-selected/adjacent/visited/highlighted/current/target/route/muted/answer/
   active/has-leader`, `data-touch`, `--touch-*`, `--leader-*`, host `data-shot`/`data-travelling`/`data-music-zoom`, `body.spatial-fallback`. Neither side
   renames them alone. Keep painted tag size within a few px of today (labelSize estimates 13/14/16 px; ResizeObserver corrects the rest).
2. `sakura-framing.js` WATCH list (§1.2) is the UI's layout contract: UI keeps those classes; a new persistent overlay outside them must be a
   `dialog[open]` or requested from the 3D builder.
3. The look switch: UI sets `html[data-look="doodle"]` and imports tokens (so `--ds-paper` exists on `:root`, the same signal `web/avatar/three-scene.js`
   uses); 3D reads it (or tokens) and offers a `?doodle=0`-style fallback if it wants. Ship UI and 3D together: the UI is ink-on-paper, the night scene
   is dark.
4. Colours from `tokens.css` / `DOODLE_COLORS` only; fonts loaded by the UI's `<link>`; 3D canvas prints await `document.fonts.load()` before drawing.
5. `api.spatial.publish/setMusic/musicControl` content contract (map.js → themes.js → sakura-music.js) and `onAction`/`onShot` stay as they are.
6. Strings inside 3D files (§2.2 M) are changed by the 3D builder; nav labels change in app.js and sakura-scene.js together if ever renamed.

---------------------------------------------------------------------------------------------------------------------------------------------------

## 5. Baseline audit (current build)

* No horizontal scroll at 320/390/1440 (all states). 320×640: brand mark overlaps the 「Music Map」 wordmark; hand buttons 38 px tall (翻开 116×38,
  退一步 40×38, reset 40×38, 前往 110×38, QQ 54×38, (i) 38×38).
* Tap targets <44 px: credit-role source superscripts 6–7×15 px (go away with 来源); 「作品署名 N 位」 summary 110×34; 「署名来源」 summary ×20; open-catalogue
  footer link 146×20 and search input 254×25 (label wraps it); 「查看与X的连接」 32×44; 关于 button 38–40 px (touch area extended to ~46 px by `::after`).
  Scene name tags paint 29–31 px but carry an invisible ≥44 px hit band by design.
* Phone record shop: the 「怎么玩」 tip text is clipped at the tray's right edge; 「去 QQ 音乐听」 wraps to two lines in setlist tickets.
* The storage-conflict state is unreadable on the night scene (heading behind the warning, grey on violet) — give it a proper card.
* No page errors in any walked state (phone, desktop, WebGL off, 320).

## 6. Reported for owners outside web/original-map

* `scripts/build/static-html-plugin.mjs` (parallel workflow): map noScript/noModule sentences say 「Music Map」; COPY-PLAN calls them "already fine". If
  the map's visible name becomes 「音乐探索」, ask them to change both to 「…打开音乐探索。」 (optional, low visibility).
* `web/event-room/original-map-entry.js` (parallel workflow): offline/storage error copy for opening the map; the entry aria-label change is already in their plan.
* Doodle font script (`scripts/fonts/build-doodle-fonts.py`, outputs in `web/event-room/public/fonts/doodle/`): rerun needed only if new map copy adds
  characters never used in `web/` or new Note phrases.
* `runtime-preview/src/map-catalogue.js` must stay identical to `web/original-map/js/map-catalogue.js`; any data fix touches both and the room service.
* `web/event-room/music-map.css` is still imported by the room's `app.js` but styles the old in-app `.music-map` panel (observation only).

## 7. Reproduce

```
STATIC_OUT=/tmp/space-map/<label>/dist-pages npm run build:pages
node scripts/pages/serve-prefix.mjs /tmp/space-map/<label>/dist-pages /musicSpace/ <port>
MAP_URL=http://127.0.0.1:<port>/musicSpace/music-map/ LABEL=<label> node /tmp/space-map/tools/walk.cjs     # 40 states × phone/desktop + walk.json
node /tmp/space-map/tools/edge.cjs      # WebGL off + 320 px audit (edit BASE)   ·   node /tmp/space-map/tools/arrive.cjs   # friend link, arrival, sources
node /tmp/space-map/tools/strings.mjs web/original-map/js/*.js > strings.tsv                                  # AST string inventory
npx vite --config /tmp/space-map/tools/vite.map-dev.config.mjs --port <free>                                  # HMR dev server with Doodle fonts
```
