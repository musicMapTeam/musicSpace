# doodle-motion (dm) — the production motion library

Deterministic, frame-stepped motion graphics for the Music Space Doodle video, 1920×1080 at 60 fps, rendered by headless Chrome.
**Every frame is a pure function of the frame number**: no CSS animations, timers or `Date`; randomness is hashed from ids, the
line "boil" re-draws on a 12 fps clock. Any frame can be rendered in any order, by any worker, and comes out identical
(`node tools/render.mjs ... --determinism 12` checks it).

Files: `core.js` (time, tempo map, events, Node, Shot, camera, render loop) · `text.js` (lettering and every type recipe) ·
`objects.js` (paper objects, stickers, doodles, bursts, confetti) · `strokes.js` (marker strokes, annotations, wipes) ·
`devices.js` (phone / laptop / desk frames, frame-accurate footage, zoom keys) · `dm.css` (kit) · `stage.html` (loader) ·
`assets.json` (asset names → files, placeholders) · `assets/` (grain, stamp ink, QR) · `preview.js` (interactive look).
How to write and render an act: **`../scenes/README.md`**. Tools: **`../tools/README.md`**.

---

## 1. Time: storyboard bars, any music

Everything is written in **storyboard bar:beat** (SCRIPT.md / STORYBOARD.md: 90 bars, 4/4, 1-based). The tempo map chosen on the
URL (`stage.html?map=flipping-in&scene=...`) turns positions into seconds of the edited music bed, so a scene never changes when the
music does.

```js
DM.T('51:1')       // seconds of bar 51 beat 1 under the current map (null if that bar is cut by this map)
DM.T('4:4.5')      // the "and" of 4;  DM.T(5, 3) also works;  a number passes through as seconds
DM.Tc('15:3')      // clamped: a cut bar maps to the start of the next kept bar (never null)
DM.T('28+1:3')     // beat 3 of the bar INSERTED after storyboard bar 28 (exists only in maps that insert bars)
DM.T('91:1')       // end of the bar grid;  DM.end() = end of the film (grid + tail)
DM.beatS(), DM.barS(), DM.beats(2)   // the map's beat / bar length in seconds
DM.pos(t)          // seconds -> {sb, beat, label:'51:1.5'}
DM.credit()        // the map's music credit line (end card T146: say(sh, 'T146', { text: DM.credit() }))
```

Elastic rules (identical in `tools/tempo.py`): an element that **enters** inside a cut bar never appears; **exits, ends and keyframes**
inside a cut bar are clamped to the next kept bar; a shot that ends at a bar line which follows inserted bars stretches over them.
So write the storyboard as it is and let the map cut or stretch it.

## 2. Shots and the camera

A shot is one composition on its own paper, visible from `t0` to `t1`:

```js
const sh = DM.shot('P1-two-photos', '9:1', '13:1', {
  paper: 'dots',                      // 'dots' (default: dot grid + boiling grain) | 'plain' | false (transparent overlay layer)
  bg: 'mint-soft',                    // paper colour (default paper #f7efdf)
  drift: { s: 1.04, x: 0, y: 0 },     // PUSH over the whole shot (default s 1.04; null = none)
  cam: [['9:1', { x: 0, y: 0, s: 1 }], ['12:4.5', { x: -150, s: 1.03 }, DM.E.ioSine], ['13:1', { x: -1500, s: 1.05 }, DM.E.inExpo]],
  blur: [['12:4.5', 0], ['13:1', 60, DM.E.inQ]],    // horizontal motion blur keys (whip pans)
  enter: { kind: 'slap' | 'slide', dx: 700, dur: 0.12 },   // whole-shot entrance (slap-on / slide-on transition)
  z: 10,                              // stacking among shots (overlay layers 30-45, wipes 90)
});
sh.pulse(['9:1', '9:3', '10:1'], 0.012);          // camera bump on the kick
sh.shake('5:1', 6, 4);                            // frame shake (amp px, frames)
sh.punch('22:1', { x: 960, y: 400, s: 1.35, until: '22:3' });   // PUNCH: zoom onto a point in 4 frames, pull back in 6
sh.toScreen(t, x, y)                              // world -> screen px at time t
```

**Type layers.** Titles belong to the screen, not the paper: when a shot's camera travels (drift, push-in, whip), put the type on a
second shot with `paper: false` and its own (static, or same-whip) camera — see `scenes/act-A0-A1.js` P1/P2/P3. That keeps text
inside the title-safe area while the paper moves.

## 3. Nodes (everything on screen)

Every factory returns a `DM.Node`; all of them chain:

```js
node.in('slam' | 'pop' | 'spring' | 'stamp' | 'slap' | 'drop' | 'rise' | 'slide' | 'fade' | 'grow' | 'none', '9:3', {sfx, gain, label, ...})
node.out('pop' | 'cut' | 'fade' | 'slide' | 'shrink', '13:1', {dx, dur, sfx})
node.show('9:1', '13:1')                 // visible window without animation
node.move('12:1', '12:2', { x: -130, y: 0, r: -2, s: 0.9, o: 1 }, DM.E.outC)   // relative move, held after
node.keys([['12:1', { x: 0 }], ['12:2', { x: -130, s: 0.9 }, DM.E.outC]])        // keyframed offsets
node.pulse(['17:1', '17:3'], 0.06)  node.bob('17:3', '18:1', 12)  node.wiggle('20:3', '20:4', 6, 4)  node.float(4, 0.6)
node.drift('9:1', '13:1', { s: 1.05 })   node.track(t => ({ x, y, r, s, o }))      // any per-frame function of t
```

Common options: `x, y` (where the anchor sits), `ax, ay` (anchor inside the element, 0..1; titles default 0 / 0.5), `r` (deg),
`s`, `o`, `z` (stacking inside the shot), `parent` (a node: coordinates become local to it and it moves with it), `origin: [px, py]`
(rotate/scale pivot), `boil: false | {px, deg}`, `id`, `label`, `style`, `cls`.

Entrance timings follow STORYBOARD §1.6 at 60 fps: SLAM 1.60 → 0.95 → 1.00 in 6 frames (XL/XXL shake the frame); POP 0 → 1.15 → 1
in 8 frames with a ±4° wobble; STAMP 1.3 → 1 in 4 frames + 2-frame shake; DROP from −120 px in 10 frames; POP-OUT in 4 frames.

## 4. Type (SCRIPT.md recipes)

```js
DM.say(sh, 'T024', { x: 130, y: 958 })          // a SCRIPT.md line by id: text, font, size, recipe, entrance and in/out come from the
                                               // script; override any of them: at, until, fx, size, recipe, text, x, y, ax, r, z, parent
DM.title(sh, { text: '只有【自己】那一面。', recipe: 'ink-pink', size: 'L', x: 130, y: 958, at: '11:3', fx: 'SLAM', until: '13:1' })
DM.text(sh, { text: '每部手机里，', size: 'M', x: 130, y: 842, at: '11:1', fx: 'TYPE' })      // Marker, plain ink
DM.note(sh, { text: '你！', x, y, at: '13:4', fx: 'TYPE' })                                  // 龙藏体 pink note, -4 deg
DM.fine(sh, { text: '照片为 AI 生成的示例图', x: 1810, y: 1000, ax: 1, at: '9:1', fx: 'FADE' })
DM.stamp(sh, { text: '示例角色 · 自动回复', color: 'mint', size: 50, x, y, at: '27:3' })      // rubber stamp (-7 deg)
DM.chip(sh, { text: '示例照片 · 拍摄时间为虚构', color: '' | 'mint' | 'yellow' | 'pink' | 'hot' | 'ink', size: 36, x, y, at })
DM.logo(sh, { x, y, size: 112, r: 4, at: '6:1' })              DM.linkPill(sh, { text: 'musicmapteam.github.io/musicSpace/', at, fx: 'TYPE' })
DM.pillar(sh, { text: '隐私', color: 'mint', size: 180, x, y, at: '77:1' })                   // big word on a marker card
```

* Key words: `【自己】`, `⟦自己⟧` or `[自己]` (colour override `[自己|mint]`); set 1.4× for 1–2 characters, 1.25× for 3, 1.2× for 4+
  (a whole-line key keeps its size). Line breaks: `\n` or ` / `.
* Sizes: px or tiers `XXL 240 · XL 180 · L 128 · M 84 · S 56 · XS 36`. Fonts: `display, marker, hand, note, logo, digits`
  (SCRIPT letters D M H N L G). The product's patched font slices load first (they fix 入 / 个 / · in the Display face); QC checks
  that no character falls back to a system font.
* Recipes: `ink-pink | ink-mint | ink-yellow` (ink + colour shadow that prints 2 frames late), `ink`, `key-*`, `st-pink|mint|yellow`
  (sticker word), `hl-mint|yellow|pink` (highlighter band swiped on), `ink-dashed` (key word in a dashed box that draws on),
  `digits` (得意黑 + yellow band + pink offset), `note-pink`, `fine`; stamps, chips, pillars, link pill and logo have their own factories.
* Entrances `fx`: `SLAM, POP, TYPE` (16ths; 32nds over 10 units), `STAMP, SWIPE, SLAM+SWIPE, DRAW, DROP, FADE, NONE`.
* `title.keyRect(n)` → box of the n-th key word (after layout), e.g. to underline it:
  `DM.underline(sh, { wavy: true, at: '7:3', x0: () => t.keyRect().x0, x1: () => t.keyRect().x1, y: () => t.keyRect().y1 + 4 })`.
* `DM.fitWidth(node, 960)` shrinks a line that is wider than its column (logs a warning).

## 5. Paper objects, stickers, doodles

```js
DM.polaroid(sh, { src: 'photo:crowd', w: 440, hgt: 360, cap: '人海', tape: 'y' | 'p' | 'm' | false, x, y, r, fit: 'cover', pos: '50% 50%' })
  pol.imgToLocal(ix, iy)            // image px -> polaroid-local px (circle a raised arm in the photo)
DM.cutout(sh, { src: 'CUT-04', w: 540, hgt: 'auto', maxH: 400, crop: [x, y, w, h] })   // die-cut of real UI, height from the image
DM.sticker(sh, { src: 'avatar:you', w: 150, x, y, ay: 1 })    // die-cut around an alpha shape (avatar SVG/PNG)
DM.tape(sh, { color: 'y' | 'p' | 'm', w: 190, x, y, r })   DM.card(sh, { w, hgt, html, bg })   DM.scrap(sh, { w, hgt, color })
DM.ticket(sh, { text: '演出' })   DM.img(sh, { src, w })   DM.div(sh, { html, w, hgt })   DM.group(sh, { origin: [x, y] })
DM.deco(sh, { kind, color, size, lw })   // star heart sparkle plus squiggle arrow check note dot lock cross swaparrows clock question bang burstline
DM.pops(sh, [['star', 'yellow', x, y, size, rot], ...], '7:1', DM.beatS() / 2)   // a row of doodle pops on 8ths
DM.swap(sh, { size: 160, x, y })         // the pink ⇄ sticker
DM.burst(sh, { rOut: 330, rIn: 250, n: 20, color: 'yellow', spin: 20 }).in('grow', '5:1', { dur: 0.16 })   // comic starburst
DM.confetti(sh, { at: '51:1', x, y, n: 14 })   // payoff only
DM.ripple(sh, { at: '22:3', x, y, parent: phone })   // tap ring (+ click)
DM.stick(sh, { poses: [['5:2', 'cheer'], ['5:3', 'jump']] })   // doodle stick figure
```

**Assets by name** (`DM.asset(name)`, used by every `src`/`media`): a capture id (`CUT-04`, `P-05`, `D-02` → found anywhere under
`prod/capture/**`; a video-only capture serves its first frame as a still), an alias from `assets.json` (`photo:stage`,
`photo:crowd`, `photo:sample-crowd`, `photo:yao-stage`, `avatar:you`, `avatar:yao`, `avatar:man`, `avatar:bei`, `avatar:maichong`,
`qr` …), or a path (`/build/demo/sample-crowd.jpg` = the filmed build). Until a capture exists, its `fallback` in `assets.json`
(the animatic's crops) is served and **flagged as a placeholder** in the QC report.

## 6. Marker strokes and annotations

```js
DM.stroke(sh, { gen: r => DM.paths.curve([[x0, y0], [x1, y1], [x2, y2]], r), color: 'pink', width: 9, at: '7:3', dur: DM.beatS(), erase: '8:1', dash: [22, 18] })
DM.circle(sh, { x, y, rx, ry, at: '31:3.5', color: 'pink' })        DM.underline(sh, { x0, x1, y, wavy: true, at })
DM.arrow(sh, { from: [x, y], to: [x, y], bend: 0.25, at })            DM.bracket(sh, { x0, x1, y, h, at })
DM.check(sh, { x, y, size, at })   DM.dashed(sh, { pts, at })   DM.scribble(sh, { x, y, w, hgt, at })
DM.highlight(sh, { x, y, w, hgt, at, color: 'yellow' })              // highlighter over any rectangle (multiply)
DM.paths.loop / line / curve / wave / zigzag / rrect / arrow / bands   // path generators (r = seeded random -> boils per step)
```

Coordinates may be functions (`x: () => ...`, evaluated at draw time after layout). With `{ on: phone }` they are **source pixels
of the footage** and the stroke stays glued to the UI through zooms and punches (width stays constant on screen).

## 7. Devices and footage

```js
const clip = DM.clip('P-05')                                     // a capture (prod/capture/**/P-05.mp4) or a path
DM.play(clip, { at: '29:1', from: 2.5, rate: 1 })                // source second = from + (t - T(at)) * rate ; from: 'f150' = frame
DM.ramp(clip, [['31:1', 4.0], ['31:3', 4.9], ['32:1', 5.0, DM.E.outC]])   // keyframed source time: speed ramps, freezes
DM.seq(DM.play(a, {...}), '31:3', DM.play(b, {...}), '33:1', 'CUT-04')    // hard cuts between feeds / stills on the beat (X5)
const ph = DM.phone(sh, { media: clip-feed | 'CUT-04', x: 560, y: 545, r: -2, w: 480, shadow: 'mint',
                          view: [['29:1', { s: 1 }], ['30:1', { s: 1.8, x: 540, y: 1600 }, DM.E.outExpo]] })
ph.punch('32:1', { s: 2, x: 330, y: 1605 }, { until: '33:1' })   // 4 frames in, 6 frames back
ph.toWorld(t, sx, sy)                                            // source px -> shot px (arrows from a title to the UI)
DM.laptop(sh, {...})  DM.desk(sh, { media: 'D-02', w: 1800 })  DM.screen(sh, {...})   // L4 desk = taped ink frame
```

* Phone: body 480 wide, 24 px bezel, screen 432×936 for a 1080×2340 capture (the capture at 0.4); punch-ins up to ×2.5 stay sharp.
* Zoom keys: focus `x, y` in **source pixels**, or `u, v` as fractions of the source when the capture resolution may change.
* Footage frames are extracted lazily by the server (2 s windows, cached in `tools/.cache/frames`), shown as JPEG and awaited before
  every screenshot — no stale frames. A 60 fps capture played at `rate: 1` advances exactly one source frame per output frame.

## 8. Transitions

```js
DM.wipe('W-A0-title', '4:4.5', '5:1', { colors: ['pink', 'yellow'] })   // X1 scribble wipe: covers in ~4 frames, wipes off from the downbeat
DM.markerWipe('W2', '20:4.5', '21:1', { colors: ['mint', 'yellow'], n: 4 })   // marker bands paint across and lift off
{ enter: { kind: 'slap' } } / { enter: { kind: 'slide', dx: 700 } }           // slap-on / slide-on of the next shot (shot option)
sh.punch(...)  ph.punch(...)                                                  // punch-in zoom
cam whip + blur (section 2)                                                   // X2 paper pan / whip
```

While a wipe covers the frame the QC does not count text as readable (`DM.coveredAt(t)`).

## 9. The event log (drives SFX and QC)

Every entrance, draw, swipe, type-on, wipe, tap, confetti and punch logs `{t, kind, label, pos, sfx, gain, pan, note}` into
`DM.events` (`node tools/render.mjs --info` writes it). `tools/sfx.py` places one synthesized sound per event:
`slam` → impact (XL/XXL) or slam, `pop` → pop, `stamp` → stamp, `slap` → paper slap, `type` → one tick per character,
`swipe` → highlighter, `draw` → marker squeak, `wipe` → whoosh, `tap` → click, `confetti` → crackle, `punch` → thump.
Override per call: `{ sfx: 'tape' | 'scribble' | 'pencil' | 'chime' | 'swell' | ... }`, silence with `{ sfx: 'none' }`, level with
`{ gain: -6 }` (dB), pitch with `{ note: 3 }` (semitones). Sound-only cues: `DM.sfx('31:3', 'chime')`, `DM.sfx('19:1', 'riser', { dur: 3.9 })`.
Named marks for tools: `DM.mark('qr', '86:1')` (the QC decodes the QR there).

## 10. Rules of thumb (STORYBOARD §2)

Cuts and first titles on beat 1, second titles on 3, pops / stamps / taps on 2 and 4 or on 8ths, transitions start on the "and" of 4;
never more than ~2.5 beats without a visual event; every shot keeps moving (default drift + boil). Max 2 layered titles + 1 plain line
at once. Text stays inside the 5 % title-safe area (x 96–1824, y 54–1026) and never sits on a dark photo — put it on paper, or on a die
card over footage. AI concert images always carry 「照片为 AI 生成的示例图」 on screen.
