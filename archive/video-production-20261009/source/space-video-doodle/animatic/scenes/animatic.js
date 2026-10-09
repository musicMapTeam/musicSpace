/* Music Space · Doodle video — ANIMATIC (cold open -> title -> pain -> DROP into the product), 15 bars + button.
 * Music: Wax Lyricist "Flipping In" (CC0), 123.00 BPM.  Edit = FI bars 57-62 (groove, then the 2-bar stop) + FI bars 71-79
 * (the drum-less bass section, then the drums return on FI 75 = animatic bar 11 = the DROP).  Grid: animatic bar 1 = 0.000 s.
 * Storyboard mapping (script/STORYBOARD.md, 124 BPM reference): H1 = bars 1-4, H2 = 5-6, P1-P3 condensed = 7-10, E1/E4 condensed = 11-14.
 * Every line, sticker and cut sits on the grid; sound cues (DM.cue) are mixed by tools/audio.py. */
DM.tempo(123, 0);
const B = (bar, beat = 1) => DM.T(bar, beat);
const BEAT = DM.beatS();
const END = B(15) + 1.30;           // the button holds 1.3 s after the last downbeat
DM.duration(END);
DM.marks = { coldOpen: 0, title: B(5), pain: B(7), drop: B(11), room: B(14), button: B(15), end: END };
const clipA = (from, rate, t0) => DM.seq('/assets/clipA/f%05d.jpg', t => Math.min(699, from * 60 + (t - t0) * rate * 60));
const decos = (sh, list, t0, step, o = {}) => list.forEach(([k, c, x, y, z, rot], i) =>
  DM.deco(sh, { kind: k, color: c, size: z, x, y, r: rot || 0, z: o.z ?? 30 }).in('pop', t0 + i * step, { sfx: o.sfx && i % 2 === 0 ? 'pop' : null, gain: -9, note: i, log: o.log }));

/* ============ H1 · COLD OPEN collage · bars 1-4 (FI 57-60: kick 1 & 3, snare 2 & 4) ============
   8 real product moments slap onto the paper on the kicks, a rubber stamp lands on every snare; the camera pulls back as the page fills. */
{
  const first = [600, 330];
  const F0 = (sc, k) => ({ x: (960 - first[0]) * sc * k, y: (540 - first[1]) * sc * k, s: sc });
  const sh = DM.shot('H1-collage', 0, B(5) + 0.02, { cam: [[0, Object.assign(F0(1.7, 1), { r: -2 })], [B(1, 2.6), Object.assign(F0(1.58, 1), { r: -1.6 }), DM.E.ioSine], [B(1, 3), Object.assign(F0(1.32, 0.75), { r: -1 }), DM.E.outExpo],
    [B(2), Object.assign(F0(1.26, 0.6), { r: -0.8 }), DM.E.ioSine], [B(2, 1.3), Object.assign(F0(1.14, 0.35), { r: -0.5 }), DM.E.outExpo], [B(4, 3), { x: 0, y: 0, s: 1.0, r: 0 }, DM.E.ioC], [B(5), { x: -6, y: 4, s: 0.99, r: 0.3 }]] });
  sh.pulse([1, 2, 3, 4].flatMap(b => [B(b), B(b, 3)]), 0.014, 0.08);
  DM.scrap(sh, { w: 780, hgt: 520, color: 'yellow', x: 610, y: 350, r: -7, z: 1 }).in('slap', 0, { big: 1.08, spin: -3, log: false });
  DM.scrap(sh, { w: 640, hgt: 430, color: 'mint', x: 770, y: 800, r: 4, z: 1 }).in('slap', B(2, 3), { big: 1.08, log: false });
  DM.scrap(sh, { w: 520, hgt: 540, color: 'pink', x: 1640, y: 790, r: -4, z: 1 }).in('slap', B(3, 3), { big: 1.08, log: false });
  const cards = [
    [1, 1, () => DM.polaroid(sh, { src: '/assets/cut/room.jpg', w: 680, hgt: 440, cap: '回声现场 · 示例场', x: 600, y: 330, r: -4, z: 5, label: 'room' }), '进场', 'yellow', [880, 540, -8]],
    [1, 3, () => DM.svgcut(sh, { src: '/shots/avatars/look-4-shizhen-front.svg', w: 230, x: 1120, y: 320, r: 4, z: 6, label: 'avatar' }), '换装', 'pink', [1190, 560, 7]],
    [2, 1, () => DM.cutout(sh, { src: '/assets/cut/wall.jpg', w: 300, hgt: 536, x: 250, y: 690, r: 5, z: 7, label: '3D wall' }), '上墙', 'mint', [300, 930, -6]],
    [2, 3, () => DM.cutout(sh, { src: '/assets/cut/ai.jpg', w: 540, hgt: 350, x: 760, y: 780, r: -3, z: 8, label: 'AI chip' }), '视角', 'yellow', [960, 940, 6]],
    [3, 1, () => DM.cutout(sh, { src: '/assets/cut/badge.jpg', w: 490, hgt: 320, x: 1560, y: 250, r: 3, z: 9, label: 'badge' }), '同一刻', 'pink', [1640, 400, -7]],
    [3, 3, () => DM.cutout(sh, { src: '/assets/cut/accept.jpg', w: 400, hgt: 416, x: 1650, y: 770, r: -5, z: 10, label: '交换已接受' }), '交换', 'mint', [1740, 950, 6]],
    [4, 1, () => DM.cutout(sh, { src: '/assets/cut/chat.jpg', w: 390, hgt: 386, x: 1210, y: 790, r: 4, z: 11, label: 'chat' }), '招手', 'yellow', [1300, 960, -7]],
    [4, 3, () => DM.cutout(sh, { src: '/assets/cut/card.jpg', w: 270, hgt: 360, x: 1350, y: 390, r: 7, z: 12, label: 'memory card' }), '留念', 'pink', [1420, 560, 8]],
  ];
  cards.forEach(([bar, beat, make, word, col, [sx, sy, sr]], i) => {
    const c = make(); c.in('slap', B(bar, beat), { big: 1.32, spin: i % 2 ? -9 : 9, sfx: 'slap', note: i, label: c.label });
    DM.stamp(sh, { text: word, color: col, size: 66, x: sx, y: sy, r: sr, z: 20 }).in('stamp', B(bar, beat + 1), { sfx: 'stamp', gain: -2, note: i });
  });
  DM.tape(sh, { x: 600, y: 112, r: -5, z: 13 }).in('none', 0, { log: false });
  DM.tape(sh, { x: 250, y: 425, r: 8, color: 'p', w: 150, z: 13 }).in('none', B(2), { log: false });
  DM.tape(sh, { x: 1560, y: 95, r: -3, color: 'm', w: 160, z: 13 }).in('none', B(3), { log: false });
  DM.tape(sh, { x: 1350, y: 215, r: 10, w: 130, z: 13 }).in('none', B(4, 3), { log: false });
  decos(sh, [['star', 'yellow', 960, 110, 96], ['sparkle', 'pink', 100, 250, 64], ['heart', 'pink', 1000, 560, 76, -8], ['star', 'mint', 1880, 520, 72], ['plus', 'ink', 470, 980, 50], ['sparkle', 'yellow', 1880, 100, 58], ['note', 'ink', 70, 990, 60]], B(2, 2), BEAT, { sfx: true });
}
DM.wipe('W1', B(4, 4.5), B(5), { colors: ['pink', 'yellow'] });

/* ============ H2 · TITLE · bars 5-6 (FI 61-62: the stop, kick out) — the chosen mockup, animated ============ */
{
  const sh = DM.shot('H2-title', B(5), B(7) + 0.02, { cam: [[B(5), { x: 0, y: 0, s: 1.0 }], [B(6, 4.5), { x: -12, y: -6, s: 1.04 }, DM.E.ioSine], [B(7), { x: -1700, y: 60, s: 1.06, r: -1.5 }, DM.E.inExpo]],
    blur: [[B(6, 4.5), 0], [B(6, 4.8), 10], [B(7), 70, DM.E.inQ]] });
  const pow = DM.burst(sh, { x: 520, y: 330, rOut: 360, rIn: 270, n: 20, color: 'yellow', z: 1, spin: 20 });
  pow.in('grow', B(5), { dur: 0.16, log: false }).out('shrink', B(5, 2.5), { dur: 0.16 });
  DM.burst(sh, { x: 500, y: 640, rOut: 330, rIn: 250, n: 18, color: 'pink', z: 1, spin: -16 }).in('grow', B(5, 2), { dur: 0.16, log: false }).out('shrink', B(5, 4), { dur: 0.16 });
  DM.title(sh, { text: '同一刻，', x: 140, y: 345, size: 280, z: 5 }).in('slam', B(5), { sfx: 'impact', gain: 0 });
  DM.title(sh, { text: '另一面。', x: 140, y: 650, size: 280, z: 6, hl: { color: 'mint', t: B(5, 2.25), dur: BEAT * 0.9 } }).in('slam', B(5, 2), { sfx: 'impact', gain: -2, note: 2 });
  DM.stroke(sh, { color: 'pink', width: 11, t: B(6, 3), dur: BEAT * 0.8, z: 7, label: 'wavy underline', gen: r => DM.paths.curve([[150, 845], [330, 828], [520, 852], [720, 832], [930, 846]], r, { jit: 7 }) });
  DM.logo(sh, { x: 150, y: 120, ax: 0, size: 92, r: -2, z: 9 }).in('pop', B(6), { sfx: 'pop', note: 4 });
  DM.deco(sh, { kind: 'note', color: 'ink', size: 70, x: 760, y: 120, z: 9, r: 8 }).in('pop', B(6, 1.5), { log: false });
  const pA = DM.polaroid(sh, { src: '/repoassets/stage-scene.png', w: 500, hgt: 410, x: 1250, y: 470, r: -6, z: 4, label: 'stage' }); pA.in('slap', B(5, 3), { sfx: 'slap', note: 3 }).float(3, 0.4);
  DM.tape(sh, { x: 1240, y: 270, r: -9, z: 5 }).in('none', B(5, 3), { log: false });
  const pB = DM.polaroid(sh, { src: '/repoassets/crowd-scene.png', w: 470, hgt: 440, x: 1625, y: 630, r: 5, z: 5, label: 'crowd' }); pB.in('slap', B(5, 4), { sfx: 'slap', note: 5 }).float(3, 0.4);
  DM.tape(sh, { x: 1640, y: 415, r: 6, color: 'p', z: 6 }).in('none', B(5, 4), { log: false });
  DM.chip(sh, { text: '舞台视角', size: 36, color: 'mint', x: 1130, y: 640, r: -6, z: 8 }).in('pop', B(6, 1.5), { sfx: 'pop', gain: -6, note: 7 });
  DM.chip(sh, { html: '<b style="font-weight:400">AI 判断：人海</b>', size: 36, color: 'yellow', x: 1560, y: 815, r: -3, z: 8 }).in('pop', B(6, 2.5), { sfx: 'pop', gain: -6, note: 9 });
  DM.swap(sh, { x: 1440, y: 470, z: 9, size: 140 }).in('pop', B(6, 3.5), { sfx: 'swap', gain: -6 }).wiggle(B(6, 3), B(6, 4.4), 6, 3);
  DM.chip(sh, { text: '同一刻的另一面 · 21:47', size: 40, color: 'hot', x: 1480, y: 950, r: -3, z: 9, style: { color: '#fff' } }).in('pop', B(6, 3), { sfx: 'pop', gain: -6, note: 11 });
  DM.stroke(sh, { color: 'pink', width: 8, t: B(6, 3.25), dur: BEAT * 0.7, z: 8, label: 'scribble ring', gain: -8, gen: r => DM.paths.loop(1480, 958, 300, 58, r, { turns: 1.25, tilt: -3, a0: 160 }) });
  DM.stick(sh, { x: 1430, y: 110, size: 92, z: 9, poses: [[B(5, 2), 'cheer'], [B(5, 3), 'jump'], [B(5, 4), 'cheer'], [B(6), 'jump'], [B(6, 2), 'cheer'], [B(6, 3), 'jump'], [B(6, 4), 'cheer']] }).in('pop', B(5, 2), { log: false });
  DM.stick(sh, { x: 1560, y: 120, size: 92, z: 9, poses: [[B(5, 2), 'jump'], [B(5, 3), 'cheer'], [B(5, 4), 'jump'], [B(6), 'cheer'], [B(6, 2), 'jump'], [B(6, 3), 'cheer'], [B(6, 4), 'jump']] }).in('pop', B(5, 2.5), { log: false });
  decos(sh, [['star', 'yellow', 960, 150, 104], ['plus', 'ink', 1820, 160, 50], ['star', 'mint', 1850, 330, 80, 12], ['sparkle', 'ink', 1020, 470, 48], ['star', 'pink', 80, 980, 84, -10], ['squiggle', 'mint', 300, 960, 170]], B(5, 1.5), BEAT / 2, { sfx: true });
  DM.fine(sh, { text: '照片为 AI 生成的示例图', x: 1880, y: 1052, ax: 1, z: 9 }).in('fade', B(5, 2), { log: false });
}

/* ============ P · PAIN · bars 7-10 (FI 71-74: no drums, bass + horn accents on 1 and 3) ============ */
{
  const sh = DM.shot('P-pain', B(7), B(11) + 0.02, { cam: [[B(7), { x: 300, y: -16, s: 1.04, r: 1.2 }], [B(7, 1.45), { x: 0, y: 0, s: 1.0, r: 0 }, DM.E.outExpo], [B(9), { x: -14, y: 0, s: 1.02 }, DM.E.ioSine], [B(10, 4.4), { x: -24, y: 8, s: 1.05 }, DM.E.ioSine]],
    blur: [[B(7), 30], [B(7, 1.25), 0, DM.E.outQ]] });
  sh.pulse([B(7), B(7, 3), B(8), B(8, 3), B(9), B(9, 3), B(10), B(10, 3)], 0.008, 0.12);
  DM.title(sh, { text: '散场了。', x: 120, y: 165, size: 190, z: 6 }).in('slam', B(7), { sfx: 'impact', gain: -4 }).out('pop', B(8, 3));
  DM.fine(sh, { text: '照片为 AI 生成的示例图', x: 1880, y: 40, ax: 1, z: 9 }).in('fade', B(7), { log: false });
  // two people who stood side by side (the product's own illustrated avatars: you in 失真, 阿遥·示例) hop off in opposite
  // directions on the 8ths (还没认识，就走散了), stand still while the photos are apart, and come running back on the swap
  const you = DM.svgcut(sh, { src: '/shots/avatars/look-4-shizhen-front.svg', w: 104, x: 900, y: 1100, ay: 1, z: 8, r: -2, label: 'you' }).in('pop', B(7), { log: false });
  const yao = DM.svgcut(sh, { src: '/shots/avatars/cast-yao.svg', w: 104, x: 1020, y: 1100, ay: 1, z: 8, r: 2, label: '阿遥' }).in('pop', B(7, 0.5), { log: false });
  you.move(B(7, 2), B(9), { x: -660 }, DM.E.lin).bob(B(7, 2), B(9), 16, BEAT / 2).move(B(10, 3), B(10, 4.2), { x: 580 }, DM.E.outC).bob(B(10, 3), B(11), 26, BEAT / 2);
  yao.move(B(7, 2), B(9), { x: 660 }, DM.E.lin).bob(B(7, 2), B(9), 16, BEAT / 2).move(B(10, 3), B(10, 4.2), { x: -580 }, DM.E.outC).bob(B(10, 3), B(11), 26, BEAT / 2);
  DM.text(sh, { text: '?', font: 'logo', x: 260, y: 820, size: 80, color: '--pink', z: 9, r: -10 }).in('pop', B(9, 1.5), { log: false }).out('pop', B(10, 3));
  DM.text(sh, { text: '?', font: 'logo', x: 1660, y: 820, size: 80, color: '--pink', z: 9, r: 10 }).in('pop', B(9, 2), { log: false }).out('pop', B(10, 3));
  // your photo / their photo, each inside its own (landscape) phone
  const A = { x: 560, y: 615 }, Bp = { x: 1360, y: 615 };
  const polA = DM.polaroid(sh, { src: '/repoassets/stage-scene.png', w: 500, hgt: 400, cap: '你拍的 · 舞台', x: A.x, y: A.y, r: -4, z: 5, label: 'yours' });
  const polB = DM.polaroid(sh, { src: '/repoassets/crowd-scene.png', w: 500, hgt: 400, cap: 'TA 拍的 · 人海', x: Bp.x, y: Bp.y, r: 4, z: 5, label: 'theirs' });
  for (const p of [polA, polB]) { const c = p.el.querySelector('.cap'); c.style.fontSize = '42px'; c.style.bottom = '6px'; }
  polA.in('slap', B(7, 4), { sfx: 'slap', note: 2 }); polB.in('slap', B(8), { sfx: 'slap', note: 4 });
  const tA = DM.tape(sh, { parent: polA, x: 240, y: -8, r: -3, z: 6 }).in('none', B(7, 4), { log: false });
  const tB = DM.tape(sh, { parent: polB, x: 260, y: -8, r: 2, color: 'p', z: 6 }).in('none', B(8), { log: false });
  // the phone each photo lives in: a landscape phone outline drawn around the polaroid (polaroid-local coordinates)
  const phoneOutline = r => DM.paths.rrect(-60, -56, 620, 516, 62, r, { jit: 5 }) + ' ' + DM.paths.line([[-37, 162], [-37, 242]], r, { jit: 2 }) + ' ' + DM.paths.loop(537, 208, 9, 9, r, { turns: 1.05, wob: 0.1 });
  const oA = DM.stroke(sh, { parent: polA, color: 'ink', width: 9, t: B(8, 3), dur: BEAT * 0.9, z: 4, label: 'phone outline A', gen: r => phoneOutline(r) });
  const oB = DM.stroke(sh, { parent: polB, color: 'ink', width: 9, t: B(8, 3.25), dur: BEAT * 0.9, z: 4, label: 'phone outline B', sfx: false, gen: r => phoneOutline(r) });
  DM.text(sh, { text: '每部手机里，', x: 125, y: 105, size: 84, z: 7, type: { t: B(8, 3), step: BEAT / 4 } }).out('pop', B(9, 3.5));
  DM.title(sh, { text: '只有[自己]那一面。', x: 120, y: 245, size: 150, ks: 1.32, z: 7 }).in('slam', B(8, 4), { sfx: 'impact', gain: -5, note: 1 }).out('pop', B(9, 3.75));
  const apart = 150;
  for (const [n, dir] of [[polA, -1], [polB, 1]]) {
    n.move(B(9), B(9, 1.8), { x: dir * apart, s: 0.92 }, DM.E.outC);
    n.move(B(10), B(10, 2.5), { x: -dir * apart * 1.2, s: 1.087 }, DM.E.ioC);
  }
  DM.stroke(sh, { color: 'ink', width: 7, t: B(9, 2), dur: BEAT * 0.6, dash: [22, 18], z: 3, label: 'dashed line', gen: r => DM.paths.line([[700, 650], [960, 638], [1220, 650]], r, { jit: 3 }) }).out('fade', B(10), { dur: 0.15 });
  DM.deco(sh, { kind: 'cross', color: 'pink', size: 130, x: 960, y: 638, z: 8, lw: 1.3 }).in('pop', B(9, 2.5), { sfx: 'pop', gain: -4, note: -3 }).out('pop', B(10));
  DM.text(sh, { text: '要是……', font: 'note', x: 120, y: 100, size: 112, color: '--pink', r: -5, z: 9, type: { t: B(9, 3.5), step: BEAT / 8 } });
  DM.title(sh, { text: '能把那一面，[换回来]？', x: 120, y: 262, size: 140, ks: 1.32, z: 9 }).in('slam', B(9, 4), { sfx: 'impact', gain: -4, note: 3 });
  const dX = (Bp.x - 0.2 * apart) - (A.x + 0.2 * apart);
  const arc = (n, dx, up) => n.track(t => { const k = DM.E.ioC(DM.clamp((t - B(10, 3)) / (BEAT * 0.9))); return k <= 0 ? null : { x: dx * k, y: -Math.sin(k * Math.PI) * 70 * up, r: -8 * up * Math.sin(k * Math.PI), s: 1 - 0.1 * Math.sin(k * Math.PI) }; });
  arc(polA, dX, 1); arc(polB, -dX, -1);
  DM.swap(sh, { x: 960, y: 640, z: 12, size: 190 }).in('pop', B(10, 3), { sfx: 'swap', gain: -1 }).wiggle(B(10, 3.5), B(10, 4.5), 8, 4);
  decos(sh, [['sparkle', 'yellow', 800, 430, 74], ['star', 'pink', 1130, 430, 78], ['sparkle', 'mint', 1140, 850, 62], ['heart', 'pink', 790, 850, 60]], B(10, 3.5), BEAT / 4, { sfx: true, z: 13 });
  DM.cue(B(10, 2), 'riser', { gain: -6 });
}
DM.wipe('W2', B(10, 4.5), B(11), { colors: ['yellow', 'pink', 'mint'], width: 360 });

/* ============ E · DROP into the product · bars 11-13 (FI 75-77: drums back, full groove) ============ */
{
  const sh = DM.shot('E1-phone', B(11), B(14) + 0.02, { cam: [[B(11), { x: 0, y: 0, s: 1.0 }], [B(12, 4.6), { x: 10, y: 0, s: 1.03 }, DM.E.ioSine], [B(13), { x: 0, y: 0, s: 1.0 }, DM.E.outExpo], [B(14), { x: -10, y: 0, s: 1.04 }, DM.E.ioSine]] });
  sh.pulse([11, 12, 13].flatMap(b => [B(b), B(b, 3)]), 0.016, 0.08);
  DM.cue(B(11), 'boom', { gain: 0 });
  DM.burst(sh, { x: 560, y: 560, rOut: 560, rIn: 420, n: 22, color: 'yellow', z: 1, spin: 10 }).in('grow', B(11), { dur: 0.25, log: false });
  DM.scrap(sh, { w: 900, hgt: 330, color: 'mint', x: 1360, y: 620, r: -3, z: 2 }).in('slap', B(11, 3), { big: 1.1, log: false }).out('pop', B(13));
  const KS = 426 / 1080;   // phone w=470 -> screen 426 px wide for a 1080-px capture
  const ph = DM.phone(sh, { w: 470, x: 560, y: 560, r: -3, z: 6, shadow: 'pink',
    feed: t => t < B(12, 3) ? clipA(0.05, 0.48, B(11))(t) : t < B(13) ? clipA(1.405, 1, B(12, 3))(t) : clipA(6.40, 1, B(13))(t),   // bar 13: the product's own pull-back from 小满 reveals the cast
    zoom: [[B(11), { s: 1, fx: 213, fy: 461 }], [B(11, 4.6), { s: 1.0, fx: 213, fy: 461 }], [B(12), { s: 1.7, fx: 330 * KS, fy: 1560 * KS }, DM.E.outExpo], [B(12, 2.6), { s: 1.76, fx: 340 * KS, fy: 1590 * KS }, DM.E.ioSine],
           [B(12, 3), { s: 1.0, fx: 213, fy: 461 }, DM.E.outExpo], [B(13), { s: 1.0, fx: 213, fy: 461 }], [B(13, 0.01), { s: 1.34, fx: 540 * KS, fy: 560 * KS }], [B(14), { s: 1.2, fx: 540 * KS, fy: 600 * KS }, DM.E.ioSine]] });
  ph.in('slam', B(11), { big: 1.45, dir: -1, shake: 12, label: 'phone' });
  DM.confetti(sh, { t: B(11), x: 560, y: 470, n: 12, z: 3, id: 'cf-drop', a0: -175, a1: -5, v0: 1100, v1: 1900 });
  DM.ripple(sh, { t: B(12, 3), parent: ph, x: 22 + 331 * KS, y: 25 + 1873 * KS, size: 96, z: 7 });
  DM.title(sh, { text: '同场的人，', x: 960, y: 300, size: 180, shadow: 'mint', z: 8 }).in('slam', B(11), { sfx: 'impact', gain: -2 }).out('pop', B(13));
  DM.title(sh, { text: '再进[同一间|mint]', x: 975, y: 530, size: 150, ks: 1.25, shadow: 'mint', z: 8 }).in('slam', B(11, 3), { sfx: 'impact', gain: -5, note: 2 }).out('pop', B(13));
  DM.logo(sh, { text: 'LIVEHOUSE!', x: 1320, y: 740, size: 132, r: -4, z: 9 }).in('pop', B(11, 4), { sfx: 'pop', note: 5 }).out('pop', B(13));
  DM.text(sh, { text: '真实界面 · 示例现场', font: 'hand', x: 1010, y: 880, size: 42, color: '--ink2', z: 9 }).in('fade', B(12), { log: false }).out('pop', B(13));
  DM.stroke(sh, { color: 'pink', width: 8, t: B(12, 1.5), dur: BEAT * 0.8, z: 9, label: 'arrow to the card', gen: r => DM.paths.curve([[1000, 905], [910, 945], [820, 905], [775, 830]], r, { jit: 4 }) + ' ' + DM.paths.line([[752, 860], [775, 830], [805, 852]], r, { jit: 2 }) }).out('fade', B(13), { dur: 0.1 });
  DM.title(sh, { text: '带上你的[小人]，', x: 930, y: 400, size: 128, ks: 1.3, z: 8 }).in('slam', B(13), { sfx: 'impact', gain: -4, note: 4 });
  DM.title(sh, { text: '看看[谁]也在。', x: 930, y: 640, size: 128, ks: 1.4, z: 8 }).in('slam', B(13, 3), { sfx: 'impact', gain: -5, note: 5 });
  // roll call: the cast's own illustrated avatars (exported from the build) pop up on the 16ths after 「看看谁也在。」
  [['/shots/avatars/cast-yao.svg', 1120, -4], ['/shots/avatars/cast-man.svg', 1290, 3], ['/shots/avatars/cast-bei.svg', 1460, -3], ['/shots/avatars/look-4-shizhen-front.svg', 1630, 4]].forEach(([src, x, r], i) =>
    DM.svgcut(sh, { src, w: 118, x, y: 1110, ay: 1, z: 9, r }).in('slide', B(13, 3.25 + i * 0.25), { dy: 300, dur: 0.16, ease: DM.E.outBack, sfx: 'pop', gain: -10, note: 4 + i * 2, label: 'avatar ' + i }));
  DM.chip(sh, { text: '示例角色', size: 28, color: 'yellow', x: 1790, y: 905, z: 10, r: 6 }).in('pop', B(13, 4.25), { log: false });
  decos(sh, [['heart', 'pink', 1760, 640, 84, 8], ['star', 'yellow', 960, 900, 80, -6], ['sparkle', 'mint', 1780, 250, 60]], B(13, 2), BEAT, { sfx: true, z: 10 });
}
{
  /* bar 14: hard cut to the desktop 3D room (4K capture) in a hand-drawn laptop, punched in on the cast; circles on the 8ths */
  const sh = DM.shot('E4-room', B(14), B(15) + 0.02, { cam: [[B(14), { x: 0, y: 0, s: 1.0 }], [B(14, 4.4), { x: -10, y: -6, s: 1.06 }, DM.E.ioSine]] });
  sh.pulse([B(14), B(14, 3)], 0.016, 0.08);
  const SW = 1480, ZS = 1.72, FX = 1300, FY = 830;   // screen width, content zoom, zoom focus in capture px (2880x1620)
  const k = SW / 2880, SH = SW * 9 / 16;
  const zoomTo = (x, y) => { let tx = SW / 2 - FX * k * ZS, ty = SH / 2 - FY * k * ZS; tx = Math.min(0, Math.max(SW - SW * ZS, tx)); ty = Math.min(0, Math.max(SH - SH * ZS, ty)); return [90 + 26 + tx + x * k * ZS, 26 + ty + y * k * ZS]; };
  // real desktop capture (capture/clip-d-room.mjs): the five on the doodle stage, the product's own 7 Hz line boil
  const L = DM.laptop(sh, { sw: SW, srcW: 2880, srcH: 1620, x: 960, y: 575, r: -1.2, z: 3, shadow: 'mint', feed: DM.seq('/assets/clipD/f%05d.jpg', t => Math.min(215, Math.max(0, (t - B(14)) * 60 + 6))), zoom: [[B(14), { s: ZS, fx: FX * k, fy: FY * k }]] });
  L.in('slap', B(14), { big: 1.06, spin: 2, dy: -10, sfx: 'slap', label: 'laptop room' });
  const people = [['阿遥', 975, 878, 'pink'], ['小满', 1130, 878, 'yellow'], ['北屿', 1285, 885, 'mint'], ['林间', 1610, 885, 'pink']];
  people.forEach(([nm, x, y, c], i) => { const [cx, cy] = zoomTo(x, y); DM.stroke(sh, { parent: L, color: c, width: 9, t: B(14, 1 + i * 0.5), dur: BEAT * 0.45, z: 6, label: 'circle ' + nm, gain: -9, gen: r => DM.paths.loop(cx, cy, 82, 150, r, { tilt: (i % 2 ? 6 : -6) }) }); });
  const [mx, my] = zoomTo(1455, 880);
  DM.deco(sh, { parent: L, kind: 'heart', color: 'pink', size: 96, x: mx + 6, y: my - 200, z: 8 }).in('pop', B(14, 3), { sfx: 'heart', gain: -4 });
  DM.text(sh, { parent: L, text: '我！', font: 'note', x: mx - 40, y: my + 170, size: 72, color: '--pink', r: -8, z: 8 }).in('pop', B(14, 3), { log: false });
  DM.stamp(sh, { text: '示例角色 · 自动回复', color: 'mint', size: 50, x: 470, y: 890, r: -6, z: 9 }).in('stamp', B(14, 2), { sfx: 'stamp', gain: -3 });
  DM.card(sh, { w: 600, hgt: 150, x: 1440, y: 935, r: 2, z: 9 }).in('slap', B(14), { big: 1.15, log: false });
  DM.title(sh, { text: '看看[谁]也在。', x: 1440, y: 935, ax: 0.5, size: 96, ks: 1.3, z: 10, r: 2 }).in('slap', B(14), { big: 1.15, log: false });
}
DM.wipe('W3', B(14, 4.5), B(15), { colors: ['pink', 'mint'] });

/* ============ BUTTON · bar 15 (FI 79:1) ============ */
{
  const sh = DM.shot('X-button', B(15), END + 0.1, { cam: [[B(15), { x: 0, y: 0, s: 1.0 }], [END, { x: 0, y: -6, s: 1.04 }, DM.E.ioSine]] });
  DM.burst(sh, { x: 960, y: 470, rOut: 480, rIn: 370, n: 24, color: 'mint', z: 1, spin: 8 }).in('grow', B(15), { dur: 0.2, log: false });
  DM.title(sh, { text: '同一刻，', x: 960, y: 345, ax: 0.5, size: 230, z: 5 }).in('slam', B(15), { sfx: 'boom', gain: -2 });
  DM.title(sh, { text: '另一面。', x: 960, y: 600, ax: 0.5, size: 230, z: 6, hl: { color: 'yellow', t: B(15, 1.5), dur: BEAT * 0.7 } }).in('slam', B(15, 1.5), { sfx: 'impact', gain: -5 });
  DM.logo(sh, { x: 960, y: 850, size: 104, r: -3, z: 7 }).in('pop', B(15, 2), { sfx: 'pop' });
  DM.chip(sh, { text: 'musicmapteam.github.io/musicSpace/', size: 36, x: 960, y: 975, z: 7, style: { fontFamily: 'var(--f-digits)' } }).in('pop', B(15, 2.5), { log: false });
  decos(sh, [['star', 'yellow', 360, 230, 110], ['heart', 'pink', 1580, 250, 92, 8], ['sparkle', 'pink', 300, 800, 64], ['star', 'mint', 1650, 790, 86, -8]], B(15, 1.25), BEAT / 4, { sfx: true, z: 8 });
}
window.__ready = DM.layout().then(DM.info);
