/* Music Space · Doodle video — ACT A0 HOOK (bars 1-8) + ACT A1 PAIN (bars 9-20).
 * Words: SCRIPT.md T001-T013, T020-T033 (DM.say pulls text, font, size, recipe, entrance and in/out from script/out/timeline.json).
 * Pictures and beats: STORYBOARD.md H1 (collage), H2 (title card), H3 (match cut into the real landing page), P1 (two photos, two
 * phones), P2 (the best photo of you is on a stranger's phone), P3 (the people next to you walk away; what if it could be swapped?).
 * Everything is written in storyboard bar:beat; the tempo map (?map=...) decides the seconds, so the act follows any music option.
 * Product imagery: CUT-01..08 and D-01 resolve to prod/capture/** when the capture pass has delivered them, otherwise to the animatic's
 * crops of the restyled build (flagged as placeholders by tools/qc.py).  Concert photos are the repo's two AI images, labelled on screen.
 */
(() => {
  const E = DM.E, lerp = DM.lerp, clamp = DM.clamp;
  const beat = DM.beatS();
  const say = DM.say;

  // ======================================================================= A0 · H1 · COLLAGE · 1:1 -> 5:1 (L7)
  // 8 real product moments slap onto the paper on 1 and 3 (the kick), a rubber stamp lands on the next beat (the snare);
  // the camera starts tight on the first card and pulls back as the page fills.
  {
    const first = [600, 330];
    const F0 = (sc, k) => ({ x: (960 - first[0]) * sc * k, y: (540 - first[1]) * sc * k, s: sc });
    const sh = DM.shot('H1-collage', '1:1', '5:1', { drift: null, cam: [
      ['1:1', Object.assign(F0(1.5, 1), { r: -2 })], ['1:2.5', Object.assign(F0(1.42, 1), { r: -1.6 }), E.ioSine], ['1:3', Object.assign(F0(1.22, 0.62), { r: -1 }), E.outExpo],
      ['1:4.5', Object.assign(F0(1.18, 0.55), { r: -0.8 }), E.ioSine], ['2:1', { x: 0, y: 0, s: 1.0, r: 0 }, E.outExpo],   // v2: pull-backs start on the "and" (v1 1:2.6 / 1:4.6)
      ['4:3', { x: -4, y: 2, s: 0.985, r: 0.2 }, E.ioSine], ['5:1', { x: -6, y: 4, s: 0.98, r: 0.3 }]] });
    sh.pulse(['1:1', '1:3', '2:1', '2:3', '3:1', '3:3', '4:1', '4:3'], 0.014, 0.08);
    DM.scrap(sh, { w: 780, hgt: 520, color: 'yellow', x: 610, y: 350, r: -7 }).in('slap', '1:1', { big: 1.08, spin: -3, log: false });
    DM.scrap(sh, { w: 640, hgt: 430, color: 'mint', x: 770, y: 800, r: 4 }).in('slap', '2:3', { big: 1.08, log: false });
    DM.scrap(sh, { w: 520, hgt: 540, color: 'pink', x: 1640, y: 790, r: -4 }).in('slap', '3:3', { big: 1.08, log: false });
    // [card time, factory, script line of its stamp, stamp time, stamp position]
    // v2 (review read #6): the stamps are opaque labels now (card fill, a coarser ink mask, darker ink, 70 px): v1's half-transparent
    // fill let the UI under 视角 / 同一刻 / 招手 / 交换 show through (2.6-3.2:1); 换装 / 视角 / 同一刻 / 交换 / 招手 / 上墙 moved to the
    // cards' edges and the paper around them, where nothing lands on them later
    const STAMP_INK = { yellow: '#8a6a00', pink: '#cf2a5b', mint: '#13806a' };
    const stampStyle = c => ({ background: 'var(--card)', color: STAMP_INK[c], webkitMaskSize: '900px 450px', maskSize: '900px 450px', boxShadow: '4px 5px 0 rgba(28,27,26,.9)' });
    const cards = [
      ['1:1', () => DM.polaroid(sh, { src: 'CUT-01', w: 680, hgt: 440, cap: '回声现场', x: 600, y: 330, r: -4, z: 5, pos: '42% 50%', label: 'CUT-01 3D room' }), 'T001', '1:2', [860, 505, -8]],   // v2 (owner 0b): the caption without 「· 示例场」
      ['1:3', () => DM.sticker(sh, { src: 'CUT-02s', w: 236, x: 1125, y: 330, r: 4, z: 6, label: 'CUT-02 avatar' }), 'T002', '1:4', [1065, 134, 7]],
      ['2:1', () => DM.polaroid(sh, { src: 'CUT-03', w: 470, hgt: 340, x: 300, y: 735, r: 5, z: 7, label: 'CUT-03 3D wall', tape: 'p', tapeW: 150, pos: '50% 34%' }), 'T003', '2:2', [218, 548, -6]],
      ['2:3', () => DM.cutout(sh, { src: 'CUT-04c.opaque', w: 470, hgt: 'auto', maxH: 430, x: 790, y: 790, r: -3, z: 8, label: 'CUT-04 AI chip' }), 'T004', '2:4', [925, 954, 6]],
      ['3:1', () => DM.cutout(sh, { src: 'CUT-05', w: 470, hgt: 'auto', maxH: 360, x: 1560, y: 255, r: 3, z: 9, label: 'CUT-05 badge' }), 'T005', '3:2', [1640, 462, -7]],
      ['3:3', () => DM.cutout(sh, { src: 'CUT-06', w: 390, hgt: 'auto', maxH: 430, x: 1655, y: 765, r: -5, z: 10, label: 'CUT-06 交换已接受' }), 'T006', '3:4', [1724, 578, 6]],
      ['4:1', () => DM.cutout(sh, { src: 'CUT-07', w: 380, hgt: 'auto', maxH: 400, x: 1215, y: 790, r: 4, z: 11, label: 'CUT-07 chat' }), 'T007', '4:2', [1292, 944, -7]],
      ['4:3.5', () => DM.polaroid(sh, { src: 'CUT-08', w: 290, hgt: 380, x: 1350, y: 390, r: 7, z: 12, label: 'CUT-08 memory card', fit: 'cover', pos: '50% 0%' }), 'T008', '4:3.5', [1420, 570, 8]],
    ];
    cards.forEach(([at, make, line, stampAt, [sx, sy, sr]], i) => {
      make().in('slap', at, { big: 1.32, spin: i % 2 ? -9 : 9, sfx: 'slap', note: i });
      const c = DM.line(line).style.slice(6);
      say(sh, line, { x: sx, y: sy, r: sr, z: 20, at: stampAt, until: '5:1', gain: -2, note: i, size: 70, style: stampStyle(c) });
    });
    DM.tape(sh, { x: 600, y: 112, r: -5, z: 13 }).show('1:1');
    DM.tape(sh, { x: 1560, y: 95, r: -3, color: 'm', w: 160, z: 13 }).show('3:1');
    DM.tape(sh, { x: 1350, y: 205, r: 10, w: 130, z: 13 }).show('4:3.5');
    DM.sfx('2:1', 'tape', { gain: -4 }); DM.sfx('4:3.5', 'tape', { gain: -2 });
    DM.pops(sh, [['star', 'yellow', 960, 110, 96], ['sparkle', 'pink', 100, 250, 64], ['heart', 'pink', 1000, 560, 76, -8], ['star', 'mint', 1860, 520, 72],
      ['plus', 'ink', 470, 985, 50], ['sparkle', 'yellow', 1860, 100, 58], ['note', 'ink', 70, 985, 60]], '2:2', beat, { gain: -9 });
  }
  DM.wipe('W-A0-title', '4:4.5', '5:1', { colors: ['pink', 'yellow'] });

  // ======================================================================= A0 · H2 · TITLE CARD · 5:1 -> 8:1 (L6)
  let T010, T011, T013;
  {
    const sh = DM.shot('H2-title', '5:1', '8:1', { drift: { s: 1.045, x: -4, y: -4 }, focus: [700, 540] });
    DM.burst(sh, { x: 470, y: 330, rOut: 330, rIn: 250, n: 20, color: 'yellow', spin: 20 }).in('grow', '5:1', { dur: 0.16, log: false }).out('shrink', '5:2.5', { dur: 0.16 });
    // v2: the starburst is kept for three hits only (5:1, 21:1, 51:1; review art #4): 「另一面。」 gets its mint swipe and two sparkles
    DM.pops(sh, [['sparkle', 'pink', 790, 470, 70], ['sparkle', 'yellow', 120, 760, 58]], '5:3.5', beat / 4, { gain: -10 });
    T010 = say(sh, 'T010', { x: 130, y: 330, until: '7:4.5', outFx: 'cut', gain: 9 });   // v2: the title impact at 0 dB (the bed stops under the wipe: film.js)
    T011 = say(sh, 'T011', { x: 130, y: 600, until: '7:4.5', outFx: 'cut' });
    say(sh, 'T012', { x: 1380, y: 168, ax: 0.5, size: 112, r: 4 });
    T013 = say(sh, 'T013', { x: 140, y: 885, until: '7:4.5' });   // v2: H2 clears to paper on 7:4.5 so the match cut flies over nothing
    // the two sides, swapping (the repo's AI images, labelled)
    // v2: the same pair as P1-P3 and A4 (review art #6): TA's stage (yao-stage.jpg), your crowd (sample-crowd.jpg)
    const pA = DM.polaroid(sh, { src: 'photo:yao-stage', w: 460, hgt: 390, cap: '舞台', x: 1235, y: 520, r: -6, z: 4, tape: 'y', pos: '50% 62%', label: 'stage' }).in('slap', '5:3', { sfx: 'slap', note: 3 }).float(3, 0.4).out('shrink', '7:4.5', { dur: 0.12 });
    const pB = DM.polaroid(sh, { src: 'photo:sample-crowd', w: 440, hgt: 390, cap: '人海', x: 1600, y: 700, r: 5, z: 5, tape: 'p', pos: '50% 42%', label: 'crowd' }).in('slap', '5:4', { sfx: 'slap', note: 5 }).float(3, 0.4).out('shrink', '7:4.5', { dur: 0.12 });
    DM.swap(sh, { x: 1440, y: 600, size: 140 }).in('pop', '6:3.5', { sfx: 'zip', gain: -6 }).wiggle('6:4', '7:2', 6, 3).out('shrink', '7:4.5', { dur: 0.12 });
    DM.pops(sh, [['star', 'yellow', 990, 160, 104], ['star', 'mint', 1860, 330, 80, 12], ['star', 'pink', 80, 980, 84, -10]], '7:1', beat / 2, { gain: -8 }).forEach(d => d.out('shrink', '7:4.5', { dur: 0.12 }));
    DM.pops(sh, [['plus', 'ink', 1820, 160, 50], ['sparkle', 'ink', 1000, 470, 48], ['squiggle', 'mint', 300, 990, 170]], '5:1.5', beat / 2, { sfx: 'none' });
    // 7:3 pink wavy underline DRAWS under 「交换」 (key word of T013)
    DM.underline(sh, { wavy: true, amp: 8, wl: 60, width: 9, at: '7:3', dur: beat * 0.8, label: 'wavy underline 交换',
      x0: () => T013.keyRect().x0 - 6, x1: () => T013.keyRect().x1 + 6, y: () => T013.keyRect().y1 + 4 });
    // (v2, owner 0b: no explanatory tags in the picture; the end card's one credits line says the photos are AI-generated)
    sh.pulse(['6:3', '7:1', '7:3'], 0.01, 0.1);   // v2: the hold 6:3-7:4 bumps on the beats (rhythm: 2.4 s near-still)
  }

  // ======================================================================= A0 · H3 · MATCH CUT into the real landing page · 8:1 -> 9:1 (L4)
  // the title type flies onto the product's own 「同一刻，另一面。」 card (7:4.5 -> 8:1) and crossfades into it (8:1 -> 8:2).
  // D01: where the landing page's title sits in the capture, in 1920-wide reference px (measured on script/probe/shots/d01-landing.png;
  // re-measure if the D-01 capture of the filmed build differs).
  if (DM.has('8:1')) {   // maps that cut bar 8 (STORYBOARD ✂6) have no H3: H2 ends with a scribble wipe on 7:4.5 instead (below)
  const D01 = { title1: [1315, 528], title2: [1315, 616], titlePx: 78, note: [392, 703], noteR: [160, 50], push: { u: 0.74, v: 0.55 } };
  const H3 = DM.shot('H3-landing', '8:1', '9:1', { drift: { s: 1.045 } });
  const desk = DM.desk(H3, { media: 'D-01', w: 1800, x: 960, y: 540, r: 0, view: [['8:1', { s: 1 }], ['9:1', { s: 1.1, u: D01.push.u, v: D01.push.v }, E.ioSine]] });
  desk.show('8:1');
  const ref = v => v * desk.srcW / 1920;                       // reference px -> capture px
  const deskScreen = (t, rx, ry) => H3.toScreen(t, ...desk.toWorld(t, ref(rx), ref(ry)));
  const deskScale = t => { const a = deskScreen(t, 0, 0), b = deskScreen(t, 100, 0); return Math.hypot(b[0] - a[0], b[1] - a[1]) / 100; };
  DM.circle(H3, { on: desk, x: () => ref(D01.note[0]), y: () => ref(D01.note[1]), rx: () => ref(D01.noteR[0]), ry: () => ref(D01.noteR[1]), at: '8:3', dur: beat * 0.8, color: 'pink', width: 9, label: 'circle 就是这一刻！' });
  DM.sfx('8:1', 'whoosh', { gain: -3 });
  {
    const mo = DM.shot('H3-match', '7:4.5', '8:2', { paper: false, z: 40, drift: null, log: false });
    const t81 = DM.Tc('8:1'), t745 = DM.Tc('7:4.5'), t82 = DM.Tc('8:2');
    const fly = (node, from, target) => node.track(t => {
      const k = E.ioC(clamp((t - t745) / Math.max(1e-3, t81 - t745)));
      const tt = Math.max(t, t81); const [tx, ty] = deskScreen(tt, target[0], target[1]);
      const sc = D01.titlePx * deskScale(tt) / node.size;
      const fade = 1 - E.ioQ(clamp((t - t81) / Math.max(1e-3, t82 - t81)));
      return { x: (tx - from[0]) * k, y: (ty - from[1]) * k, s: lerp(1, sc, k), o: fade };
    });
    const c1 = DM.title(mo, { text: '同一刻，', recipe: 'ink-pink', size: 240, x: 130, y: 330, fx: 'NONE', at: '7:4.5', kind: 'title' });
    const c2 = DM.title(mo, { text: '【另一面。】', recipe: 'hl-mint', size: 240, x: 130, y: 600, fx: 'NONE', at: '7:4.5', hlDur: 0.001, kind: 'title' });
    for (const c of [c1, c2]) { c.boil = null; c.ax = 0; c.ay = 0.5; }
    fly(c1, [130, 330], D01.title1); fly(c2, [130, 600], D01.title2);
    DM.ev('7:4.5', 'slide', 'title flies onto the landing card', { sfx: 'none' });
  }
  DM.wipe('W-A0-A1', '8:4.5', '9:1', { colors: ['ink', 'pink'] });
  } else {
    DM.wipe('W-A0-A1', '7:4.5', '9:1', { colors: ['pink', 'yellow'] });
  }

  // (v2, owner 2026-10-07 「去掉那些说明性文字，这个产品必须是完整的」: v1's fixed 「照片为 AI 生成的示例图」 (T025) over the pain
  // section is gone; the end card's one credits line carries the disclosure)

  // camera move shared by a stage layer and its type layer: a slow drift, then a whip pan into the next shot on the "and" of 4
  const whip = (from, to, drift) => [[from, { x: 0, y: 0, s: 1.0 }], [`${to - 1}:4.5`, { x: drift, y: 0, s: 1.03 }, E.ioSine], [`${to}:1`, { x: -1500, y: 0, s: 1.05 }, E.inExpo]];
  const whipType = (from, to) => [[from, { x: 0 }], [`${to - 1}:4.5`, { x: 0 }], [`${to}:1`, { x: -1500 }, E.inExpo]];
  const blur = to => [[`${to - 1}:4.5`, 0], [`${to - 1}:4.75`, 12], [`${to}:1`, 60, E.inQ]];

  // ======================================================================= A1 · P1 · TWO PHOTOS, TWO PHONES · 9:1 -> 13:1 (L6)
  // v2 (review art #3 / #6, read #2): back to the animatic's scale (photos 600 px, phones ~710 px; v1 had 410 px photos on an
  // 87 %-empty page) and ONE pair of photos for the whole film: YOU shot the crowd (the build's sample-crowd.jpg), TA shot the stage
  // (yao-stage.jpg, 阿遥·示例's photo in the demo) — the same two photos the exchange in A4 trades, so the payoff hands back the
  // photo P2 promises.  Both photos land under 「散场了。」 on 9:1 / 9:2 (no empty bar); the type keeps the top band.
  {
    const sh = DM.shot('P1-two-photos', '9:1', '13:1', { drift: null, blur: blur(13), cam: whip('9:1', 13, -60) });
    const ty = DM.shot('P1-type', '9:1', '13:1', { paper: false, z: 30, drift: null, log: false, blur: blur(13), cam: whipType('9:1', 13) });
    sh.pulse(['9:1', '9:3', '10:1', '10:3', '11:1', '11:3', '12:1', '12:3'], 0.008, 0.12);
    const PW = 600, PH = 470, A = { x: 545, y: 676 }, Bp = { x: 1375, y: 706 };
    const polA = DM.polaroid(sh, { src: 'photo:sample-crowd', w: PW, hgt: PH, x: A.x, y: A.y, r: -4, z: 5, tape: 'y', tapeW: 210, pos: '50% 45%', label: 'yours: crowd' })
      .in('slap', '9:1', { sfx: 'slap', note: 2, big: 1.16 });
    const polB = DM.polaroid(sh, { src: 'photo:yao-stage', w: PW, hgt: PH, x: Bp.x, y: Bp.y, r: 3, z: 5, tape: 'p', tapeW: 210, pos: '50% 62%', label: 'theirs: stage' })
      .in('slap', '9:2', { sfx: 'slap', note: 4, big: 1.16 });
    DM.sfx('9:2', 'tape', { gain: -6 });
    // 10:3 handwritten captions write on (inside each polaroid's caption strip)
    DM.text(sh, { parent: polA, text: '你拍的', font: 'hand', size: 46, x: 28, y: PH - 38, ax: 0, at: '10:3', fx: 'TYPE', kind: 'label' });
    DM.text(sh, { parent: polB, text: 'TA 拍的', font: 'hand', size: 46, x: 28, y: PH - 38, ax: 0, at: '10:3.5', fx: 'TYPE', kind: 'label' });
    // 11:1 a hand-drawn landscape phone outline around each photo (polaroid-local coordinates)
    const phoneOutline = r => DM.paths.rrect(-56, -54, PW + 112, PH + 108, 66, r, { jit: 5 }) + ' ' + DM.paths.line([[-36, PH * 0.4], [-36, PH * 0.6]], r, { jit: 2 }) + ' ' + DM.paths.loop(PW + 34, PH * 0.5, 10, 10, r, { turns: 1.05, wob: 0.1 });
    DM.stroke(sh, { parent: polA, color: 'ink', width: 10, at: '11:1', dur: beat * 0.9, z: -1, label: 'phone outline A', sfx: 'scribble', gen: phoneOutline });
    DM.stroke(sh, { parent: polB, color: 'ink', width: 10, at: '11:1.5', dur: beat * 0.9, z: -1, label: 'phone outline B', sfx: 'none', gen: phoneOutline });
    // 12:1 the two phones slide apart; 12:3 a dashed line between them with a cross in the middle
    polA.move('12:1', '12:2', { x: -110, r: -2 }, E.outC); polB.move('12:1', '12:2', { x: 110, r: 2 }, E.outC);
    DM.ev('12:1', 'slide', 'phones slide apart', { sfx: 'swish', gain: -6 });
    DM.dashed(sh, { pts: [[805, 668], [960, 655], [1118, 672]], at: '12:3', dur: beat * 0.6, z: 3, width: 8, label: 'dashed line' });
    DM.deco(sh, { kind: 'cross', color: 'pink', size: 130, x: 960, y: 660, z: 8, lw: 1.3 }).in('pop', '12:3.5', { sfx: 'pencil', gain: -3 });
    DM.ev('12:4.5', 'slide', 'paper pans right', { sfx: 'whoosh', gain: -4 });
    // type layer (static on screen; whips out with the paper).  T020 holds the top left for two beats (v1: top centre, where the
    // 1.4x 「舞台」 of the next line covered it), then each line gets its own slot in the top band
    say(ty, 'T020', { x: 120, y: 168, until: '9:3', outFx: 'cut', gain: -4 });
    say(ty, 'T021', { x: 120, y: 178, text: '你拍了【人海】，' });
    say(ty, 'T022', { x: 1810, ax: 1, y: 335, text: 'TA 拍了【舞台】。' });
    say(ty, 'T023', { x: 130, y: 110 });
    say(ty, 'T024', { x: 120, y: 248 });
  }

  // ======================================================================= A1 · P2 · THE BEST PHOTO OF YOU IS ON A STRANGER'S PHONE · 13:1 -> 17:1
  // v2: TA's stage photo, big (1060 px); the pink circle finds YOUR raised hand at its bottom edge (yao-stage.jpg px 100, 360: you
  // were in front of TA); on the "and" of 4 it flies into a portrait stranger's phone (650 px tall, centre right) that drifts off;
  // you (the product's avatar) on the left, a dotted path across the page that ends in a cross.
  {
    const sh = DM.shot('P2-stranger', '13:1', '17:1', { drift: null, enter: { kind: 'slide', dx: 700, dur: 0.12, sfx: 'none' }, blur: blur(17), cam: whip('13:1', 17, -60) });
    const ty = DM.shot('P2-type', '13:1', '17:1', { paper: false, z: 30, drift: null, log: false, enter: { kind: 'slide', dx: 700, dur: 0.12, sfx: 'none' }, blur: blur(17), cam: whipType('13:1', 17) });
    sh.pulse(['13:1', '13:3', '14:1', '14:3', '15:1', '15:3', '16:1', '16:3'], 0.008, 0.12);
    const PH = { x: 1500, y: 610, w: 390, h: 650 };
    const grp = DM.group(sh, { x: 0, y: 0, z: 6, origin: [PH.x, PH.y] });   // the photo + the stranger's phone travel together from 15:1
    const BW = 1060, BH = 690, B0 = { x: 905, y: 615 };
    const pol = DM.polaroid(sh, { parent: grp, src: 'photo:yao-stage', w: BW, hgt: BH, x: B0.x, y: B0.y, r: -2, z: 5, tape: 'y', tapeW: 250, pos: '50% 72%', label: 'TA stage big' })
      .in('slap', '13:1', { sfx: 'slap', big: 1.1 });
    // 13:3 a pink marker circle around your raised hand (yao-stage.jpg px 100, 360); 13:4 「你！」
    const hand = [100, 352];
    // (v2 QC: 「你！」 pops on 13:2.5, readable for a whole second before the photo flies off on 13:4.5)
    DM.circle(sh, { parent: pol, x: () => pol.imgToLocal(hand[0], hand[1])[0], y: () => pol.imgToLocal(hand[0], hand[1])[1], rx: 92, ry: 118, at: '13:2', dur: beat * 0.6, color: 'pink', width: 12, z: 8, label: 'circle 你' });
    DM.note(sh, { parent: pol, text: '你！', size: 120, x: 0, y: 0, at: '13:2.5', fx: 'POP', z: 9, kind: 'note', color: '#e9396b', style: { webkitTextStroke: '2px var(--ink)', paintOrder: 'stroke fill' } })
      .track(() => { const [x, y] = pol.imgToLocal(hand[0], hand[1]); return { x: x + 108, y: y - 150 }; });
    // 13:4.5 the photo flies into a hand-drawn portrait phone (it lands on 14:1 with the phone's outline, chip and the line)
    pol.move('13:4.5', '14:1', { x: PH.x - B0.x, y: PH.y - B0.y + 6, s: 0.335, r: 4 }, E.ioC);
    DM.ev('13:4.5', 'slide', 'photo flies into the stranger phone', { sfx: 'swish', gain: -4 });
    DM.stroke(sh, { parent: grp, color: 'ink', width: 10, at: '14:1', dur: beat * 0.5, z: 4, label: 'stranger phone', sfx: 'scribble',
      gen: r => DM.paths.rrect(PH.x - PH.w / 2, PH.y - PH.h / 2, PH.w, PH.h, 52, r, { jit: 4 }) + ' ' + DM.paths.line([[PH.x - 44, PH.y - PH.h / 2 + 26], [PH.x + 44, PH.y - PH.h / 2 + 26]], r, { jit: 2 }) });
    DM.chip(sh, { parent: grp, text: '陌生人的手机', size: 44, x: PH.x, y: PH.y + PH.h / 2 - 62, z: 9, at: '14:1.5', color: 'white' });
    DM.deco(sh, { parent: grp, kind: 'lock', color: 'ink', size: 104, x: PH.x + PH.w / 2 - 12, y: PH.y - PH.h / 2 + 34, z: 9, r: 10, lw: 1.3 }).in('pop', '14:3', { sfx: 'click', gain: -2 });
    // 15:1 the phone drifts toward the right edge, shrinking; 15:3 three question marks
    grp.move('15:1', '16:1', { x: 150, y: 10, s: 0.86 }, E.ioSine);
    DM.ev('15:1', 'slide', 'the stranger phone drifts away', { sfx: 'swish', gain: -8 });
    DM.pops(sh, [['question', 'pink', 1395, 300, 110, -12], ['question', 'pink', 1835, 250, 86, 10], ['question', 'pink', 1840, 880, 96, 6]], '15:3', beat / 2, { z: 12, gain: -10 });
    // 14:4 you (the product's avatar) on the left; 16:1 a dotted path across the page toward the phone; 16:3 it ends in a cross
    DM.sticker(sh, { src: 'avatar:you', w: 150, x: 255, y: 722, ay: 1, z: 7, r: -3, label: 'you' }).in('pop', '14:4', { gain: -8 });
    DM.dashed(sh, { pts: [[345, 585], [700, 470], [1060, 480], [1430, 590]], at: '16:1', dur: beat * 1.6, z: 6, width: 9, dash: [9, 17], label: 'dotted path' });
    DM.deco(sh, { kind: 'cross', color: 'pink', size: 120, x: 1452, y: 592, z: 12, lw: 1.3 }).in('pop', '16:3', { sfx: 'pencil', gain: -2 });
    DM.ev('16:4.5', 'slide', 'paper pans right', { sfx: 'whoosh', gain: -4 });
    // type layer (left column; the phone keeps the right third)
    say(ty, 'T026', { x: 120, y: 150 });
    say(ty, 'T027', { x: 120, y: 330, size: 116 });
    say(ty, 'T028', { x: 130, y: 790 });
    say(ty, 'T029', { x: 120, y: 918 });   // (v2 QC: the slam's 1.6x start must stay inside the title-safe bottom, y <= 1026)
  }

  // ======================================================================= A1 · P3 · THE PEOPLE NEXT TO YOU WALK AWAY · 17:1 -> 21:1
  // two layers: the stage (avatars, photos; the camera pushes in on you from 19:1) and the type above it (static).  v2: the cast at
  // ~420 px (v1 ~330 px in the bottom third); the type keeps the top band and reads top-down: 「要是……」 enters under 「还没认识，就
  // 走散了。」 and moves up when it leaves (v1 typed it in above it).  The swap is the same pair as P1 / A4: yours (crowd), TA's (stage).
  {
    const sh = DM.shot('P3-stage', '17:1', '21:1', { drift: null, enter: { kind: 'slide', dx: 700, dur: 0.12, sfx: 'none' }, focus: [960, 760],
      cam: [['17:1', { x: 0, y: 0, s: 1.0 }], ['19:1', { x: 0, y: 0, s: 1.0 }], ['19:3', { x: 0, y: 0, s: 1.09 }, E.ioC], ['21:1', { x: 0, y: 0, s: 1.12 }, E.ioSine]] });
    sh.pulse(['17:1', '17:3', '18:1', '18:3', '19:1', '19:3', '20:1', '20:2', '20:3', '20:4'], 0.008, 0.12);
    const ty = DM.shot('P3-type', '17:1', '21:1', { paper: false, z: 30, drift: null, log: false, enter: { kind: 'slide', dx: 700, dur: 0.12, sfx: 'none' } });
    // five illustrated avatars (exported from the build: 阿遥·示例, 小满·示例, you in 失真, 北屿·示例, a 脉冲 look as "a person")
    const AW = 200, FEET = 1010;
    const cast = [['avatar:yao', 460, '阿遥'], ['avatar:man', 710, '小满'], ['avatar:you', 960, 'you'], ['avatar:bei', 1210, '北屿'], ['avatar:maichong', 1460, 'person']];
    const exits = { 0: ['18:1', -1100], 4: ['18:2', 1100], 1: ['18:3', -1300], 3: ['18:4', 1300] };
    cast.forEach(([src, x, nm], i) => {
      const st = DM.div(sh, { cls2: 'stand', w: AW, hgt: 42, x, y: FEET + 4, z: 4, html: '' }); st.el.style.cssText += ';border-radius:50%;background:var(--mint);border:5px solid var(--ink);box-shadow:5px 6px 0 var(--ink)';
      const a = DM.sticker(sh, { src, w: AW, x, y: FEET, ay: 1, z: 6, r: [-3, 2, 0, -2, 3][i], label: 'avatar ' + nm }).in('pop', `17:${1 + i * 0.5}`, { gain: -10, note: i * 2 });
      a.bob('17:3', '17:4', 22, beat);
      st.in('pop', `17:${1 + i * 0.5}`, { sfx: 'none', log: false });
      if (exits[i]) { const [at, dx] = exits[i]; a.out('slide', at, { dx, dur: 0.32, dr: dx > 0 ? 12 : -12, sfx: 'swish', gain: -4, label: 'walks away ' + nm }); st.out('pop', at); }
    });
    DM.deco(sh, { kind: 'question', color: 'pink', size: 150, x: 1115, y: 585, z: 9, r: 12, lw: 1.2 }).in('pop', '18:4', { sfx: 'boop', gain: -6 }).out('pop', '19:3');
    // 19:3 the two photos slide in from the edges, 20:1 meet above you, 20:3 the swap sticker pops and they trade places
    const PW = 360, PHh = 292, A0 = [700, 622], B0 = [1220, 622];
    const pA = DM.polaroid(sh, { src: 'photo:sample-crowd', w: PW, hgt: PHh, x: A0[0], y: A0[1], r: -5, z: 7, tape: 'y', tapeW: 150, pos: '50% 45%', label: 'photo A (yours)' })
      .in('slide', '19:3', { dx: -1200, dur: 0.35, dr: -10, ease: E.outBack, sfx: 'swish', gain: -6 });
    const pB = DM.polaroid(sh, { src: 'photo:yao-stage', w: PW, hgt: PHh, x: B0[0], y: B0[1], r: 5, z: 7, tape: 'p', tapeW: 150, pos: '50% 62%', label: 'photo B (theirs)' })
      .in('slide', '19:3.5', { dx: 1200, dur: 0.35, dr: 10, ease: E.outBack, sfx: 'swish', gain: -6 });
    pA.move('20:1', '20:1.6', { x: 130 }, E.outBack); pB.move('20:1', '20:1.6', { x: -130 }, E.outBack);
    DM.ev('20:1', 'slap', 'photos meet above you', { sfx: 'slap', gain: -6 });
    const dX = (B0[0] - 130) - (A0[0] + 130);
    const arc = (n, dx, up) => n.track(t => { const k = E.ioC(clamp((t - DM.Tc('20:3')) / (beat * 0.9))); return k <= 0 ? null : { x: dx * k, y: -Math.sin(k * Math.PI) * 90 * up, r: -8 * up * Math.sin(k * Math.PI), s: 1 - 0.1 * Math.sin(k * Math.PI) }; });
    arc(pA, dX, 1); arc(pB, -dX, -1);
    DM.swap(sh, { x: 960, y: 622, size: 180, z: 12 }).in('pop', '20:3', { sfx: 'zip', gain: -2 }).wiggle('20:3.5', '20:4.5', 8, 4);
    DM.pops(sh, [['sparkle', 'yellow', 780, 450, 74], ['star', 'pink', 1150, 440, 82], ['sparkle', 'mint', 1170, 800, 64], ['heart', 'pink', 770, 800, 62]], '20:3.5', beat / 4, { z: 13, gain: -10 });
    DM.sfx('19:1', 'riser', { gain: -6, dur: DM.Tc('21:1') - DM.Tc('19:1') });   // v2: -6 (the stop under 19-20 already builds; the drop keeps its jump)
    // type layer: T032 enters under T031 and moves up to the top when T031 leaves (19:3); T033 takes the second line
    say(ty, 'T030', { x: 120, y: 152 });
    say(ty, 'T031', { x: 120, y: 322, outFx: 'cut' });
    say(ty, 'T032', { x: 130, y: 478 }).move('19:3', DM.Tc('19:3') + 0.2, { y: -330 }, E.outBack);
    say(ty, 'T033', { x: 120, y: 322 });
  }
  DM.wipe('W-A1-A2', '20:4.5', '21:1', { colors: ['pink', 'yellow', 'mint'], width: 360 });
})();
