/* Style-frame sequences built with the same motion system (each is a 2-bar beat-timed shot; the PNG is its settled last beat).
 *   sf-ai      bars 1-2  the on-device AI chip moment (phone: real upload form, 「AI 判断：人海」)
 *   sf-payoff  bars 3-4  「交换已接受」 (phone: real accepted screen) — the film's biggest hit
 *   sf-end     bars 5-6  end card: tagline, MUSIC SPACE, link + QR (must decode to the judged link), cast, disclosure
 * Title card, pain beat and the 3D room in the phone come straight out of scenes/animatic.js. */
DM.tempo(123, 0);
const B = (bar, beat = 1) => DM.T(bar, beat);
const BEAT = DM.beatS();
DM.duration(B(7) + 0.5);
const decos = (sh, list, t0, step, o = {}) => list.forEach(([k, c, x, y, z, rot], i) =>
  DM.deco(sh, { kind: k, color: c, size: z, x, y, r: rot || 0, z: o.z ?? 30, parent: o.parent }).in('pop', t0 + i * step, { sfx: i % 2 === 0 ? 'pop' : null, gain: -9 }));
/** phone-local coordinates of a point in the 1080x2340 capture, for a phone of width w with content zoom {s, fx, fy} (screen px) */
const onPhone = (w, z, sx, sy) => { const sw = w - 44, sh = sw * 2340 / 1080, k = sw / 1080; let tx = sw / 2 - z.fx * z.s, ty = sh / 2 - z.fy * z.s;
  tx = Math.min(0, Math.max(sw - sw * z.s, tx)); ty = Math.min(0, Math.max(sh - sh * z.s, ty)); return [22 + tx + sx * k * z.s, 25 + ty + sy * k * z.s]; };

/* ---------------- sf-ai · 「拍的是哪一面？ 人海。 AI 在本机判断，照片不上传。」 ---------------- */
{
  const t0 = B(1), sh = DM.shot('sf-ai', t0, B(3), { cam: [[t0, { s: 1.0 }], [B(2, 4.5), { s: 1.03, x: -6 }, DM.E.ioSine]] });
  const W = 470, k = (W - 44) / 1080, Z = { s: 1.45, fx: 540 * k, fy: 1385 * k };
  DM.scrap(sh, { w: 560, hgt: 860, color: 'yellow', x: 1440, y: 560, r: 4, z: 1 }).in('slap', t0, { log: false });
  const ph = DM.phone(sh, { w: W, x: 1440, y: 545, r: 2.5, z: 4, shadow: 'pink', src: '/shots/shots/p08-upload-ai.png', zoom: [[t0, { s: 1.0, fx: 213, fy: 461 }], [B(1, 3), Z, DM.E.outExpo]] });
  ph.in('slam', t0, { big: 1.3 });
  const [cx, cy] = onPhone(W, Z, 325, 1605), [hx, hy] = onPhone(W, Z, 785, 1185);
  DM.stroke(sh, { parent: ph, color: 'pink', width: 8, t: B(1, 4), dur: BEAT * 0.6, z: 6, label: 'circle AI chip', gen: r => DM.paths.loop(cx, cy, 158, 52, r, { tilt: -3 }) });
  DM.deco(sh, { parent: ph, kind: 'sparkle', color: 'yellow', size: 54, x: cx + 150, y: cy - 60, z: 7 }).in('pop', B(2), { log: false });
  DM.deco(sh, { parent: ph, kind: 'check', color: 'pink', size: 60, x: hx + 120, y: hy - 50, z: 7, lw: 1.4 }).in('pop', B(2, 1.5), { log: false });
  DM.title(sh, { text: '拍的是哪一面？', x: 120, y: 150, size: 112, z: 5 }).in('slam', t0);
  DM.title(sh, { text: '[人海]。', x: 105, y: 420, size: 250, ks: 1.0, key: 'pink', z: 6 }).in('slam', B(1, 3), { big: 1.8 });
  DM.burst(sh, { x: 300, y: 425, rOut: 215, rIn: 168, n: 16, color: 'yellow', z: 2, spin: 8 }).in('grow', B(1, 3), { dur: 0.16, log: false });
  DM.stroke(sh, { color: 'pink', width: 8, t: B(2), dur: BEAT * 0.7, z: 7, label: 'arrow', gen: r => DM.paths.curve([[640, 470], [860, 420], [1060, 520], [1215, 625]], r, { jit: 5 }) + ' ' + DM.paths.line([[1172, 632], [1215, 625], [1197, 585]], r, { jit: 2 }) });
  DM.text(sh, { text: 'AI 在本机判断，', x: 125, y: 680, size: 80, z: 6, type: { t: B(2), step: BEAT / 4 } });
  DM.title(sh, { text: '照片[不上传|mint]。', x: 118, y: 810, size: 140, ks: 1.25, shadow: 'mint', z: 6 }).in('slam', B(2, 3));
  DM.deco(sh, { kind: 'lock', color: 'ink', size: 92, x: 900, y: 790, z: 7, r: 8, lw: 1.3 }).in('pop', B(2, 3.5));
  DM.text(sh, { text: '21:48', font: 'digits', x: 820, y: 175, size: 120, shadow: 'pink', z: 5, r: -4, hl: { color: 'yellow', t: B(1, 2), dur: BEAT * 0.6, top: 0.5, h: 0.42 } }).in('pop', B(1, 2));
  DM.chip(sh, { text: '示例照片 · 拍摄时间为虚构', size: 30, x: 1440, y: 1045, z: 8, r: -1 }).in('pop', B(2, 2), { log: false });
  decos(sh, [['sparkle', 'pink', 1040, 300, 60], ['plus', 'mint', 70, 1000, 54], ['star', 'mint', 1800, 120, 80, 10], ['sparkle', 'ink', 1060, 960, 44]], B(1, 2.5), BEAT / 2);
}

/* ---------------- sf-payoff · 「交换已接受」 ---------------- */
{
  const t0 = B(3), sh = DM.shot('sf-payoff', t0, B(5), { cam: [[t0, { s: 1.05 }], [B(3, 1.4), { s: 1.0 }, DM.E.outExpo], [B(4, 4.5), { s: 1.03 }, DM.E.ioSine]] });
  const W = 470, k = (W - 44) / 1080, Z = { s: 1.32, fx: 540 * k, fy: 760 * k };
  DM.burst(sh, { x: 1430, y: 520, rOut: 600, rIn: 450, n: 26, color: 'yellow', z: 1, spin: 10 }).in('grow', t0, { dur: 0.2, log: false });
  const ph = DM.phone(sh, { w: W, x: 1430, y: 548, r: -2.5, z: 5, shadow: 'pink', src: '/shots/shots/p13-exchange-accepted.png', zoom: [[t0, Z]] });
  ph.in('slam', t0, { big: 1.4 });
  DM.confetti(sh, { t: t0, x: 1430, y: 420, n: 16, z: 3, id: 'cf-pay', a0: -178, a1: -2, v0: 1200, v1: 2100 });
  const st = DM.title(sh, { text: '交换已接受', x: 90, y: 255, size: 205, sticker: 'mint', shadow: null, z: 8, r: -4 });
  st.in('slam', t0, { big: 1.7 });
  DM.deco(sh, { kind: 'star', color: 'yellow', size: 130, x: 1070, y: 150, z: 9, r: 12 }).in('pop', B(3, 1.5));
  DM.title(sh, { text: '同一刻，', x: 120, y: 540, size: 140, z: 7 }).in('slam', B(3, 3));
  DM.title(sh, { text: '[两面]都齐了。', x: 120, y: 735, size: 165, ks: 1.25, key: 'pink', z: 7 }).in('slam', B(4));
  DM.chip(sh, { text: '双方同意 · 随时可撤销', size: 40, color: 'mint', x: 400, y: 945, r: -2, z: 8 }).in('pop', B(4, 3));
  // you (失真) and 阿遥·示例, the two sides of the swap, jumping on every beat
  DM.svgcut(sh, { src: '/shots/avatars/look-4-shizhen-front.svg', w: 104, x: 860, y: 1095, ay: 1, z: 8, r: -4 }).in('pop', B(3, 2)).bob(B(3, 2), B(5), 24, BEAT);
  DM.svgcut(sh, { src: '/shots/avatars/cast-yao.svg', w: 104, x: 1000, y: 1095, ay: 1, z: 8, r: 4 }).in('pop', B(3, 2.5)).bob(B(3, 2.5), B(5), 24, BEAT);
  DM.deco(sh, { kind: 'heart', color: 'pink', size: 70, x: 930, y: 805, z: 9 }).in('pop', B(4, 4));
  DM.text(sh, { text: '双方明确同意之后，才交换。', font: 'hand', x: 125, y: 1040, size: 34, color: '--ink2', z: 8 }).in('fade', B(4, 3), { log: false });
}

/* ---------------- sf-end · end card ---------------- */
{
  const t0 = B(5), sh = DM.shot('sf-end', t0, B(7) + 0.5, { cam: [[t0, { s: 1.0 }], [B(6, 4.5), { s: 1.02 }, DM.E.ioSine]] });
  DM.logo(sh, { x: 120, y: 112, ax: 0, size: 112, r: -2, z: 6 }).in('pop', B(5, 2));
  DM.title(sh, { text: '同一刻，', x: 110, y: 345, size: 240, z: 5 }).in('slam', t0);
  DM.title(sh, { text: '另一面。', x: 110, y: 610, size: 240, z: 6, hl: { color: 'mint', t: B(5, 1.75), dur: BEAT } }).in('slam', B(5, 1.5));
  DM.text(sh, { text: '和同场的人，[交换]彼此的视角。', x: 125, y: 800, size: 60, z: 6, key: 'pink' }).in('fade', B(5, 3), { dur: 0.15 });
  // link + QR (QR modules are never rotated by more than 3 degrees)
  DM.chip(sh, { text: 'musicmapteam.github.io/musicSpace/', size: 44, x: 1440, y: 140, z: 8, r: -2, style: { fontFamily: 'var(--f-digits)' } }).in('pop', B(5, 4));
  DM.text(sh, { text: '浏览器直接打开 · 无需安装', x: 1440, y: 232, ax: 0.5, size: 42, z: 8 }).in('fade', B(6), { dur: 0.15 });
  const card = DM.card(sh, { w: 470, hgt: 470, x: 1440, y: 545, r: -3, z: 7, pad: '30px', html: '<img src="/assets/qr.svg" style="width:404px;height:404px;display:block;image-rendering:pixelated">' });
  card.in('slap', B(5, 3), { big: 1.12, spin: 3 });
  DM.tape(sh, { x: 1240, y: 318, r: -32, z: 8, w: 160 }).in('none', B(5, 3), { log: false });
  DM.tape(sh, { x: 1650, y: 306, r: 28, color: 'p', z: 8, w: 160 }).in('none', B(5, 3), { log: false });
  DM.stroke(sh, { color: 'pink', width: 8, t: B(6), dur: BEAT * 0.7, z: 7, label: 'arrow to QR', gen: r => DM.paths.curve([[1000, 520], [1070, 470], [1140, 495], [1175, 545]], r, { jit: 4 }) + ' ' + DM.paths.line([[1150, 535], [1177, 548], [1182, 516]], r, { jit: 2 }) });
  DM.text(sh, { text: '扫一扫！', font: 'note', x: 860, y: 480, size: 70, color: '--pink', r: -8, z: 8 }).in('pop', B(6), { log: false });
  // the cast (labelled 示例) and your avatar peeking up from the bottom edge, under the QR
  const cast = [['/shots/avatars/cast-yao.svg', 1205], ['/shots/avatars/cast-man.svg', 1355], ['/shots/avatars/look-4-shizhen-front.svg', 1505], ['/shots/avatars/cast-bei.svg', 1655]];
  cast.forEach(([src, x], i) => DM.svgcut(sh, { src, w: 140, x, y: 1190, ay: 1, z: 4, r: [-4, 3, -2, 4][i] }).in('slide', B(6, 1 + i * 0.5), { dy: 280, dur: 0.3 }).bob(B(6, 3), B(7, 1), 10));
  DM.chip(sh, { text: '示例角色', size: 30, color: 'yellow', x: 1810, y: 905, z: 9, r: 5 }).in('pop', B(6, 3));
  DM.fine(sh, { text: '示例角色与照片为虚构（照片由 AI 生成）· 角色自动回复 · 数据只存在你的浏览器', x: 120, y: 975, ax: 0, z: 9, size: 26 }).in('fade', B(6, 2), { log: false });
  DM.fine(sh, { text: '配乐：Wax Lyricist《Flipping In》· CC0 1.0 公共领域', x: 120, y: 1015, ax: 0, z: 9, size: 26 }).in('fade', B(6, 2), { log: false });
  decos(sh, [['star', 'yellow', 1040, 130, 96], ['heart', 'pink', 1840, 300, 80, 8], ['sparkle', 'mint', 1830, 700, 60], ['star', 'pink', 1010, 760, 70, -8], ['plus', 'ink', 1040, 900, 48]], B(5, 2.5), BEAT / 2);
}
window.__ready = DM.layout().then(DM.info);
