# GitHub Pages tree: build, serve, verify, publish

Everything that puts the product on <https://musicmapteam.github.io/musicSpace/> (and, for testing, on `/musicSpace/preview/`)
from **one build**. The Node room server and its `npm run build:all` bundles are separate and untouched by this folder (apart from
the two base-path edits listed under "Links that survive a sub-path").

## The tree

`npm run build:pages` writes `dist-pages/` (git-ignored; `STATIC_OUT=<dir>` overrides, and the directory is emptied first):

| Path | What it is | Built by |
| --- | --- | --- |
| `index.html` | the event room, static profile, as the **site root** (one 2.2 MB file; scripts and styles inline) | `vite.static.config.js` |
| `music-map/index.html` | the original Map, links relative to the site root | `vite.static-map.config.js` |
| `classic/index.html` | the 0.16 root app, unlinked; the cheapest fallback; its `ai/` is the shared `../ai/` (`<meta name="space-ai-base">`) | `vite.config.js` through the Vite API, `copyPublicDir:false` |
| `ai/` | model pack and onnxruntime-web files, **one copy for the whole site** (23 MB raw, about 10 MB on the wire) | copy of `web/public/ai` after `npm run ai:ort` |
| `shared/three-0.186.1/` | `three.module.js` + `three.core.js`, imported by the room and the Map | `scripts/build/shared-three.mjs` |
| `sql/sql-wasm.wasm`, `sql/LICENSE-sql.js-MIT.txt` | sql.js 1.14.2 wasm, fetched from the page's own origin | `vite.static.config.js` |
| `demo/` | the showcase photos and `manifest.json` (from `web/static-runtime/demo-assets`; the build warns and skips it when that manifest is missing) | `scripts/pages/build.mjs` |
| `build.json` | `{version, commit, builtAt, files: [{path, bytes, sha256}]}`: the identity of these bytes. **No channel.** | `scripts/pages/build.mjs` |
| `.nojekyll` | | |

The build empties its output directory first and therefore refuses any `STATIC_OUT` that is not empty, not the repository's own
`dist-pages`, and not the output of an earlier build (no `build.json` / `.nojekyll`). `STATIC_BUILT_AT=<ISO date>` and
`STATIC_COMMIT=<sha>` pin the build identity: two builds of the same sources with the same pins are byte-identical (tested), which is
how a rebuild of a commit can be compared with a published tree.

Root and `preview/` are **the same bytes**: the page derives its channel from its URL (a path ending in `/preview/` is the preview;
anything else is the root), which names its IndexedDB database `music-space-static:<channel>:v1`. That is what lets the switch copy the
tested preview tree to the root instead of building again.

### What the static HTML plugin does (`scripts/build/static-html-plugin.mjs`)

- moves the 2 MB inline module script from `<head>` to the end of `<body>`, so the loading screen paints first;
- starts the downloads early: `modulepreload` for both three.js files, `preload as=fetch crossorigin` for `sql/sql-wasm.wasm`;
- sets the title and the metas the page reads: `space-site-root` (`./`, `../` for the Map), `space-event-room`, `space-build`
  (`<version>+<commit>`), `space-ai-base` (`./ai/`);
- adds a classic (ES5) **rescue script** before the module script runs: after 30 s without `window.__SPACE_BOOT__ === 'ready'`, or at
  once when a module script fails to load, or when the boot calls `window.__SPACE_RESCUE__.show(reason)`, an overlay 「页面没能完整启动」
  offers 重新载入 / 重新开始 and links nowhere (`classic/` stays in the tree, unlinked); the reason (`timeout`, `failed:<code>`,
  `script-load-failed`) is kept in the overlay's `data-reason` attribute for QA, not shown. 重新开始 deletes this channel's IndexedDB database and the
  `RESCUE_PURGE_PREFIXES` localStorage keys (never `music-space-map-*`, `music-map-*`, `music-space:v1`, `music-space-live:v1`,
  `music-space-duet-seen:v1` or Cache Storage), then reloads the bare path. A page that finishes booting late removes the overlay itself;
- adds `<noscript>` and `<script nomodule>` messages for browsers that cannot run the page;
- (room page only) rewrites the three server-flavoured confirmations (「服务器已确认」, 「服务已确认」 -> 「已确认」; 「服务已收到」 -> 「已收到」)
  to what is true in a page-only site. Each rule must match at least once or the build fails; see `COPY_RULES`.

## Commands

```sh
npm run build:pages                        # build into dist-pages/ (about 2-15 s)
npm run preview:pages                      # serve dist-pages at http://127.0.0.1:4783/musicSpace/ (like Pages: 404 outside the prefix)
node scripts/pages/serve-prefix.mjs <dir> <prefix> <port>
node scripts/pages/verify-tree.mjs dist-pages
node scripts/pages/verify-tree.mjs https://musicmapteam.github.io/musicSpace/preview/     # polls until the deploy is live
node scripts/pages/publish.mjs --channel preview                  # dry run
node scripts/pages/publish.mjs --channel preview --push
node scripts/pages/publish.mjs --channel pages --from-preview     # dry run of THE SWITCH
node scripts/pages/publish.mjs --channel pages --from-preview --push
npm run test:static                        # Worker-mode suite on sql.js + scripts/test/static-build.test.mjs
```

### `serve-prefix.mjs <dir> [prefix=/musicSpace/] [port=4783]`

Serves `<dir>` only below `<prefix>`; any other path (`/`, `/api/...`, a stray root-absolute `/shared/...`) is a 404, as it would be on
github.io. A directory without its trailing slash redirects, a directory serves its `index.html`, only GET and HEAD are answered,
responses are `no-store`. QA helpers: `GET /__log` returns the requests seen (`"GET /musicSpace/"`, queries not recorded) and
`GET /__clear` empties it, so a browser run can assert "no `/api` line". To emulate both channels in one server, copy the tree into a
folder that also holds a `preview/` copy of itself and serve that folder at `/musicSpace/`. Pick a free port in 47100-47999 for QA.

### `verify-tree.mjs <dir|url> [options]`

Checks: required files; every file in `build.json` exists with the stated size and sha256 (and, for a directory, nothing else is
there); the room HTML is under 3.5 MB; no root-absolute `from"/shared/`, `location.assign('/music-map…')`,
`startsWith('/event-room/')` navigation; the metas and the preload hints; the first module script comes after `<body>`; the model pack
has the sizes `labels.json` states and `ai/ort/` holds exactly the three runtime files; `classic/` has no `ai/` of its own; the page's
`space-build` meta equals `build.json`.

| Option | Meaning |
| --- | --- |
| `--same-as <dir\|url>` | `index.html` must be byte-identical (sha256) to the other tree's (preview vs root) |
| `--index-sha256 <hex>` | `index.html` must have exactly this sha256 (a value recorded when the other tree still existed); URL mode polls until the served `build.json` lists it, and then does not consult `./dist-pages` |
| `--expected <dir\|url\|none>` | URL mode: poll until the served `build.json` equals this one (default `./dist-pages` when it exists) |
| `--require-demo` | `demo/manifest.json` must exist (`publish.mjs` always asks for it) |
| `--quick` | URL mode: files over 1 MB are only proven to exist, not downloaded |
| `--ignore <prefix>` | directory mode: do not judge files below this prefix (a gh-pages checkout: `--ignore avatar-preview/ --ignore .git/`) |
| `--timeout <min>`, `--interval <s>`, `--no-poll` | URL polling budget (default 10 min, every 15 s) |
| `--json` | machine-readable result |

GitHub Pages lags a push by a minute or more and its CDN may keep an old `build.json` for 10 minutes (`max-age=600`), so URL mode
adds a cache-busting query to every request and waits for the expected build before it judges anything. It prints the sha256 of
`index.html` and `build.json`: record them in the QA evidence when verifying the preview, and pass the index hash to `--index-sha256`
when verifying the root after the switch (the preview is gone by then). Exit code 0 only when every check passes.

### `publish.mjs --channel preview|pages [--from-preview] [--push]`

Works in a temporary git worktree of `origin/gh-pages` (fetched first); a **dry run unless `--push`**; never force-pushes (a push that
is not a fast-forward is refused and nothing is overwritten). It verifies the tree first (`verify-tree`, demo required) and refuses
a tree that fails.

- `--channel preview`: replaces `preview/` with `dist-pages` and touches nothing else.
- `--channel pages`: replaces the site root (everything except `avatar-preview/`, `preview/` and `.git`) and **removes `preview/` in
  the same commit**.
- `--channel pages --from-preview`: the new root is the tree that `gh-pages` already holds at `preview/` (copied out, verified against
  its own `build.json`), so the bytes that were tested are the bytes that ship. Refused when `preview/build.json` is missing.
  `dist-pages` is not needed.
- The commit message is `pages: publish <channel> <sha>` with the source commit from `build.json`; the dry run prints per-directory
  counts and the diff stat; it refuses a preview publish that would change anything outside `preview/`, or any publish that would change
  `avatar-preview/`.

Options: `--dist <dir>` (default `dist-pages`), `--repo <dir>` (default `.`), `--remote origin`, `--branch gh-pages`, `--allow-no-demo`
(experiments only), `--no-verify` (emergencies only; prints a warning).

## Release order (architecture section 12)

1. Everything merges into `main`; CI is green on the exact commit. Build from `main`: `npm run build:pages`.
2. `publish.mjs --channel preview` (read the dry run), then `--push`; `verify-tree.mjs https://musicmapteam.github.io/musicSpace/preview/`
   (polls). Record the `index.html` and `build.json` sha256 in `docs/event/evidence/static-pages-qa.md`.
3. The device pass runs on `/preview/`. If anything changes afterwards, republish the preview and run the smoke again.
4. Only after the user's explicit go: `publish.mjs --channel pages --from-preview` (dry run), then `--push`; then
   `verify-tree.mjs https://musicmapteam.github.io/musicSpace/ --index-sha256 <recorded>`; `/api/event/health` must be a 404.

## Rollback

A rollback is a **new commit** that restores an earlier tree; never `git push --force`. The last 0.16 root is commit `192ad9e`
("build: add isolated avatar preview link preserving legacy app"), whose tree has `index.html`, `ai/`, `avatar-preview/` and
`.nojekyll`:

```sh
git fetch origin gh-pages
git worktree add --detach /tmp/pages-rollback origin/gh-pages
cd /tmp/pages-rollback
git read-tree -u --reset 192ad9e          # index and files become exactly that tree (files that are not in it are removed)
git commit -m "pages: rollback to 192ad9e"
git rev-parse HEAD^{tree} 192ad9e^{tree}   # the two must print the same hash
git push origin HEAD:gh-pages              # a normal fast-forward push
cd - && git worktree remove --force /tmp/pages-rollback
```

(Verified in a scratch repository on 2026-10-05.) A rollback is a second switch: Pages sends `max-age=600`, and browsers that
visited the new root keep their IndexedDB data, which the old page never reads.

## Shared origin, neighbours

`musicmapteam.github.io` is one origin for **every** path: `/musicSpace/` (root), `/musicSpace/preview/`, `/musicSpace/classic/`,
`/musicSpace/music-map/`, the standalone Map at `/musicMap/` and `/musicSpace/avatar-preview/`. `localStorage`, IndexedDB and Cache
Storage are shared by all of them, not separated by path.

- IndexedDB names are per channel (`music-space-static:pages:v1`, `music-space-static:preview:v1`); `localStorage` keys are not, so
  flipping between root and preview restarts the client identity (accepted; the preview disappears at the switch).
- Never clear Cache Storage (`music-space-ai-v1`, the model pack, is shared with the 0.16 page) and never touch keys that start with
  `music-space-map-` or `music-map-`; the purge list is `RESCUE_PURGE_PREFIXES` and must equal the storage guard's list
  (`tests/static-prefix-sync.test.js`).
- `/musicSpace/avatar-preview/` is a third-party redirect page that this tooling never touches (`publish.mjs` refuses to change it).
  Its 「返回原樱下现场」 link is `../`, which after the switch is the new site root, not the 0.16 page.
- Pages sends `max-age=600`: after a publish, a browser may show the previous page for up to ten minutes; QA adds `?v=N` to the
  **first** load only (the room page keeps the address as exactly `?room=CODE` after joining).

## Links that survive a sub-path

The only root-absolute URLs in the product were `location.assign('/music-map/#/explore')` (`web/event-room/original-map-entry.js`), the
Map's "back to the scene" check (`web/original-map/js/space-bridge.js`: the return address had to start with `/event-room/`) and the
shared three.js URL (`scripts/build/shared-three.mjs`). They now read `web/shared/site-base.js`: `siteUrl(path)` resolves against the
`space-site-root` meta (default `/`, so the Node server behaves exactly as before) and `eventRoomReturn()` accepts a stored return
address only when it is on this origin and is the path of `eventRoomUrl()`. `shared-three.mjs` takes `{publicPath, outDir}`; the
defaults reproduce `build:event` and `build:map`.
