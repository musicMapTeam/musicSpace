# Writing an act

An act is one JavaScript file in this folder (`act-A2.js`, `act-A3.js`, … — `act-A0-A1.js` is the worked example). It builds shots
with the doodle-motion API (`../dm/README.md`) in **storyboard bar:beat** — never seconds — so the same file plays under every music
option. You never call the renderer from the scene; the tools load it.

## One command: render the act with its music, QC it, contact sheet

```sh
cd /tmp/space-video-doodle/prod
tools/act.sh act-A2                         # bars from the name (A2 = 21:1 -> 29:1), music = flipping-in
tools/act.sh act-A2 tea-party               # same act under another music option (tools/tempo-maps/*.json)
tools/act.sh act-A4 flipping-in 49:1 53:1   # only a bar range (end exclusive)
```

Output `out/acts/<scene>.<map>.mp4` (1080p60 H.264 + AAC: the edited music bed + synthesized SFX from your events), plus
`.qc.txt` (read it), `.contact.png` (one frame per bar), `.info.json` (your event log), `.mix.wav.json` (loudness). An act of 8–14
bars renders in a few minutes; run long ones in the background (`tools/act.sh act-A5 > /tmp/a5.log 2>&1 &`). Env knobs: `WORKERS`
(default 4 — the machine is shared with the capture passes), `CRF`, `PRESET`, `STRIDE`.

Faster loops while laying out:

```sh
node tools/render.mjs --scene act-A2 --map flipping-in --stills 21:1.3,22:1.5,23:3,24:4.5 --dir out/stills   # PNG stills at positions
node tools/render.mjs --scene act-A2 --map flipping-in --info /tmp/a2.info.json                                  # just the event log / warnings
node tools/render.mjs --scene act-A2 --map flipping-in --at 23:3 --eval "DM.shots.map(s => s.id)"               # inspect state at a frame
open "http://127.0.0.1:<port>/dm/stage.html?map=flipping-in&scene=act-A2&preview=1"   # with `node tools/serve.mjs <port>` running:
                                                                                     # scrub / play with the music (not frame-exact)
```

## The file

```js
/* ACT A2 · ENTER — bars 21-28.  SCRIPT T041-T049, STORYBOARD E1-E4. */
(() => {                                          // wrap everything: all acts share one page in the full-film render
  const E = DM.E, beat = DM.beatS(), say = DM.say;

  const sh = DM.shot('E1-phone', '21:1', '23:1', { drift: { s: 1.04 } });          // shot ids must be unique across the film
  const ty = DM.shot('E1-type', '21:1', '23:1', { paper: false, z: 30, drift: null, log: false });   // static type layer
  sh.pulse(['21:1', '21:3', '22:1', '22:3'], 0.014);
  const ph = DM.phone(sh, { media: DM.play(DM.clip('P-01'), { at: '21:1', from: 1.0 }), x: 560, y: 560, r: -2, shadow: 'mint',
    view: [['21:3', { s: 1 }], ['22:1', { s: 1.35, u: 0.5, v: 0.62 }, E.outExpo]] });
  ph.in('rise', '21:1', { dur: 0.35 });
  DM.ripple(sh, { parent: ph, at: '22:3', x: 238, y: 760 });
  say(ty, 'T041', { x: 960, y: 300 });                                             // words, size, recipe, in/out from SCRIPT.md
  say(ty, 'T042', { x: 960, y: 520 });
  DM.wipe('W-A2-x', '22:4.5', '23:1', { colors: ['mint', 'yellow'] });
})();
```

Rules that keep acts composable:

1. **Positions in bar:beat** (`'22:3'`, `'22:4.5'`); seconds only for tiny offsets. Shot `t0/t1` on bar lines (`'21:1'`, `'23:1'`).
   The next act's first shot starts exactly where yours ends; a wipe across the boundary belongs to the outgoing act.
2. **Words come from SCRIPT.md**: use `DM.say(shot, 'T0xx', {x, y})` for every narration line, so text, size, recipe, entrance and
   in/out stay identical to the approved script; QC lists script lines in your range that never appeared. Labels/notes that are not in
   the script (chips on the UI, handwritten captions) use `DM.text/chip/stamp/note` and must be true to the product (SCRIPT §4).
3. **Type on paper, not on footage**: titles sit beside the phone/desk; over desktop footage put text on a die card (`DM.card`).
   Keep text inside x 96–1824, y 54–1026 (QC fails text outside for more than 0.5 s). If the camera travels, put titles on a static
   type layer (second shot with `paper: false`).
4. **Rhythm**: cuts / first titles on 1, second titles on 3, pops / stamps / taps on 2 and 4 or 8ths; transitions start on the "and"
   of 4. QC fails a gap over 2.5 s between visual events and lists events off the 16th grid.
5. **Product imagery by capture id** (`'P-05'`, `'D-02'`, `'CUT-04'`): the server finds the capture team's files under
   `prod/capture/**`; until they exist you get a flagged placeholder. Real waits in the product are cut on the beat (`DM.seq`), never
   shown as dead time. Use the AI concert photos only with 「照片为 AI 生成的示例图」 on screen.
6. **Sound**: every entrance already makes its sound (see `../dm/README.md` §9). Add `{ sfx: 'tape' }`, `{ sfx: 'none' }`,
   `{ gain: -6 }` where the storyboard's SFX column asks for something else; sound-only cues with `DM.sfx('31:3', 'chime')`.
   With the original score (`original-124`) its chime, dings and riser are in the music: the SFX tool drops those automatically.
7. **Unique ids**: shot ids, wipe ids, confetti ids must be unique in the whole film (prefix them with your act).
8. **Deterministic**: no `Math.random`, `Date`, timers or CSS animations — use `DM.rand(...)`, tracks and keyframes.

## Elastic cuts (other music options)

Maps for slower/faster tracks remove or insert storyboard bars (STORYBOARD §5): `tea-party` cuts 8, 15–16, 36, 40, 71–72, 81, 89–90;
`love-love-love` cuts 15–16, 40, 71–72, 89–90; `grab-a-partner` and `consternation` insert a bar after 28, 54 and 90 (`'28+1:1'`).
You do not need to handle this: elements that start in a cut bar never appear, exits are clamped, a shot ending on the bar after an
inserted bar stretches over it. To give an inserted bar its own content, address it as `'28+1:1'` … `'28+1:4.5'` (it is ignored by maps
without it). Check your act under one cutting and one inserting map before you hand it in:
`tools/act.sh act-A3 tea-party` and `tools/act.sh act-A3 consternation`.

## The full film

`tools/film.sh [map]` loads every `scenes/act-*.js` in name order into one page and renders the whole cut (≤ 175 s) with
`--target-mb 150-300`, the full-film mix normalised to −16 LUFS, then runs the full QC (duration, size, QR, …).
