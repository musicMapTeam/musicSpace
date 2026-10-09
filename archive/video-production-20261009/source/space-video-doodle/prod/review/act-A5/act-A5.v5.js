/* Music Space · Doodle video — ACT A5 AFTER THE SWAP 交换之后 (storyboard bars 55-72).
 * Words: SCRIPT.md T090-T112, every line through DM.say (text, font, recipe, entrance, in/out from script/out/timeline.json).
 * Pictures and beats: STORYBOARD.md S1-S11, a fast montage on the social groove, one feature per card, all real footage:
 *   S1 55-56  P-12 小满's person card: tap 「向 小满·示例 招个手」 on 55:3, page-flip over the ~3 s wait into 「你们已经认识了」 on 56:1
 *   S2 57-58  P-13 ONE TO ONE: the chat opens on 57:1, typing on 32nds (57:3), send on 58:1, the auto-reply on 58:3 (wait cut)
 *   S3 59     D-04 (desktop 4K master) 林间·示例 close-up, cut to her card on 59:3, mint underline under the quiet line on 59:4
 *   S4 60     P-14 散场聊天室 (from f262: the action row already slid past the Music Map chip), the message scroll on 60:3
 *   S5 61-62  P-15 专辑世界杯: VS on 61:1, 选《午夜站台》 61:3, tick 62:1, 确认这一票 62:2, 「2票 · 你选了这张」 62:3
 *   S6 63-64  P-16 默契局: 我选「午夜站台」 63:2, tick 63:3, 先保留我的选择 63:4, the reveal 「2 人选择 · 本轮有共同选择」 64:1 (wait cut)
 *   S7 65-66  P-17 音乐社群: title typed on 16ths from 65:1, tick 65:3, create 65:4, the community room 66:1 (zoomed so the action row
 *             with the Music Map chip stays out of frame)
 *   S8 67     P-18 创作角 invitation: tick 67:2, create 67:3, underline 「你不能替对方同意」 67:4 (the cast never joins: no result shown)
 *   S9 68-70  P-19 recap 「把这一晚，留在手里。」, 保存我的纪念卡 68:3, ticks 69:1-69:3, download 69:4; the real downloaded PNG (CUT-08)
 *             lands on the paper on 70:1, tapes 70:2 / 70:3
 *   S10 71    P-20 MY SPACE; the four tiles of this act underlined on 8ths from 71:3
 *   S11 72    drum-roll recap: CUT-01..08 slap on every 8th, then all fly off on 72:4.75 (A6 starts on clean paper at 73:1)
 * Layout: segments share one phone so the frame stays put and only the screen cuts on the beat (X5); every feature gets its own
 * colour (phone shadow + a torn backing scrap that slaps on with it).  Deviation from STORYBOARD (documented in the report): S4 is
 * L2 (phone right) instead of L1, so T096 can stay on its bottom-left card to 60:3 and T097 can stay to 61:3 while S5 (L2) starts
 * (the script keeps both lines across those cuts); S9 keeps the phone on the left (L1) and lands the card in the right column so
 * S10 continues without a layout jump.
 * Clip speed: the phone/desktop takes put their taps on a 123 BPM grid; feeds play at rate R = map BPM / 123 so taps stay on beats
 * under any music option (1.0 for Flipping In).  Real waits are cut on the beat (S1, S2, S6), never shown.
 * Disclosures: T094 示例角色 · 自动回复 (57:3), T100 原创虚构专辑 (61:3), the cast's own 「·示例」 labels in every room shot, and
 * T025 照片为 AI 生成的示例图 fixed top right from 68:1 while the sample photos (crops of the AI images) are on screen.
 * Local primitives (not in dm/): feed() anchor a capture frame to a beat, bubble() a doodle speech bubble, flipX() a card flip of a
 * node, backing() the torn colour scrap behind the phone, shadowSeq() phone shadow colour per feature, flyOff() S11 exit.
 */
(() => {
  const E = DM.E, clamp = DM.clamp, lerp = DM.lerp;
  const beat = DM.beatS();
  const say = DM.say;
  const MAP = DM.map() || {};
  const R = (MAP.bpm || 123) / 123;
  const f2s = f => f / 60;
  const Tc = DM.Tc;

  // ---------------------------------------------------------------- local primitives
  /** feed: play `clip` from `at` so that source frame `f` is on screen at `anchor` (rate R keeps 123-BPM taps on this map's beats) */
  const feed = (clip, at, anchor, f) => DM.play(clip, { at, from: Math.max(0, f2s(f) - (Tc(anchor) - Tc(at)) * R), rate: R });
  /** source second of `clip` frame f played at rate R for (to - from) output seconds */
  const srcAfter = (f, from, to) => f2s(f) + (Tc(to) - Tc(from)) * R;
  /** horizontal card flip around `at`: the node closes edge-on just before `at` and opens again after it (X9 page flip) */
  const flipX = (node, at, close = 0.2, open = 0.15) => {
    const m = DM.T(at); if (m === null) return node; const a = m - close, b = m + open;
    return node.track(t => (t < a || t > b) ? null : { sx: t < m ? lerp(1, 0.04, E.inQ((t - a) / close)) : lerp(0.04, 1, E.outBack((t - m) / open, 1.5)), r: t < m ? -3 * (t - a) / close : 3 * (1 - (t - m) / open) });
  };
  /** phone shadow colour per feature: list [[at, 'pink'|'mint'|'yellow'], ...] */
  const shadowSeq = (ph, list) => {
    const ts = list.map(([at, c]) => [Tc(at), c]);
    return ph.track(t => { let c = ts[0][1]; for (const [x, col] of ts) if (x <= t + 1e-6) c = col; if (c !== ph._shc) { ph._shc = c; ph.shPath.style.fill = `var(--${c})`; } return null; });
  };
  /** torn colour scrap behind the phone for one feature (slaps on with the cut, gone at the next) */
  const backing = (sh, P, at, until, color, i, sfx = 'slap') => DM.scrap(sh, { w: 600, hgt: 880, color, x: P.x + (i % 2 ? 26 : -26), y: P.y + 14, r: P.r * 2 + (i % 2 ? 5 : -5), z: 2, jag: 9, shadow: false, label: 'scrap ' + color })
    .in('slap', at, { big: 1.1, spin: i % 2 ? -5 : 5, dy: -18, sfx, gain: -7, note: i, label: 'backing ' + color }).show(undefined, until);
  /** doodle speech bubble (ink outline, colour fill, hard ink shadow, tail left/right) with three dots or a heart inside */
  const bubble = (sh, o) => {
    const W = o.w || 150, H = o.hgt || 104, tail = o.tail || 'left', fill = DM.COLORS[o.color || 'card'] || o.color;
    const tx = tail === 'left' ? W * 0.28 : W * 0.72, dir = tail === 'left' ? -1 : 1;
    const d = `M18,4 H${W - 18} Q${W - 4},4 ${W - 4},20 V${H - 34} Q${W - 4},${H - 18} ${W - 18},${H - 18} H${tx + 16} L${tx + dir * 20},${H - 2} L${tx - 4},${H - 18} H18 Q4,${H - 18} 4,${H - 34} V20 Q4,4 18,4 Z`;
    const inner = o.heart ? `<path transform="translate(${W / 2 - 17} ${(H - 18) / 2 - 16}) scale(1.06)" d="${DM.shapes.heart.d}" fill="var(--pink)" stroke="var(--ink)" stroke-width="2.6" stroke-linejoin="round"/>`
      : [0, 1, 2].map(k => `<circle cx="${W / 2 + (k - 1) * 28}" cy="${(H - 18) / 2 + 1}" r="7.5" fill="var(--ink)"/>`).join('');
    const el = DM.h('div'); el.innerHTML = `<svg width="${W + 12}" height="${H + 12}" viewBox="0 0 ${W + 12} ${H + 12}" style="display:block;overflow:visible"><path d="${d}" transform="translate(8 9)" fill="var(--ink)"/><path d="${d}" fill="${fill}" stroke="var(--ink)" stroke-width="5" stroke-linejoin="round"/>${inner}</svg>`;
    return DM.node(sh, el, Object.assign({ boil: { px: 0.8, deg: 0.8 }, layer: 18, ay: 1 }, o));
  };
  /** marker loop / underline glued to a device's footage (source px).  The library helpers also use numeric x/y as the node
   *  position, which would offset the path a second time, so these build the path and leave the node at 0,0. */
  const circleOn = (dev, o) => dev.annotate(Object.assign({ color: 'pink', width: 9, label: 'circle' }, o, { x: undefined, y: undefined, gen: r => DM.paths.loop(o.x, o.y, o.rx, o.ry, r, o) }));
  const underlineOn = (dev, o) => dev.annotate(Object.assign({ color: 'pink', width: 9, label: 'underline' }, o, { x0: undefined, x1: undefined, y: undefined,
    gen: r => o.wavy ? DM.paths.wave(o.x0, o.x1, o.y, r, o) : DM.paths.curve([[o.x0, o.y], [lerp(o.x0, o.x1, 0.5), o.y + (o.sag ?? 4)], [o.x1, o.y - 2]], r, { jit: 4 }) }));
  /** S11: fly every piece out from the centre in `dur` seconds from `at` (ease-in, with spin) */
  const flyOff = (node, at, dur, cx, cy, i) => { const t0 = DM.T(at); if (t0 === null) return node;
    const dx = node.x - cx, dy = node.y - cy, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    return node.track(t => { const u = clamp((t - t0) / dur); return u <= 0 ? null : { x: ux * 1500 * E.inQ(u), y: uy * 1100 * E.inQ(u), r: (i % 2 ? 1 : -1) * 40 * u, s: 1 - 0.35 * u }; }); };

  // layout (STORYBOARD §1.5): L1 phone left + type column from x 840; L2 phone right + type column x 130
  const L1 = { x: 455, y: 540, r: -2 }, L2 = { x: 1475, y: 540, r: 2 };
  const COLR = 840, COLL = 130;

  // ======================================================================= SEG A · S1 + S2 · 55:1 -> 59:1 (L1, one phone, screen swap on 57:1)
  {
    const P12 = DM.clip('P-12'), P13 = DM.clip('P-13');
    const sh = DM.shot('A5-S1S2-friends-chat', '55:1', '59:1', { drift: { s: 1.03, x: -6, y: 0 } });
    const ty = DM.shot('A5-S1S2-type', '55:1', '59:1', { paper: false, z: 30, drift: null, log: false });
    sh.pulse(['55:1', '57:1'], 0.016, 0.12);
    sh.pulse(['55:3', '56:1', '56:3', '57:3', '58:1', '58:3'], 0.006, 0.1);
    const media = DM.seq(
      feed(P12, '55:1', '55:3', 199),                                   // S1: greet click (f199) on 55:3, toast right after
      '56:1', feed(P12, '56:1', '56:1', 376),                           // page flip over the real ~3 s wait -> 「你们已经认识了」, ♡ 2 at f391 (56:1.5)
      '57:1', DM.ramp(P13, [['57:1', f2s(63)], ['57:3', f2s(154), E.lin], ['58:1', f2s(271), E.lin], ['58:3', srcAfter(271, '58:1', '58:3'), E.lin]]),
      '58:3', feed(P13, '58:3', '58:3', 520));                          // S2: open 57:1, composer tap ~57:2.7, typing 2x (32nds) 57:3, send 58:1, reply 58:3
    const ph = DM.phone(sh, { media, x: L1.x, y: L1.y, r: L1.r, shadow: 'pink', z: 10, label: 'phone S1/S2',
      view: [['55:1', { s: 1.0 }], ['55:2.6', { s: 1.0 }], ['55:3', { s: 1.3, x: 490, y: 1470 }, E.outC], ['55:4.8', { s: 1.32, x: 490, y: 1470 }],
        ['56:1', { s: 1.0, x: 540, y: 1170 }, E.step], ['56:2', { s: 1.0, x: 540, y: 1170 }], ['56:2.5', { s: 1.25, x: 470, y: 1370 }, E.outC], ['56:4.9', { s: 1.28, x: 470, y: 1370 }],
        ['57:1', { s: 1.0, x: 540, y: 1170 }, E.step], ['57:2', { s: 1.0, x: 540, y: 1170 }], ['57:2.75', { s: 1.45, x: 450, y: 2050 }, E.ioC], ['57:4.9', { s: 1.48, x: 450, y: 2050 }],
        ['58:1', { s: 1.12, x: 540, y: 1350 }, E.outC], ['59:1', { s: 1.15, x: 540, y: 1350 }, E.ioSine]] });
    ph.in('slap', '55:1', { big: 1.06, spin: -4, dy: -20, sfx: 'none', log: false });
    ph.pulse(['57:1'], 0.035, 0.1);
    flipX(ph, '56:1');
    DM.ev('56:1', 'flip', 'page flip over the greet wait', { sfx: 'flip', gain: -2 });
    DM.ev('57:1', 'cut', 'S2 screen swap: chat opens', { sfx: 'none' });
    backing(sh, L1, '55:1', '57:1', 'yellow', 0);
    backing(sh, L1, '57:1', '59:1', 'mint', 1);
    // taps that are in the footage (the rig's tap ring): sounds + events on their beats
    DM.ev('55:3', 'tap', 'tap 向 小满·示例 招个手');
    circleOn(ph, { x: 540, y: 1588, rx: 510, ry: 96, at: '55:2', dur: beat * 0.6, erase: '55:3', color: 'pink', width: 8, label: 'circle the greet button' });
    DM.deco(sh, { parent: ph.screen, kind: 'sparkle', color: 'pink', size: 44, x: 708 * 0.4, y: 40 * 0.4, z: 5 }).in('pop', '56:1.5', { gain: -8, label: '♡ 2 sparkle' }).out('pop', '57:1');
    DM.ev('57:2.75', 'tap', 'tap the composer', { gain: -6 });
    DM.ev('57:3', 'type', 'typing 返场那首我在人海里，手都举酸了！', { dur: Tc('58:1') - Tc('57:3'), note: 16, gain: -2 });
    DM.ev('58:1', 'tap', 'send', { sfx: 'blip', gain: 0 });
    DM.ev('58:3', 'cut', 'reply lands (wait cut)', { sfx: 'blip', gain: 0, note: 5 });
    ph.punch('58:1', { s: 1.25, x: 640, y: 990 }, { until: '58:2.5', sfx: 'none', label: 'punch my bubble' });
    ph.punch('58:3', { s: 1.3, x: 420, y: 1180 }, { until: '59:1', sfx: 'none', label: 'punch the reply' });
    // the two new friends: 阿宁 (you) and 小满·示例, the product's own avatars, at the foot of the type column
    const you = DM.sticker(sh, { src: 'visitor-aning-shizhen-front', w: 128, x: 1250, y: 1012, ay: 1, z: 6, r: -2, label: 'avatar 阿宁' }).in('pop', '55:2', { gain: -9, note: 2 });
    const man = DM.sticker(sh, { src: 'cast-man-front', w: 128, x: 1600, y: 1012, ay: 1, z: 6, r: 2, label: 'avatar 小满·示例' }).in('pop', '55:2.5', { gain: -9, note: 4 });
    you.bob('56:3', '57:1', 14, beat / 2); man.bob('56:3', '57:1', 14, beat / 2);
    you.bob('58:1', '58:2', 10, beat / 2); man.bob('58:3', '58:4', 10, beat / 2);
    DM.deco(sh, { kind: 'heart', color: 'pink', size: 132, x: 1425, y: 860, z: 9, r: -6, lw: 1.1 }).in('spring', '56:3', { sfx: 'boop', gain: -2, label: 'big heart' }).out('pop', '57:1');
    DM.pops(sh, [['heart', 'yellow', 1330, 760, 54, 10], ['sparkle', 'mint', 1520, 760, 50]], '56:3.5', beat / 2, { z: 9, gain: -10 }).forEach(n => n.out('pop', '57:1'));
    bubble(sh, { x: 1255, y: 708, w: 150, hgt: 104, color: 'mint', tail: 'right', z: 9, label: 'bubble 阿宁' }).in('pop', '58:1', { sfx: 'none', label: 'bubble send' }).wiggle('58:4', '59:1', 5, 5);
    bubble(sh, { x: 1595, y: 708, w: 150, hgt: 104, color: 'card', tail: 'left', heart: true, z: 9, label: 'bubble 小满' }).in('pop', '58:3', { sfx: 'none', label: 'bubble reply' }).wiggle('58:4', '59:1', 5, 5);
    // type (right column)
    say(ty, 'T090', { x: COLR, y: 200 });
    say(ty, 'T091', { x: COLR, y: 470 });
    say(ty, 'T092', { x: COLR, y: 218 });
    say(ty, 'T093', { x: COLR, y: 405 });
    say(ty, 'T094', { x: 1050, y: 560, r: -3, z: 25 });
  }

  // ======================================================================= SEG B · S3 · 59:1 -> 60:1 (L4 desktop, slap-on)
  {
    const D04 = DM.clip('D-04-linjian-quiet');
    const sh = DM.shot('A5-S3-quiet', '59:1', '60:1', { drift: { s: 1.02 }, enter: { kind: 'slap', sfx: 'slap' } });
    sh.pulse(['59:3'], 0.012, 0.1);
    const desk = DM.desk(sh, { media: DM.seq(feed(D04, '59:1', '59:1', 200), '59:3', feed(D04, '59:3', '59:3', 380)), w: 1800, x: 960, y: 540, srcW: 3840, srcH: 2160,
      view: [['59:1', { s: 1.0, u: 0.5, v: 0.5 }], ['59:2.9', { s: 1.05, u: 0.47, v: 0.5 }, E.ioSine], ['59:3', { s: 1.05, u: 0.62, v: 0.5 }, E.step], ['60:1', { s: 1.1, u: 0.66, v: 0.5 }, E.ioSine]] });
    desk.show('59:1');
    DM.ev('59:3', 'cut', 'S3 cut to 林间·示例 card', { sfx: 'none' });
    underlineOn(desk, { x0: 2740, x1: 3320, y: 1205, at: '59:4', dur: beat * 0.7, color: 'mint', width: 8, label: 'mint underline 不接收新招呼' });
    // die cards bottom-left (L4: type over footage sits on paper) — on their own layer so T096 can stay into S4 (to 60:3)
    const ty = DM.shot('A5-S3-cards', '59:1', '60:4', { paper: false, z: 35, drift: null, log: false });
    const cA = DM.card(ty, { w: 700, hgt: 168, x: 445, y: 718, r: -2, z: 4 }).in('slap', '59:1', { big: 1.0, spin: -6, dy: -40, sfx: 'none', log: false }).out('pop', '60:1');
    const cB = DM.card(ty, { w: 700, hgt: 168, x: 470, y: 892, r: 1.5, z: 5 }).in('slap', '59:3', { big: 1.0, spin: 6, dy: -40, sfx: 'none', log: false }).out('pop', '60:3');
    say(ty, 'T095', { parent: cA, x: 40, y: 84 });
    say(ty, 'T096', { parent: cB, x: 40, y: 84 });
  }

  // ======================================================================= SEG C · S4 + S5 + S6 · 60:1 -> 65:1 (L2, one phone, swaps on 61:1 and 63:1)
  {
    const P14 = DM.clip('P-14'), P15 = DM.clip('P-15'), P16 = DM.clip('P-16');
    const whipKeys = [['60:1', { x: 0, y: 0, s: 1 }], ['64:4.5', { x: -10, y: 0, s: 1.02 }, E.ioSine], ['65:1', { x: -1500, y: 0, s: 1.04 }, E.inExpo]];
    const blur = [['64:4.5', 0], ['64:4.75', 12], ['65:1', 60, E.inQ]];
    const sh = DM.shot('A5-S4S6-room-cup-game', '60:1', '65:1', { drift: null, cam: whipKeys, blur, enter: { kind: 'slap', sfx: 'slap' } });
    const ty = DM.shot('A5-S4S6-type', '60:1', '65:1', { paper: false, z: 30, drift: null, log: false, blur, cam: [['64:4.5', { x: 0 }], ['65:1', { x: -1500 }, E.inExpo]] });
    sh.pulse(['61:1', '63:1', '64:1'], 0.016, 0.12);
    sh.pulse(['60:3', '61:3', '62:1', '62:3', '63:3', '64:3'], 0.006, 0.1);
    const media = DM.seq(
      feed(P14, '60:1', '60:3', 320),                                   // S4: 散场聊天室 after the chip row slid (no Music Map chip); message scroll on 60:3
      '61:1', feed(P15, '61:1', '61:1', 219),                           // S5: VS 61:1, 选《午夜站台》 61:3, tick 62:1, 确认这一票 62:2, 2票 scroll 62:3
      '63:1', DM.ramp(P16, [['63:1', f2s(511)], ['63:2', f2s(540), E.lin], ['63:3', f2s(579), E.lin], ['63:4', f2s(609), E.lin], ['64:1', srcAfter(609, '63:4', '64:1'), E.lin]]),
      '64:1', feed(P16, '64:1', '64:1', 796));                          // S6: 我选「午夜站台」 63:2, tick 63:3, 先保留 63:4, reveal 64:1 (wait cut)
    const ph = DM.phone(sh, { media, x: L2.x, y: L2.y, r: L2.r, shadow: 'mint', z: 10, label: 'phone S4-S6',
      view: [['60:1', { s: 1.0, x: 540, y: 1170 }], ['60:4.8', { s: 1.1, x: 540, y: 1300 }, E.ioSine],
        ['61:1', { s: 1.12, x: 540, y: 1300 }, E.step], ['61:2.9', { s: 1.12, x: 540, y: 1300 }], ['61:3.3', { s: 1.12, x: 540, y: 1820 }, E.ioC],
        ['62:3', { s: 1.12, x: 540, y: 1820 }], ['62:3.6', { s: 1.22, x: 540, y: 1180 }, E.ioC], ['62:4.9', { s: 1.25, x: 540, y: 1180 }],
        ['63:1', { s: 1.2, x: 540, y: 1520 }, E.step], ['63:4.9', { s: 1.24, x: 540, y: 1520 }],
        ['64:1', { s: 1.5, x: 320, y: 1660 }, E.step], ['65:1', { s: 1.58, x: 320, y: 1660 }, E.ioSine]] });
    shadowSeq(ph, [['60:1', 'mint'], ['61:1', 'yellow'], ['63:1', 'pink']]);
    ph.pulse(['61:1', '63:1'], 0.035, 0.1);
    DM.ev('61:1', 'cut', 'S5 screen swap: 专辑世界杯', { sfx: 'scratch', gain: -2 });
    DM.ev('63:1', 'cut', 'S6 screen swap: 默契局', { sfx: 'none' });
    DM.ev('64:4.5', 'slide', 'whip pan to the next card', { sfx: 'whoosh', gain: -4 });
    backing(sh, L2, '60:1', '61:1', 'pink', 2);
    backing(sh, L2, '61:1', '63:1', 'mint', 3, 'none');            // 61:1 belongs to the vinyl scratch
    backing(sh, L2, '63:1', '65:1', 'yellow', 4);
    // S4: the room keeps talking — three notes on 8ths, receive blips
    DM.pops(sh, [['note', 'ink', 1180, 170, 66, -12], ['note', 'mint', 1120, 330, 54, 8], ['note', 'pink', 1205, 470, 48, -6]], '60:2', beat / 2, { z: 14, sfx: 'blip', gain: -6 }).forEach(n => n.out('pop', '61:1'));
    // S5: VS punch + taps in the footage
    ph.punch('61:1', { s: 1.09, x: 542, y: 1290 }, { until: '61:2.5', sfx: 'none', label: 'punch VS' });
    DM.burst(sh, { x: 1250, y: 175, rOut: 150, rIn: 112, n: 16, color: 'yellow', spin: 22, z: 3 }).in('grow', '61:1', { dur: 0.16, log: false }).out('shrink', '62:4', { dur: 0.16 });
    DM.ev('61:3', 'tap', 'tap 选《午夜站台》');
    DM.ev('62:1', 'tap', 'tick 确认投票', { sfx: 'tick' });
    DM.ev('62:2', 'tap', 'tap 确认这一票');
    DM.deco(sh, { parent: ph.screen, kind: 'star', color: 'yellow', size: 64, x: 250 * 0.4, y: 1205 * 0.4, z: 5, r: 10 }).in('pop', '62:3.5', { sfx: 'ding', gain: -4, label: 'star on 2票' }).out('pop', '63:1');
    // S6: taps, then the reveal; sparkles on the shared choice
    DM.ev('63:2', 'tap', 'tap 我选「午夜站台」');
    DM.ev('63:3', 'tap', 'tick 确认提交本轮选择', { sfx: 'tick' });
    DM.ev('63:4', 'tap', 'tap 先保留我的选择');
    DM.ev('64:1', 'cut', 'reveal (wait cut)', { sfx: 'swish', gain: -4 });
    DM.burst(ty, { x: 420, y: 640, rOut: 178, rIn: 136, n: 18, color: 'yellow', spin: 18, z: 1, shx: 10, shy: 11 }).in('grow', '64:1', { dur: 0.16, log: false }).out('shrink', '64:4.5', { dur: 0.14 });
    DM.pops(sh, [['sparkle', 'yellow', 300 * 0.4, 1560 * 0.4, 46], ['star', 'pink', 520 * 0.4, 1420 * 0.4, 40, 12], ['sparkle', 'mint', 90 * 0.4, 1460 * 0.4, 34]], '64:3', beat / 4, { parent: ph.screen, z: 6, sfx: 'sparkle', gain: -6 }).forEach(n => n.out('pop', '65:1'));
    // type (left column); T100 chip sticks to the phone's bottom-left corner ("under the phone")
    say(ty, 'T097', { x: COLL, y: 285 });
    say(ty, 'T098', { x: COLL, y: 600 });
    say(ty, 'T099', { x: COLL, y: 880 });
    say(ty, 'T100', { x: 1290, y: 968, r: -4, z: 25 });
    say(ty, 'T101', { x: COLL, y: 220 });
    say(ty, 'T102', { x: COLL, y: 410 });
    say(ty, 'T103', { x: COLL, y: 630 });
  }

  // ======================================================================= SEG D · S7 + S8 + S9 + S10 · 65:1 -> 72:1 (L1, slides in from the right)
  {
    const P17 = DM.clip('P-17'), P18 = DM.clip('P-18'), P19 = DM.clip('P-19'), P20 = DM.clip('P-20');
    const enter = { kind: 'slide', dx: 760, dur: 0.14, sfx: 'swish' };
    const sh = DM.shot('A5-S7S10-community-corner-card-myspace', '65:1', '72:1', { drift: { s: 1.03, x: -8, y: 0 }, enter });
    const ty = DM.shot('A5-S7S10-type', '65:1', '73:1', { paper: false, z: 30, drift: null, log: false, enter: Object.assign({}, enter, { sfx: 'none' }) });
    sh.pulse(['67:1', '68:1', '70:1', '71:1'], 0.016, 0.12);
    sh.pulse(['65:3', '66:1', '66:3', '67:3', '68:3', '69:1', '69:3', '70:3', '71:3'], 0.006, 0.1);
    const media = DM.seq(
      feed(P17, '65:1', '65:1', 130),                                   // S7: 周五散场以后 typed on 16ths from 65:1, tick 65:3, 创建我的社群 65:4
      '66:1', feed(P17, '66:1', '66:1', 276),                           // the community room on 66:1
      '67:1', feed(P18, '67:1', '67:1', 233),                           // S8: corner sheet 67:1, tick 67:2, 创建共同创作邀请 67:3
      '68:1', feed(P19, '68:1', '68:1', 193),                           // S9: recap 68:1, 保存我的纪念卡 68:3, ticks 69:1-3, 下载纪念卡 PNG 69:4
      '71:1', feed(P20, '71:1', '71:1', 63));                           // S10: MY SPACE on 71:1
    const ph = DM.phone(sh, { media, x: L1.x, y: L1.y, r: L1.r, shadow: 'mint', z: 10, label: 'phone S7-S10',
      view: [['65:1', { s: 1.5, x: 400, y: 1350 }], ['65:4.9', { s: 1.55, x: 400, y: 1350 }],
        ['66:1', { s: 2.0, x: 300, y: 585 }, E.step], ['66:3', { s: 2.0, x: 300, y: 585 }], ['66:4.9', { s: 2.16, x: 300, y: 560 }, E.ioSine],
        ['67:1', { s: 1.08, x: 540, y: 1700 }, E.step], ['67:4.9', { s: 1.1, x: 540, y: 1720 }],
        ['68:1', { s: 1.35, x: 470, y: 1250 }, E.step], ['68:3.8', { s: 1.37, x: 470, y: 1250 }], ['69:1', { s: 1.12, x: 482, y: 1045 }, E.ioC],
        ['70:4.9', { s: 1.14, x: 490, y: 1100 }],
        ['71:1', { s: 1.0, x: 540, y: 1170 }, E.step], ['71:1.6', { s: 1.1, x: 510, y: 1060 }, E.outC], ['72:1', { s: 1.12, x: 510, y: 1060 }]] });
    shadowSeq(ph, [['65:1', 'mint'], ['67:1', 'pink'], ['68:1', 'yellow'], ['71:1', 'mint']]);
    ph.pulse(['67:1', '68:1', '71:1'], 0.035, 0.1);
    DM.ev('66:1', 'cut', 'S7 the community room', { sfx: 'whoosh', gain: -6 });
    DM.ev('67:1', 'cut', 'S8 screen swap: 创作角', { sfx: 'none' });
    DM.ev('68:1', 'cut', 'S9 screen swap: recap', { sfx: 'none' });
    DM.ev('71:1', 'cut', 'S10 screen swap: MY SPACE', { sfx: 'none' });
    backing(sh, L1, '65:1', '67:1', 'yellow', 5);
    backing(sh, L1, '67:1', '68:1', 'mint', 6);
    backing(sh, L1, '68:1', '71:1', 'pink', 7);
    backing(sh, L1, '71:1', '72:1', 'yellow', 8);
    // S7 taps / typing in the footage
    DM.ev('65:1', 'type', 'typing 周五散场以后', { dur: beat * 6 / 4, note: 6, gain: -2 });
    DM.ev('65:3', 'tap', 'tick 创建长期空间', { sfx: 'tick' });
    DM.ev('65:4', 'tap', 'tap 创建我的社群');
    ph.punch('66:3', { s: 1.06, x: 300, y: 430 }, { until: '67:1', sfx: 'none', label: 'push the 3D header' });
    DM.pops(sh, [['star', 'yellow', 770, 140, 70, -8], ['plus', 'mint', 760, 300, 44]], '66:1.5', beat / 2, { z: 14, gain: -10 }).forEach(n => n.out('pop', '67:1'));
    // S8
    DM.ev('67:2', 'tap', 'tick 我选择邀请这位朋友', { sfx: 'tick' });
    DM.ev('67:3', 'tap', 'tap 创建共同创作邀请');
    underlineOn(ph, { x0: 528, x1: 925, y: 2022, wavy: true, amp: 7, wl: 46, at: '67:4', dur: beat * 0.6, color: 'pink', width: 7, label: 'underline 你不能替对方同意' });
    // S9: ticks on 69:1 / 69:2 / 69:3 (real checkboxes), download on 69:4, then the real PNG lands on the paper
    DM.ev('68:3', 'tap', 'tap 保存我的纪念卡');
    [[105, 324], [161, 1127], [122, 1382]].forEach(([x, y], i) => {
      DM.deco(sh, { parent: ph.screen, kind: 'sparkle', color: ['yellow', 'mint', 'pink'][i], size: 40, x: (x + 70) * 0.4, y: (y - 40) * 0.4, z: 6 }).in('pop', `69:${1 + i}`, { sfx: 'tick', gain: -2, note: i * 2, label: 'tick ' + (i + 1) }).out('pop', '70:1');
    });
    DM.ev('69:4', 'tap', 'tap 下载纪念卡 PNG');
    const CARD = { x: 1545, y: 450, w: 470 };            // the memory card's landing spot (right column, T110 on its left, T111 under it)
    const crop = [30, 25, 1020, 1392];                     // CUT-08: the card with its own ink border + hard shadow (the PNG's paper margin trimmed)
    const ch = Math.round(CARD.w * crop[3] / crop[2]);
    const cardEl = DM.h('div'); cardEl.style.cssText = `width:${CARD.w}px;height:${ch}px;position:relative`;
    const k = CARD.w / crop[2];
    cardEl.innerHTML = `<div style="position:absolute;left:0;top:0;width:${CARD.w}px;height:${ch}px;overflow:hidden"><img decoding="sync" src="${DM.asset('CUT-08')}" style="position:absolute;left:${(-crop[0] * k).toFixed(1)}px;top:${(-crop[1] * k).toFixed(1)}px;width:${(1080 * k).toFixed(1)}px;height:${(1440 * k).toFixed(1)}px"></div>`;
    const card = DM.node(sh, cardEl, { x: CARD.x, y: CARD.y, r: -3, z: 20, boil: { px: 0.4, deg: 0.15 }, label: 'CUT-08 memory card PNG' }).show('70:1');
    // fly out of the phone screen on 70:1: from the phone (scale .25, -10 deg) to the landing spot in 9 frames, ease-out-back
    const t70 = DM.T('70:1');
    if (t70 !== null) {
      const fromX = L1.x - CARD.x, fromY = L1.y + 60 - CARD.y;
      card.track(t => { const u = clamp((t - t70) / 0.16); if (u >= 1) return null; const k2 = E.outBack(u, 1.4);
        return { x: lerp(fromX, 0, Math.min(1, E.outC(u))), y: lerp(fromY, 0, Math.min(1, E.outC(u))) - Math.sin(u * Math.PI) * 60, s: lerp(0.25, 1, k2), r: lerp(-10, 0, E.outC(u)) }; });
      DM.ev('70:1', 'slap', 'memory card PNG lands', { sfx: 'slap', gain: 2, note: 0 });
      sh.shake('70:1.1', 6, 4);
      DM.burst(sh, { x: CARD.x, y: CARD.y, rOut: 300, rIn: 232, n: 22, color: 'yellow', spin: 14, z: 4 }).in('grow', '70:1', { dur: 0.18, log: false }).out('shrink', '71:1', { dur: 0.16 });
    }
    DM.tape(sh, { parent: card, color: 'p', x: CARD.w * 0.5, y: 4, r: -4, w: 200, z: 30 }).in('slap', '70:2', { big: 1.6, spin: 9, sfx: 'tape', gain: -2, label: 'tape 1' });
    DM.tape(sh, { parent: card, color: 'm', x: CARD.w - 30, y: ch - 46, r: -38, w: 150, z: 30 }).in('slap', '70:3', { big: 1.6, spin: -9, sfx: 'tape', gain: -3, label: 'tape 2' });
    DM.pops(sh, [['sparkle', 'yellow', CARD.x - 290, CARD.y - 230, 52], ['star', 'pink', CARD.x + 250, CARD.y - 290, 58, 12], ['sparkle', 'mint', CARD.x + 260, CARD.y + 150, 46]], '70:3', beat / 4, { z: 22, sfx: 'sparkle', gain: -6 }).forEach(n => n.out('pop', '71:1'));
    card.move('70:3.5', '70:4.9', { s: 1.03 }, E.ioSine);                 // 70:4 slow push on the card
    // S10 (71:1): the card steps aside — smaller, pinned bottom-right — so 「散场后，仍有地方回来。」 gets the column
    card.move('71:1', '71:1.4', { x: 1720 - CARD.x, y: 838 - CARD.y, s: 0.5 / 1.03, r: 7 }, E.outBack);
    DM.ev('71:1', 'slide', 'memory card steps aside', { sfx: 'swish', gain: -8 });
    // S10: the four tiles of this act underlined on 8ths (real tiles in 我的空间)
    [['我的音乐社群', 110, 430, 1268], ['好友与新招呼', 110, 430, 1458], ['私聊回访', 640, 860, 1458], ['共同记忆', 110, 330, 1652]].forEach(([nm, x0, x1, y], i) => {
      underlineOn(ph, { x0, x1, y, at: `71:${3 + i * 0.5}`, dur: beat * 0.4, color: 'yellow', width: 10, sfx: 'tick', gain: -4, label: 'tile ' + nm });
    });
    // type (right column); T110 sits left of the landing card, T111 under it, T112 takes the column when the card steps aside
    say(ty, 'T104', { x: COLR, y: 225 });
    say(ty, 'T105', { x: 815, y: 430 });
    say(ty, 'T106', { x: COLR, y: 735 });
    say(ty, 'T107', { x: COLR, y: 225 });
    say(ty, 'T108', { x: COLR, y: 420 });
    say(ty, 'T109', { x: COLR, y: 690 });
    say(ty, 'T110', { x: 775, y: 470 });
    // maps that cut bars 71-72 (tea-party, love-love-love) leave T111 one bar; type it on an 8th early there so it stays >= 2.25 s
    say(ty, 'T111', { x: 775, y: 965, at: DM.has('71:1') ? '70:1' : '69:4.5' });
    say(ty, 'T112', { x: 775, y: 270 });
  }

  // ======================================================================= AI-photo disclosure · 68:1 -> 73:1 (fixed on screen, top right)
  // From 68:1 the sample photos are on screen: the memory form's polaroid (P-19), the downloaded memory card (CUT-08), the recap's
  // CUT-03 / CUT-06 / CUT-08.  They are the build's crops of the repo's AI-generated concert images (web/assets/image-provenance.json),
  // so T025's line stays on screen for the whole stretch (top right: the only corner no title or card uses in S9-S11).
  {
    const fx = DM.shot('A5-fixed-ai-note', '68:1', '73:1', { paper: false, z: 45, drift: null, log: false });
    say(fx, 'T025', { x: 1810, y: 80, ax: 1, at: '68:1', until: '73:1', fx: 'FADE', outFx: 'cut' });
  }

  // ======================================================================= SEG E · S11 · 72:1 -> 73:1 (L7 drum-roll recap, every 8th)
  {
    const sh = DM.shot('A5-S11-recap', '72:1', '73:1', { drift: null, cam: [['72:1', { x: 0, y: 0, s: 1.06 }], ['72:4.75', { x: 0, y: 0, s: 1.0 }, E.outC]] });
    sh.pulse(['72:1', '72:2', '72:3', '72:4'], 0.012, 0.08);
    // the first four land clear of T112 (top right, on until 72:3); the last four may cover that corner
    const pieces = [
      ['72:1', () => DM.polaroid(sh, { src: 'CUT-01', w: 600, hgt: 390, x: 420, y: 290, r: -5, z: 2, tape: 'y', tapeW: 150, pos: '42% 50%', label: 'CUT-01 3D room' })],
      ['72:1.5', () => DM.sticker(sh, { src: 'CUT-02s', w: 230, x: 215, y: 800, r: 4, z: 3, label: 'CUT-02 avatar' })],
      ['72:2', () => DM.polaroid(sh, { src: 'CUT-03', w: 520, hgt: 360, x: 660, y: 770, r: 4, z: 4, tape: 'p', tapeW: 140, pos: '50% 34%', label: 'CUT-03 3D wall' })],
      ['72:2.5', () => DM.cutout(sh, { src: 'CUT-04c.opaque', w: 440, hgt: 'auto', maxH: 420, x: 1150, y: 790, r: -3, z: 5, label: 'CUT-04 AI chip' })],
      ['72:3', () => DM.cutout(sh, { src: 'CUT-05', w: 500, hgt: 'auto', maxH: 380, x: 1450, y: 270, r: 3, z: 6, label: 'CUT-05 badge' })],
      ['72:3.5', () => DM.cutout(sh, { src: 'CUT-06', w: 400, hgt: 'auto', maxH: 420, x: 1640, y: 760, r: -4, z: 7, label: 'CUT-06 交换已接受' })],
      ['72:4', () => DM.cutout(sh, { src: 'CUT-07', w: 380, hgt: 'auto', maxH: 380, x: 960, y: 300, r: 5, z: 8, label: 'CUT-07 chat' })],
      ['72:4.5', () => DM.cutout(sh, { src: 'CUT-08', w: 340, hgt: 'auto', maxH: 470, x: 960, y: 590, r: -6, z: 9, pad: 8, label: 'CUT-08 memory card' })],
    ];
    pieces.forEach(([at, make], i) => {
      const n = make().in('slap', at, { big: 1.4, spin: i % 2 ? -10 : 10, dy: -30, sfx: i % 2 ? 'pop' : 'slap', gain: -3, note: i, label: 'recap ' + (i + 1) });
      flyOff(n, '72:4.75', DM.T('73:1') !== null ? Math.max(0.05, DM.T('73:1') - DM.T('72:4.75') - 1 / 60) : 0.12, 960, 540, i);
    });
    DM.ev('72:4.75', 'slide', 'recap flies off', { sfx: 'whoosh', gain: -3 });
  }
})();
