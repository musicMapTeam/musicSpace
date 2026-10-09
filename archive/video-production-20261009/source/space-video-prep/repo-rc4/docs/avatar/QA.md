# Avatar Studio validation checkpoint

Updated 2026-09-30 08:50 UTC. This is an implementation checkpoint, not a completed visual acceptance or public release.

## Verified source and preservation

- Current source baseline: main `54f3e6ee2a8613ef3ae0d38c2472dff0b7a708a5` (PR #1)
- Current preserved Pages baseline: gh-pages `e28fab5df54852d4398bb7b403e476faf43ac168`
- At first the deployed `7c962e2` source was unavailable. The user's concurrent push subsequently restored `feat/moment-ai`; full source is now merged into this feature branch. The earlier source gap is resolved
- Original web/index.html, web/js, web/css, vite.config.js and server/db.js remain unchanged from current main
- Rebuilt legacy root HTML SHA-256: `e8c8fc96269fd61580f499f6409209da1f137d398c34de64c5aec676ad9df104`, exactly matching the preserved Pages root
- The avatar feature is isolated at `/avatar/`; no live root or existing AI resource has been overwritten

## Passed locally

- Full 0.16 build: 62 modules; legacy HTML 1,754,470 bytes
- AI asset validation: model 8,807,127 bytes, wasm 14,239,897 bytes, correct three runtime files
- Legacy rule, insight and API suites: all assertions passed
- Avatar production build: 20 modules; 1,557,738-byte self-contained HTML including real Three/cel renderer
- Avatar Node API: 24 real HTTP integration tests passed (17 permissions/concurrency + 7 modular-schema cases)
- Avatar frontend state: 36 VM-backed regression tests and 6 component-model tests passed
- Worker adapter: 33 tests passed using real SQLite behind asynchronous D1 and private R2 fakes, including fresh Worker instances, concurrent joins, conditional mutation guards, stale consent, photo ownership, transport loss after commit, and uncertain-commit cleanup
- Drizzle-generated initial migration and its metadata produced using drizzle-kit 0.31.10 / drizzle-orm 0.45.2; generated schema used in the 33 Worker tests
- Original scene images visually inspected as assets: no people, no text, clear avatar placement space, coordinated night palette

These tests verify real application logic and HTTP permissions. They do not substitute for rendered browser, actual Cloudflare runtime, or physical-device evidence.

## Hosted runtime checkpoint

A separate public runtime preview is deployed after explicit user permission from the same avatar frontend and Worker API, using D1 and private R2. Existing GitHub Pages is unchanged. Exact Site/version/deployment identifiers are recorded in `runtime-manifest.json`; reuse that Site, never recreate it.

Deployment v4 succeeds. Real hosted API/D1/private-R2 smoke on v3: 13 checks passed (see `evidence/hosted-api-smoke.json`), with independent synthetic HTTP clients. These are not two-browser or physical-device claims.

First authorized local GPU QA used Intel UHD 770 / ANGLE / WebGL2. Six presets, poses, tilt, 390×844 layout and two actual 1440×1920 PNG files ran without page exceptions, but visual acceptance **failed**: characters looked too juvenile, dark-skin eyewear lacked clarity, and an uploaded photo appeared gray in the editor while export was correct. The same build is not called polished. Evidence is a separately saved QA ZIP; private input references are not committed.

V4 contains elongated revised meshes, clearer face/eyewear planes, photo-preview compositing fix, and modular wardrobe UI. Repeat local GPU review on v4 completed. Two genuinely independent browser contexts created an invitation, blocked joining without consent, joined with distinct avatars, required host acceptance and both separate save permissions, and downloaded two 1440×1920 PNGs. The 44 component and 33 colour state-independence checks passed; reload preserved the selected identity; 390×844 touch emulation had no horizontal overflow. Uploaded synthetic photo now appeared in both preview and export. No page exceptions were reported. This is still not physical-device testing or exhaustive visual pairwise acceptance.

V4 visual acceptance remains **failed**: block-like shoes, shirt backing/raised-sleeve seams, weak darkest-skin mouth contrast, and old SVG participant thumbnails disagreed with the stage identity. Local corrections now use the same mesh for summaries, coherent covered tops and slimmer shoes. These are not deployed or pixel-verified yet. New asynchronous regressions also cover consent-bound invitation targets, conflict recovery, latest private-draft restoration, late mutations, and navigation. Current total: 105 avatar tests + 33 Worker tests pass.

Cloud Chrome disables WebGL and correctly shows a labeled 2D fallback. Its v4 drawer at a 390×844 iframe viewport has matching 390px content/client widths and an in-viewport fixed Save/Cancel footer. Desktop Cancel returns focus to the profile button. These checks do not establish 3D pixel quality or physical touch behavior.

The user subsequently granted explicit public-preview permission. Existing GitHub `/avatar-preview/` was added as a link to the runtime at commit `192ad9e`; legacy root and AI resources remain unchanged. Public availability is not final acceptance.

## Visual implementation

- True 3D original sets and modular articulated fashion silhouettes, using the existing licensed Sakura Crossing cel/colored-shadow/depth-ink renderer
- Schema v2: 8 hair, 6 eyewear, 6 tops, 6 bottoms, 4 shoes, 6 accessories; 4 expressions and 4 poses; 8 independent garment colours. Six presets initialize outfits, while one-part edits preserve other fields and presets preserve skin/expression/pose
- 39 structural renderer tests cover 36 top/bottom pairs, 48 hair/eyewear pairs, accessories/expressions/colours, photos and lifetime. They use a mocked GPU surface: finite geometry is not visual or clipping acceptance
- Same-mesh portrait capture and fixed 3:4 camera; native 1440×1920 scene capture for PNG export
- Editorial fallback with sharp hair, glasses, lidded eyes and long limbs; `evidence/fallback-sheet.png` is explicitly a rendered SVG fallback sheet, not 3D or browser evidence
- Initial cute avatar was replaced following the user's supplied cover-style reference. No raw user reference image is published

## Fixed by independent review and covered by regression tests

- Visible unsaved edits cannot be discarded by accepting, consenting, or exporting a different shared snapshot
- Private draft survives opening/joining/switching invitations and saved shared works
- Host invitation creation survives reload with a stable work route and authorized photo retrieval
- Identity survives malformed draft JSON and migration to its own small storage key
- Malformed stored values no longer crash initial render
- API mutation body and idempotency key are frozen before asynchronous work; retries reuse the key after transport loss/reload
- Late invitation responses cannot replace a newer navigation
- Photo cache refreshes by content revision
- Guests can clear their response, edit only their own avatar, and withdraw
- Mobile pose controls, explicit profile-button label and larger text/touch targets added by code review

## Remaining full browser acceptance checklist

- [ ] First creation: empty name, long name, all avatar options, save, Cancel, Escape, backdrop, focus return
- [ ] Scene edit: all scenes, own JPEG/PNG/WebP, oversized/invalid input, pose, drag, touch, keyboard arrows, scale, rotation, undo/redo, typed-field undo
- [ ] Local persistence: refresh, reopen collection, new draft, return from shared work, storage quota error, malformed storage
- [ ] Original audio: play/pause/change track, background tab, reduced motion, no autoplay
- [ ] Invitation: host creation, copy/reopen stable link, fresh independent browser guest, same-identity link, expired/full/revoked link
- [ ] Guest contribution: own avatar and reply, explicit join consent, duplicate click, lost response retry, exit
- [ ] Review/consent: host acceptance/rejection, guest changes, stale revision conflict, both separate consents, withdrawal of consent
- [ ] PNG: solo and jointly authorized exports, uploaded photo integrity, fictional-artist attribution, dimensions, successful downloaded bytes
- [ ] Network: offline before save, during creation, before guest join, during consent, reconnect without losing draft
- [ ] Layout: desktop 1440×900 and 1180×757; mobile 390×844 and 320×568, no horizontal overflow, all primary controls reachable
- [ ] Keyboard and screen reader: meaningful names, focus visibility/order, dialog exit, status/error announcements
- [ ] Final hosted D1/R2 runtime, private photo endpoint denial, independent identities and persistent reload

No physical-device test, real-user study, award submission or award outcome is claimed.


## Product direction review

The user clarified the product as a livehouse opening a room for an event, where attendees enter with their little characters, exchange selected photos by consent, and optionally connect. The avatar editor is supporting capability, not the homepage product. `design-preview/livehouse-flow.html` is a self-contained four-screen clickable design sketch for direction review only. All participants, pictures, codes, and requests are explicitly fictional, and the file makes no external requests. No event backend has been added. Public v4 remains unchanged while the user reviews the direction.
