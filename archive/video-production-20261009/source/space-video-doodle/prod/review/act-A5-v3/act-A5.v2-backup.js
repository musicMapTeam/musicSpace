/* Music Space · Doodle video — ACT A5 AFTER THE SWAP 交换之后 (storyboard bars 55-72).
 * Words: SCRIPT.md T090-T112, every line through DM.say (text, font, recipe, entrance, in/out from script/out/timeline.json).
 * Pictures and beats: STORYBOARD.md S1-S11, a fast montage on the social groove, one feature per card, all real footage:
 *   S1 55-56  P-12 小满's person card: tap 「向 小满·示例 招个手」 on 55:3, page-flip over the ~3 s wait into 「你们已经认识了」 on 56:1
 *   S2 57-58  P-13 ONE TO ONE: the chat opens on 57:1, typing on 32nds (57:3), send on 58:1, the auto-reply on 58:3 (wait cut); the
 *             real bubbles pop out of the phone onto the paper as stickers (CUT-07 alpha cut) on 58:1 / 58:3
 *   S3 59     D-04 (desktop 4K master) 林间·示例 close-up, cut to her card on 59:3, mint underline under the quiet line on 59:4
 *   S4 60     P-14 散场聊天室 (from f262: the action row already slid past the Music Map chip), the message scroll on 60:3
 *   S5 61-62  P-15 专辑世界杯: VS on 61:1, 选《午夜站台》 61:3, tick 62:1, 确认这一票 62:2, 「2票 · 你选了这张」 62:3 + the digits 「2票」 punch
 *   S6 63-64  P-16 默契局: 我选「午夜站台」 63:2, tick 63:3, 先保留我的选择 63:4, the reveal 「2 人选择 · 本轮有共同选择」 64:1 (wait cut)
 *   S7 65-66  (v2) H-02 (TAKE-H, capture/H1-host) the VENUE's long-term community: 「月台 Livehouse」 typed on 32nds from 65:1, tick
 *             65:3, create 65:4, open it 65:4.5, the community room 66:1 (its 3D header with the venue sign; the chip row has slid past
 *             the Music Map chip)
 *   S8 67     P-18 创作角 invitation: tick 67:2, create 67:3, the product's 「你不能替对方同意，」 pops out 67:3.5, underlined 67:4
 *             (the cast never joins: no result is shown)
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
 * Disclosures (v2, owner 2026-10-07 「去掉那些说明性文字，这个产品必须是完整的」): v1's T094 / T100 chips and the 「照片为 AI 生成的
 * 示例图」 tags are gone; the end card's one credits line says the cast and photos are fictional and the photos AI-generated.
 * Local primitives (not in dm/): feed() anchor a capture frame to a beat; stickerCrop() an alpha die-cut sticker of one region of a
 * cut-out (one bubble of CUT-07); dieCrop() a rectangular die-cut of one region of a still or footage frame (DM.cutout's crop draws
 * the image unscaled: object-fit none); popOut() a piece flying out of the phone screen onto the paper; tiltWave() a tilted wavy
 * underline; flipX() a card flip; backing() the torn colour scrap behind the phone; shadowSeq() phone shadow colour per feature;
 * circleOn()/underlineOn() strokes glued to footage; flyOff() the S11 exit.
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
  /** alpha die-cut sticker of one region of a cut-out (crop = [x, y, w, h] in the image's px) at width w: paper margin + ink line +
   *  hard shadow following the shape (the kit's .svgcut), so one bubble of CUT-07 becomes a bubble-shaped sticker */
  const stickerCrop = (sh, o) => {
    const [cx, cy, cw, ch] = o.crop, k = o.w / cw, H = Math.round(ch * k);
    const el = DM.h('div', 'svgcut' + (o.thin ? ' thin' : ''));
    el.innerHTML = `<div style="position:relative;width:${o.w}px;height:${H}px;overflow:hidden"><img decoding="sync" src="${DM.asset(o.src)}" style="position:absolute;left:${(-cx * k).toFixed(1)}px;top:${(-cy * k).toFixed(1)}px;max-width:none"></div>`;
    const img = el.querySelector('img');
    DM._preLayout.push(async () => { if (!img.complete) await img.decode().catch(() => {}); const W = img.naturalWidth * k, Hh = img.naturalHeight * k;
      img.style.width = W.toFixed(1) + 'px'; img.style.height = Hh.toFixed(1) + 'px';
      // o.hide: rects [x, y, w, h] (image px) cut away with an even-odd clip (e.g. a timestamp under a bubble)
      if (o.hide) img.style.clipPath = `polygon(evenodd, 0 0, ${W}px 0, ${W}px ${Hh}px, 0 ${Hh}px, 0 0` + o.hide.map(([x, y, w, h]) => `, ${x * k}px ${y * k}px, ${(x + w) * k}px ${y * k}px, ${(x + w) * k}px ${(y + h) * k}px, ${x * k}px ${(y + h) * k}px, ${x * k}px ${y * k}px, 0 0`).join('') + ')'; });
    return DM.node(sh, el, Object.assign({ boil: { px: 0.5, deg: 0.3 } }, o, { label: 'sticker ' + (o.label || o.src) }));
  };
  /** rectangular die-cut (the kit's .die) of one region of a still or a footage frame ('/clip/P-18/330.jpg'): crop = [x, y, w, h] px.
   *  (DM.cutout's crop sets object-fit:none, which draws the image unscaled whenever the crop is resized: wrong region; this scales) */
  const dieCrop = (sh, o) => {
    const [cx, cy, cw, ch] = o.crop, pad = o.pad ?? 8, edge = 2 * (5 + pad) + 6, k = (o.w - edge) / cw, H = Math.round(ch * k + edge);
    const el = DM.h('div', 'die'); el.style.width = o.w + 'px'; el.style.height = H + 'px'; el.style.padding = pad + 'px';
    el.innerHTML = `<div class="cut"><img decoding="sync" src="${DM.asset(o.src)}" style="object-fit:fill;max-width:none;left:${(-cx * k).toFixed(1)}px;top:${(-cy * k).toFixed(1)}px"></div>`;
    const img = el.querySelector('img');
    DM._preLayout.push(async () => { if (!img.complete) await img.decode().catch(() => {}); img.style.width = (img.naturalWidth * k).toFixed(1) + 'px'; img.style.height = (img.naturalHeight * k).toFixed(1) + 'px'; });
    const n = DM.node(sh, el, Object.assign({}, o, { label: 'die-cut ' + (o.label || o.src) })); n.k = k; n.H = H; return n;
  };
  /** wavy marker underline in shot px, tilted by `deg` around (cx, cy) (to sit under a tilted sticker) */
  const tiltWave = (sh, o) => DM.stroke(sh, Object.assign({ color: 'pink', width: 8, label: 'underline' }, o, { x: undefined, y: undefined, gen: r => {
    const n = Math.max(4, Math.round((o.x1 - o.x0) / (o.wl ?? 60))), a = (o.deg || 0) * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a), pts = [];
    for (let i = 0; i <= n * 2; i++) { const x = lerp(o.x0, o.x1, i / (n * 2)), y = o.y + (i % 2 ? -1 : 1) * (o.amp ?? 7) * (i === 0 || i === n * 2 ? 0.4 : 1);
      pts.push([o.cx + (x - o.cx) * c - (y - o.cy) * sn, o.cy + (x - o.cx) * sn + (y - o.cy) * c]); }
    return DM.paths.curve(pts, r, { jit: 3 }); } }));
  /** pop-out: `node` flies out of the device's screen (from source px [sx, sy]) to its own spot in `dur` s from `at` (X5 pop-out) */
  const popOut = (node, dev, at, sx, sy, o = {}) => {
    const t0 = DM.T(at); if (t0 === null) return node;
    const dur = o.dur ?? 0.16, s0 = o.s0 ?? 0.42, r0 = o.r0 ?? -6; let from = [0, 0];
    DM.onLayout(() => { const [wx, wy] = dev.toWorld(t0, sx, sy); from = [wx - node.x, wy - node.y]; });
    node.show(at);
    return node.track(t => { const u = clamp((t - t0) / dur); if (u >= 1) return null; const e = E.outC(u);
      return { x: lerp(from[0], 0, e), y: lerp(from[1], 0, e) - Math.sin(u * Math.PI) * (o.arc ?? 46), s: lerp(s0, 1, E.outBack(u, 1.7)), r: lerp(r0, 0, e) }; });
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
      '57:1', DM.ramp(P13, [['57:1', f2s(67)], ['57:3', f2s(154), E.lin], ['58:1', f2s(271), E.lin], ['58:3', srcAfter(271, '58:1', '58:3'), E.lin]]),
      '58:3', feed(P13, '58:3', '58:3', 520));                          // S2: open 57:1 (f67: the sheet has landed), composer tap ~57:2.75, typing 2x (32nds) 57:3, send 58:1, reply 58:3
    // S2 keeps the whole chat in frame (s <= 1.1: the bubbles run edge to edge, any tighter crop cuts them); the die-cuts carry the words
    const ph = DM.phone(sh, { media, x: L1.x, y: L1.y, r: L1.r, shadow: 'pink', z: 10, label: 'phone S1/S2',
      view: [['55:1', { s: 1.0 }], ['55:3', { s: 1.0 }], ['55:3.4', { s: 1.3, x: 490, y: 1470 }, E.outC], ['55:4.8', { s: 1.32, x: 490, y: 1470 }],   // v2: the zoom starts on the tap (v1 peaked 176 ms before it)
        ['56:1', { s: 1.0, x: 540, y: 1170 }, E.step], ['56:2', { s: 1.0, x: 540, y: 1170 }], ['56:2.5', { s: 1.25, x: 470, y: 1370 }, E.outC], ['56:4.9', { s: 1.28, x: 470, y: 1370 }],
        ['57:1', { s: 1.0, x: 540, y: 1170 }, E.step], ['57:2.75', { s: 1.03, x: 540, y: 1170 }], ['57:3', { s: 1.08, x: 540, y: 1260 }, E.outC],
        ['58:1', { s: 1.08, x: 540, y: 1260 }], ['59:1', { s: 1.1, x: 540, y: 1220 }, E.ioSine]] });
    ph.in('slap', '55:1', { big: 1.06, spin: -4, dy: -20, sfx: 'none', log: false });
    ph.pulse(['57:1'], 0.035, 0.1);
    ph.pulse(['58:1', '58:3'], 0.02, 0.1);
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
    // S1: the two new friends, 阿宁 (you) and 小满·示例 (the product's own avatars), at the foot of the type column; a heart on 56:3
    const you = DM.sticker(sh, { src: 'visitor-aning-shizhen-front', w: 128, x: 1250, y: 1012, ay: 1, z: 6, r: -2, label: 'avatar 阿宁' }).in('pop', '55:2', { gain: -9, note: 2 });
    const man = DM.sticker(sh, { src: 'cast-man-front', w: 128, x: 1600, y: 1012, ay: 1, z: 6, r: 2, label: 'avatar 小满·示例' }).in('pop', '55:2.5', { gain: -9, note: 4 });
    you.bob('56:3', '57:1', 14, beat / 2); man.bob('56:3', '57:1', 14, beat / 2);
    you.out('pop', '57:1'); man.out('pop', '57:1');
    DM.deco(sh, { kind: 'heart', color: 'pink', size: 132, x: 1425, y: 860, z: 9, r: -6, lw: 1.1 }).in('spring', '56:3', { sfx: 'boop', gain: -2, label: 'big heart' }).out('pop', '57:1');
    DM.pops(sh, [['heart', 'yellow', 1330, 760, 54, 10], ['sparkle', 'mint', 1520, 760, 50]], '56:3.5', beat / 2, { z: 9, gain: -10 }).forEach(n => n.out('pop', '57:1'));
    // S2: the real bubbles pop out of the phone onto the paper (die-cuts of CUT-07, a still of this take): yours on the send (58:1),
    // the example character's reply on the jump cut (58:3); they fly from where the product draws them (P-13 source px)
    // (CUT-07 is the P2P3 alpha cut-out of the four bubbles, 1016x1023; crops stop above the grey timestamps)
    const mine = stickerCrop(sh, { src: 'CUT-07', crop: [196, 572, 812, 172], hide: [[676, 727, 240, 50]], w: 755, x: 1425, y: 572, r: -2, z: 14, label: 'bubble 返场那首我在人海里，手都举酸了！' });
    popOut(mine, ph, '58:1', 635, 1005, { r0: -8, arc: -40 });
    mine.wiggle('58:4', '59:1', 2, 3);
    const reply = stickerCrop(sh, { src: 'CUT-07', crop: [8, 819, 545, 172], hide: [[98, 976, 120, 40]], w: 507, x: 1105, y: 778, r: 2, z: 15, label: 'bubble 今晚的返场太好听了。' });
    popOut(reply, ph, '58:3', 312, 1252, { r0: 6, arc: -30 });
    DM.ev('58:4', 'pop', 'bubbles wiggle', { sfx: 'none' });
    // type (right column)
    say(ty, 'T090', { x: COLR, y: 200 });
    // v2: cut on 57:3 (handover); 「私聊，」 enters UNDER 「对方愿意，才成朋友。」 and jumps to the top when it leaves (reading order)
    say(ty, 'T091', { x: COLR, y: 470, outFx: 'cut' });
    say(ty, 'T092', { x: COLR, y: 805 }).move(Tc('57:3') - 0.5 / 60 - 0.001, Tc('57:3') - 0.5 / 60 - 0.0005, { y: 218 - 805 }, E.lin);
    say(ty, 'T093', { x: COLR, y: 405 });
    // (v2, owner 2026-10-07 「去掉那些说明性文字，这个产品必须是完整的」: v1's chip 「示例角色 · 自动回复」 (T094) is gone)
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
    const cA = DM.card(ty, { w: 700, hgt: 168, x: 445, y: 706, r: -2, z: 4 }).in('slap', '59:1', { big: 1.0, spin: -6, dy: -40, sfx: 'none', log: false }).out('pop', '60:1');
    const cB = DM.card(ty, { w: 700, hgt: 168, x: 470, y: 878, r: 1.5, z: 5 }).in('slap', '59:3', { big: 1.0, spin: 6, dy: -40, sfx: 'none', log: false }).out('pop', '60:3');
    say(ty, 'T095', { parent: cA, x: 40, y: 84 });
    // v2 (truth #3): the product's own words.  The build promises 「安静参与：照样保存和分享照片，不接收新招呼。」 and her card here says
    // 「不接收新招呼」; v1's 「不会被打扰。」 promised more (a quiet member can still receive exchange requests for shared photos)
    say(ty, 'T096', { parent: cB, x: 40, y: 84, text: '【不接收新招呼】。' });
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
    // v2: sparkles instead of a starburst (the burst is kept for 5:1 / 21:1 / 51:1; review art #4)
    DM.pops(sh, [['sparkle', 'yellow', 1215, 150, 70], ['star', 'pink', 1290, 250, 52, 12]], '61:1', beat / 4, { z: 3, sfx: 'none' }).forEach(n => n.out('pop', '62:4'));
    DM.ev('61:3', 'tap', 'tap 选《午夜站台》');
    DM.ev('62:1', 'tap', 'tick 确认投票', { sfx: 'tick' });
    DM.ev('62:2', 'tap', 'tap 确认这一票');
    DM.deco(sh, { parent: ph.screen, kind: 'star', color: 'yellow', size: 64, x: 250 * 0.4, y: 1205 * 0.4, z: 5, r: 10 }).in('pop', '62:3.5', { sfx: 'ding', gain: -4, label: 'star on 2票' }).out('pop', '63:1');
    // 62:3 the storyboard's digits 「2」 punch: the product's own count after your vote (「2票 · 你选了这张」), arrow into the phone
    DM.title(ty, { text: '【2】票', recipe: 'digits', size: 'XL', kind: 'label', x: COLL + 20, y: 330, r: -5, at: '62:3', fx: 'POP', until: '63:1', outFx: 'cut', label: 'digits 2票' });
    DM.arrow(sh, { from: [470, 350], to: () => { const [x, y] = ph.toWorld(Tc('62:4'), 150, 1150); return [x - 70, y - 10]; }, bend: -0.22, at: '62:3.5', dur: beat * 0.5, until: '63:1', color: 'pink', width: 9, z: 16, sfx: 'none', label: 'arrow 2票 -> phone' });
    // S6: taps, then the reveal; sparkles on the shared choice
    DM.ev('63:2', 'tap', 'tap 我选「午夜站台」');
    DM.ev('63:3', 'tap', 'tick 确认提交本轮选择', { sfx: 'tick' });
    DM.ev('63:4', 'tap', 'tap 先保留我的选择');
    DM.ev('64:1', 'cut', 'reveal (wait cut)', { sfx: 'swish', gain: -4 });
    // v2: a fat yellow marker ring around 「选到一起了！」 instead of a starburst (art #4)
    DM.stroke(ty, { color: 'yellow', width: 20, at: '64:1.25', dur: beat * 0.5, z: 1, erase: '64:4.5', edur: 0.08, sfx: 'squeak', gain: -8, label: 'ring 选到一起了',
      gen: r => DM.paths.loop(470, 632, 420, 130, r, { tilt: -3, turns: 1.15 }) });
    DM.pops(sh, [['sparkle', 'yellow', 300 * 0.4, 1560 * 0.4, 46], ['star', 'pink', 520 * 0.4, 1420 * 0.4, 40, 12], ['sparkle', 'mint', 90 * 0.4, 1460 * 0.4, 34]], '64:3', beat / 4, { parent: ph.screen, z: 6, sfx: 'sparkle', gain: -6 }).forEach(n => n.out('pop', '65:1'));
    // type (left column)
    say(ty, 'T097', { x: COLL, y: 285 });
    say(ty, 'T098', { x: COLL, y: 600 });
    say(ty, 'T099', { x: COLL, y: 880 });
    // (v2, owner 0b: v1's chip 「原创虚构专辑」 (T100) under the phone is gone)
    say(ty, 'T101', { x: COLL, y: 220 });
    say(ty, 'T102', { x: COLL, y: 410, step: beat / 8 });   // v2: 32nds (typed by 63:4.3; v1 ran under the 64:1 reveal)
    say(ty, 'T103', { x: COLL, y: 630 });
  }

  // ======================================================================= SEG D · S7 + S8 + S9 + S10 · 65:1 -> 72:1 (L1, slides in from the right)
  {
    const H02 = DM.clip('H-02'), P18 = DM.clip('P-18'), P19 = DM.clip('P-19'), P20 = DM.clip('P-20');
    const enter = { kind: 'slide', dx: 760, dur: 0.14, sfx: 'swish' };
    const sh = DM.shot('A5-S7S10-community-corner-card-myspace', '65:1', '72:1', { drift: { s: 1.03, x: -8, y: 0 }, enter });
    const ty = DM.shot('A5-S7S10-type', '65:1', '73:1', { paper: false, z: 30, drift: null, log: false, enter: Object.assign({}, enter, { sfx: 'none' }) });
    sh.pulse(['67:1', '68:1', '70:1', '71:1'], 0.016, 0.12);
    sh.pulse(['65:3', '66:1', '66:3', '67:3', '68:3', '69:1', '69:3', '70:3', '71:3'], 0.006, 0.1);
    const media = DM.seq(
      // S7 (v2, owner's positioning: the community is the VENUE's): TAKE-H H-02 (capture/H1-host), the community named after the venue,
      // 「月台 Livehouse」 typed on 32nds from 65:1 (f60 = the take's beat 0), tick 65:3, 创建我的社群 65:4, the new entry tapped 65:4.5
      feed(H02, '65:1', '65:1', 60),
      '66:1', feed(H02, '66:1', '66:1', 330),                           // the community room on 66:1 (the chip row already slid past Music Map)
      '67:1', feed(P18, '67:1', '67:1', 233),                           // S8: corner sheet 67:1, tick 67:2, 创建共同创作邀请 67:3
      '68:1', feed(P19, '68:1', '68:1', 193),                           // S9: recap 68:1, 保存我的纪念卡 68:3, ticks 69:1-3, 下载纪念卡 PNG 69:4
      '71:1', feed(P20, '71:1', '71:1', 63));                           // S10: MY SPACE on 71:1
    const ph = DM.phone(sh, { media, x: L1.x, y: L1.y, r: L1.r, shadow: 'mint', z: 10, label: 'phone S7-S10',
      // S7: the form close up (我的音乐社群 · 月台 Livehouse · the consent row · 创建我的社群; the product's explanatory paragraph above
      // it stays out of frame), then the community room: its 3D header with the venue sign and 散场以后，也留一个位置 · 月台 Livehouse
      view: [['65:1', { s: 2.4, x: 285, y: 1405 }], ['65:4.9', { s: 2.45, x: 285, y: 1395 }],
        ['66:1', { s: 2.0, x: 310, y: 640 }, E.step], ['66:3', { s: 2.0, x: 310, y: 640 }], ['66:4.9', { s: 2.14, x: 300, y: 600 }, E.ioSine],
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
    DM.ev('65:1', 'type', 'typing 月台 Livehouse', { dur: beat * 12 / 8, note: 12, gain: -2 });
    DM.ev('65:3', 'tap', 'tick 创建长期空间', { sfx: 'tick' });
    DM.ev('65:4', 'tap', 'tap 创建我的社群');
    DM.ev('65:4.5', 'tap', 'tap 月台 Livehouse (the new community)', { gain: -4 });
    ph.punch('66:3', { s: 1.06, x: 250, y: 430 }, { until: '67:1', sfx: 'none', label: 'push the 3D header (the venue sign)' });
    DM.pops(sh, [['star', 'yellow', 770, 140, 70, -8], ['plus', 'mint', 760, 300, 44]], '66:1.5', beat / 2, { z: 14, gain: -10 }).forEach(n => n.out('pop', '67:1'));
    // S8
    DM.ev('67:2', 'tap', 'tick 我选择邀请这位朋友', { sfx: 'tick' });
    DM.ev('67:3', 'tap', 'tap 创建共同创作邀请');
    // the product's own words pop out of the screen on the 8th after the create tap and get the pink underline on 67:4 (STORYBOARD:
    // "zoom on 「你不能替对方同意」"; a punch-in on the phone crops the sentence, so the line comes out to the paper instead)
    const CON = { x: 1232, y: 664, r: -2 };
    const consent = dieCrop(sh, { src: '/clip/P-18/330.jpg', crop: [538, 1952, 414, 66], w: 640, x: CON.x, y: CON.y, r: CON.r, z: 14, label: '你不能替对方同意，' });
    popOut(consent, ph, '67:3.5', 744, 1985, { r0: 5, arc: -24 });
    consent.out('cut', '68:1');
    DM.ev('67:3.5', 'pop', 'pop-out 你不能替对方同意', { sfx: 'pop', gain: -4 });
    tiltWave(sh, { x0: CON.x - 288, x1: CON.x + 206, y: CON.y + 50, cx: CON.x, cy: CON.y, deg: CON.r, amp: 6, wl: 46, at: '67:4', dur: beat * 0.6, erase: '68:1', edur: 0.02, color: 'pink', width: 8, z: 16, label: 'underline 你不能替对方同意' });
    // S9: ticks on 69:1 / 69:2 / 69:3 (real checkboxes), download on 69:4, then the real PNG lands on the paper
    DM.ev('68:3', 'tap', 'tap 保存我的纪念卡');
    [[105, 324], [161, 1127], [122, 1382]].forEach(([x, y], i) => {
      DM.deco(sh, { parent: ph.screen, kind: 'sparkle', color: ['yellow', 'mint', 'pink'][i], size: 40, x: (x + 70) * 0.4, y: (y - 40) * 0.4, z: 6 }).in('pop', `69:${1 + i}`, { sfx: 'tick', gain: -2, note: i * 2, label: 'tick ' + (i + 1) }).out('pop', '70:1');
    });
    DM.ev('69:4', 'tap', 'tap 下载纪念卡 PNG');
    const CARD = { x: 1572, y: 528, w: 440 };            // the memory card's landing spot (right column, clear of the AI note; T110 on its left)
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
      // v2: sparkles and two marker strokes instead of a starburst (art #4)
      DM.pops(sh, [['sparkle', 'yellow', CARD.x - 300, CARD.y + 40, 64], ['star', 'mint', CARD.x + 285, CARD.y - 120, 60, 10], ['sparkle', 'pink', CARD.x + 270, CARD.y + 300, 50]], '70:1', beat / 4, { z: 22, sfx: 'none' }).forEach(n => n.out('pop', '71:1'));   // 16ths (QC grid)
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
    // v2 (owner 2026-10-07: the music community is the Livehouse's own, kept by the venue): T104-T106 say so; T105 gained 「给你」, so it
    // stays to 67:1 (8 units) and moves up to the top slot on 66:1 when T104 leaves, where 「再见，在下一场。」 enters under it
    say(ty, 'T104', { x: COLR, y: 222, text: 'Livehouse 的\n【长期社群】，' });
    say(ty, 'T105', { x: COLR, y: 560, text: '也给你\n留一个【位置】。', until: '67:1' }).move(Tc('66:1') - 0.5 / 60 - 0.001, Tc('66:1') - 0.5 / 60 - 0.0005, { y: 222 - 560 }, E.lin);
    say(ty, 'T106', { x: COLR, y: 560 });
    say(ty, 'T107', { x: COLR, y: 225 });
    say(ty, 'T108', { x: COLR, y: 420, step: beat / 8 });   // v2: 32nds (typed by 67:4.2, before the cut to S9)
    say(ty, 'T109', { x: COLR, y: 690, outFx: 'cut' });     // v2: cut on 69:3 (handover to 「纪念卡，」)
    say(ty, 'T110', { x: 812, y: 470 });
    // maps that cut bars 71-72 (tea-party, love-love-love) leave T111 one bar; type it on an 8th early there so it stays >= 2.25 s
    // v2: types in on the download tap (69:4) and leaves on 71:1, when 「散场后，仍有地方回来。」 takes the column above it (reading order)
    say(ty, 'T111', { x: 775, y: 965, at: '69:4', until: '71:1' });
    say(ty, 'T112', { x: 775, y: 270 });
  }

  // (v2, owner 2026-10-07 「去掉那些说明性文字，这个产品必须是完整的」: v1's fixed 「照片为 AI 生成的示例图」 tags over S3/S4 (59-60)
  // and S9-S11 (68-72) are gone; the end card's one credits line carries the disclosure)

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
      ['72:3', () => DM.cutout(sh, { src: 'CUT-05', w: 500, hgt: 'auto', maxH: 380, x: 1440, y: 318, r: 3, z: 6, label: 'CUT-05 badge' })],
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
