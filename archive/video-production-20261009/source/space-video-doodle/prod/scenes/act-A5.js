/* Music Space · Doodle video — ACT A5 AFTER THE SWAP 交换之后 (storyboard bars 55-72).
 * v3 (2026-10-08): every shot re-cut on the 0.22.0-rc.2 footage (capture/P1-rc2, P2P3-rc2, desktop-rc2, map-rc2, addressed by
 * explicit path: the old captures share the ids and tools/serve.mjs would pick either), the product's new words, the unfixed review
 * notes (art #15/#16, rhythm #10, read #9), and the MUSIC MAP beat 「音乐探索」 (65-66).  Room for it: the S11 drum-roll recap (72,
 * STORYBOARD ✂2, a repeat of the hook collage) is gone and the memory card + My Space share three bars instead of four (the dead tick
 * time of rhythm #10 cut out, T110 / T111 dropped).  18 bars, as in v2.  Music: bars 65-72 now play Flipping In 93-100
 * (tools/tempo-maps/flipping-in-b.json, rhythm #1 follow-up: 79-86 had lost the horns/keys under 69-72).
 * Words: SCRIPT.md T090-T115 (T113-T115 new, not in script/out/timeline.json: DM.title with script ids), every line on the beat.
 * Pictures and beats (STORYBOARD S1-S11 as re-cut 2026-10-08), one phone so the frame stays put and only the screen cuts (X5):
 *   S1 55-56  P-12 小满's card 「先招个手，TA 接受了就是朋友。」: tap 「向 小满 招个手」 55:3, page-flip over the wait into 「你们已经认识了」 56:1
 *   S2 57-58  P-13 ONE TO ONE: chat opens 57:1, typing on 32nds 57:3, send 58:1, the reply 58:3 (wait cut); the real bubbles pop out
 *             of the phone onto the paper (CUT-07 rc2 alpha cut) on 58:1 / 58:3
 *   S3 59     D-04 (desktop 4K) 林间's close-up, tap 「认识一下」 59:1.5, her card slides in 「TA 选择安静参与，不接新招呼。」, mint
 *             underline 59:4; both type cards cut on 60:1 (art #16, read #9)
 *   S4 60     P-14 散场聊天室: the chip row 「音乐探索 ↗ · 一起玩 · 音乐话题 · 专辑世界杯」 slides 60:1-60:3, the message scroll 60:3
 *   S5 61-62  P-15 专辑世界杯: VS 61:1, 选《午夜站台》 61:3, tick 「投出后不能改」 62:1, 投票 62:2, 「2票 · 你选了这张」 62:3 + 「2」 punch
 *   S6 63-64  P-16 默契局: 我选「午夜站台」 63:2, tick 「就选它，提交后不能改」 63:3, 提交 63:4, the reveal 「2 人选择 · 本轮有共同选择」 64:1
 *   MAP 65-66 (new) MAP-P1-round, the Doodle Music Map 「音乐探索」: the record table 「寻声 · 费玉清 → 邓紫棋，隔着几首歌？」 65:1, flip
 *             《千里之外》 65:2 (× 周杰伦), 「来源」 65:3, the duet paper pops out 65:4 (共同演唱 周杰伦 × 费玉清 · 千里之外), then one step
 *             per beat: 前往周杰伦 · 第 1 步 66:1, 前往林俊杰 · 第 2 步 66:2, 抵达邓紫棋！3 步 66:3 (the duet network opens)
 *   S7 67-68  P-17 the VENUE's 乐迷社群 from the fan side: 「月台 Livehouse 乐迷社群 · 散场后，乐迷留在这里；下一场的预告也发在这里。」 67:1,
 *             tick 67:3, 「加入，继续聊」 67:4 -> the community room's 3D header (zoom <= 1.3, art #15), 下一场预告 「回声现场 Vol.2」 68:3
 *   S8 69     P-22 创作角: tick 69:2, 「发出邀请」 69:3, the product's 「等 TA 加入。」 pops out 69:3.5, 小满 joins 69:4 (rc.2: the cast joins;
 *             「同一晚，我们的另一面。」 with both avatars)
 *   S9 70-71  P-19 recap 「把这一晚，留在手里。」 70:1, 保存我的纪念卡 70:3, download 70:4 (ticks already set: rhythm #10's dead beat
 *             is cut), the real PNG (CUT-08 rc2) lands on the paper 71:1, tapes 71:1.5 / 71:2
 *   S10 71:3-72  P-20 MY SPACE; the four tiles of this act underlined on 8ths from 72:1; whip pan out on 72:4.5 (A6 on clean paper at 73:1)
 * Layout: S1-S2 L1 (phone left, type column x 840), S3 L4 desk, S4-S6 L2 (phone right, type x 130), MAP-S10 L1.  Every feature gets
 * its own colour (phone shadow + a torn backing scrap that slaps on with it).
 * Clip speed: the takes put their taps on a 123 BPM grid; feeds play at rate R = map BPM / 123 so taps stay on beats under any music
 * option (1.0 for Flipping In).  Real waits are cut on the beat (S1, S2, S6, S8, MAP), never shown.
 * Honesty: singers, songs and 来源 only as the map shows them (narration names no singer); the cast joining the corner is the rc.2
 * product's own behaviour; the one credits line on the end card says the cast and photos are fictional.
 * Local primitives (not in dm/): feed() anchor a capture frame to a beat; stickerCrop() an alpha die-cut sticker of one region of a
 * cut-out; dieCrop() a rectangular die-cut of a still; popOut() a piece flying out of the phone screen onto the paper; tiltWave() a
 * tilted wavy underline; flipX() a card flip; backing() the torn colour scrap behind the phone; shadowSeq() phone shadow colour per
 * feature; circleOn()/underlineOn() strokes glued to footage.
 */
(() => {
  const E = DM.E, clamp = DM.clamp, lerp = DM.lerp;
  const beat = DM.beatS();
  const say = DM.say;
  const MAP = DM.map() || {};
  const R = (MAP.bpm || 123) / 123;
  const f2s = f => f / 60;
  const Tc = DM.Tc;

  // ---------------------------------------------------------------- footage: the rc.2 re-captures, by path (v3)
  const CAP = {
    P12: 'capture/P1-rc2/clips/P-12.mp4', P13: 'capture/P1-rc2/clips/P-13.mp4', P14: 'capture/P1-rc2/clips/P-14.mp4',
    P15: 'capture/P1-rc2/clips/P-15.mp4', P16: 'capture/P1-rc2/clips/P-16.mp4', P17: 'capture/P1-rc2/clips/P-17.mp4',
    P19: 'capture/P1-rc2/clips/P-19.mp4', P20: 'capture/P1-rc2/clips/P-20.mp4', P22: 'capture/P2P3-rc2/clips/P-22.mp4',
    D04: 'capture/desktop-rc2/master/D-04-linjian-quiet.mp4', MAP: 'capture/map-rc2/phone/MAP-P1-round.mp4',
    CUT07: 'capture/P2P3-rc2/cut/CUT-07_chat-bubbles.png', CUT08: 'capture/P2P3-rc2/exports/CUT-08_memory-card.png',
    YOU: 'capture/P2P3-rc2/avatars/png/visitor-aning-shizhen-front.png', MAN: 'capture/P2P3-rc2/avatars/png/cast-man-front.png',
    DUET: 'assets/v3/A5/MAP-duet-paper_MAP-P1-round-f346.png',   // MAP-P1-round f346 crop [70, 1105, 620, 540]: 共同演唱 · 周杰伦 × 费玉清 · 千里之外
    WAIT: 'assets/v3/A5/CORNER-wait_P-22-f175.png',              // P-22 f175 crop [44, 2016, 270, 84]: 「等 TA 加入。」
  };

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
      // o.hide: rects [x, y, w, h] (image px) cut away with an even-odd clip (the grey timestamp under a bubble)
      if (o.hide) img.style.clipPath = `polygon(evenodd, 0 0, ${W}px 0, ${W}px ${Hh}px, 0 ${Hh}px, 0 0` + o.hide.map(([x, y, w, h]) => `, ${x * k}px ${y * k}px, ${(x + w) * k}px ${y * k}px, ${(x + w) * k}px ${(y + h) * k}px, ${x * k}px ${(y + h) * k}px, ${x * k}px ${y * k}px, 0 0`).join('') + ')'; });
    return DM.node(sh, el, Object.assign({ boil: { px: 0.5, deg: 0.3 } }, o, { label: 'sticker ' + (o.label || o.src) }));
  };
  /** rectangular die-cut (the kit's .die) of one region of a still: crop = [x, y, w, h] px (scaled to fit w; DM.cutout's crop draws
   *  the image unscaled: object-fit none) */
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
  /** a narration line that is new in v3 (SCRIPT.md T113-T115, not in script/out/timeline.json): same recipes, sizes and rules as DM.say */
  const line = (sh, id, o) => DM.title(sh, Object.assign({ size: 128, fx: 'SLAM', kind: 'title', script: id }, o));

  // layout (STORYBOARD §1.5): L1 phone left + type column from x 840; L2 phone right + type column x 130
  const L1 = { x: 455, y: 540, r: -2 }, L2 = { x: 1475, y: 540, r: 2 };
  const COLR = 840, COLL = 130;
  // a jump of a line to the top slot on the downbeat its upper neighbour leaves (reading order: the column always reads top-down)
  const jumpAt = (node, at, dy) => node.move(Tc(at) - 0.5 / 60 - 0.001, Tc(at) - 0.5 / 60 - 0.0005, { y: dy }, E.lin);

  // ======================================================================= SEG A · S1 + S2 · 55:1 -> 59:1 (L1, one phone, screen swap on 57:1)
  {
    const P12 = DM.clip(CAP.P12), P13 = DM.clip(CAP.P13);
    const sh = DM.shot('A5-S1S2-friends-chat', '55:1', '59:1', { drift: { s: 1.03, x: -6, y: 0 } });
    const ty = DM.shot('A5-S1S2-type', '55:1', '59:1', { paper: false, z: 30, drift: null, log: false });
    sh.pulse(['55:1', '57:1'], 0.016, 0.12);
    sh.pulse(['55:3', '56:1', '56:3', '57:3', '58:1', '58:3'], 0.006, 0.1);
    const media = DM.seq(
      feed(P12, '55:1', '55:3', 199),                                   // S1: greet click (f199) on 55:3, toast right after
      '56:1', feed(P12, '56:1', '56:1', 376),                           // page flip over the real ~3 s wait -> 「你们已经认识了」 (f375), ♡ 2 at f391 (56:1.5)
      '57:1', DM.ramp(P13, [['57:1', f2s(67)], ['57:3', f2s(154), E.lin], ['58:1', f2s(271), E.lin], ['58:3', srcAfter(271, '58:1', '58:3'), E.lin]]),
      '58:3', feed(P13, '58:3', '58:3', 520));                          // S2: open 57:1, composer tap ~57:2.75, typing 2x (32nds) 57:3, send 58:1, reply 58:3
    // S2 keeps the whole chat in frame (s <= 1.1: the bubbles run edge to edge, any tighter crop cuts them); the die-cuts carry the words
    const ph = DM.phone(sh, { media, x: L1.x, y: L1.y, r: L1.r, shadow: 'pink', z: 10, label: 'phone S1/S2',
      // rc.2: the card's greet button sits at y 1570-1703 (rc.1 1522-1655); the friends card 1125-1718
      view: [['55:1', { s: 1.0 }], ['55:3', { s: 1.0 }], ['55:3.4', { s: 1.3, x: 490, y: 1520 }, E.outC], ['55:4.8', { s: 1.32, x: 490, y: 1520 }],
        ['56:1', { s: 1.0, x: 540, y: 1170 }, E.step], ['56:2', { s: 1.0, x: 540, y: 1170 }], ['56:2.5', { s: 1.25, x: 470, y: 1400 }, E.outC], ['56:4.9', { s: 1.28, x: 470, y: 1400 }],
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
    DM.ev('55:3', 'tap', 'tap 向 小满 招个手');
    circleOn(ph, { x: 533, y: 1636, rx: 500, ry: 96, at: '55:2', dur: beat * 0.6, erase: '55:3', color: 'pink', width: 8, label: 'circle the greet button' });
    DM.deco(sh, { parent: ph.screen, kind: 'sparkle', color: 'pink', size: 44, x: 700 * 0.4, y: 40 * 0.4, z: 5 }).in('pop', '56:1.5', { gain: -8, label: '♡ 2 sparkle' }).out('pop', '57:1');
    DM.ev('57:2.75', 'tap', 'tap the composer', { gain: -6 });
    DM.ev('57:3', 'type', 'typing 返场那首我在人海里，手都举酸了！', { dur: Tc('58:1') - Tc('57:3'), note: 16, gain: -2 });
    DM.ev('58:1', 'tap', 'send', { sfx: 'blip', gain: 0 });
    DM.ev('58:3', 'cut', 'reply lands (wait cut)', { sfx: 'blip', gain: 0, note: 5 });
    // S1: the two new friends, 阿宁 (you) and 小满 (the product's own avatars), at the foot of the type column; a heart on 56:3
    const you = DM.sticker(sh, { src: CAP.YOU, w: 128, x: 1250, y: 1012, ay: 1, z: 6, r: -2, label: 'avatar 阿宁' }).in('pop', '55:2', { gain: -9, note: 2 });
    const man = DM.sticker(sh, { src: CAP.MAN, w: 128, x: 1600, y: 1012, ay: 1, z: 6, r: 2, label: 'avatar 小满' }).in('pop', '55:2.5', { gain: -9, note: 4 });
    you.bob('56:3', '57:1', 14, beat / 2); man.bob('56:3', '57:1', 14, beat / 2);
    you.out('pop', '57:1'); man.out('pop', '57:1');
    DM.deco(sh, { kind: 'heart', color: 'pink', size: 132, x: 1425, y: 860, z: 9, r: -6, lw: 1.1 }).in('spring', '56:3', { sfx: 'boop', gain: -2, label: 'big heart' }).out('pop', '57:1');
    DM.pops(sh, [['heart', 'yellow', 1330, 760, 54, 10], ['sparkle', 'mint', 1520, 760, 50]], '56:3.5', beat / 2, { z: 9, gain: -10 }).forEach(n => n.out('pop', '57:1'));
    // S2: the real bubbles pop out of the phone onto the paper (die-cuts of CUT-07 rc.2, 1016x954): yours on the send (58:1), 小满's reply
    // on the jump cut (58:3); they fly from where the product draws them (P-13 boxes: mine [233, 855, 803, 198], reply [44, 1103, 537, 198]);
    // the grey timestamps under the bubbles are cut away (hide)
    const mine = stickerCrop(sh, { src: CAP.CUT07, crop: [196, 503, 812, 194], hide: [[694, 662, 202, 36]], w: 755, x: 1425, y: 572, r: -2, z: 14, label: 'bubble 返场那首我在人海里，手都举酸了！' });
    popOut(mine, ph, '58:1', 634, 920, { r0: -8, arc: -40 });
    mine.wiggle('58:4', '59:1', 2, 3);
    const reply = stickerCrop(sh, { src: CAP.CUT07, crop: [8, 750, 546, 192], hide: [[112, 904, 90, 40]], w: 507, x: 1105, y: 778, r: 2, z: 15, label: 'bubble 今晚的返场太好听了。' });
    popOut(reply, ph, '58:3', 312, 1165, { r0: 6, arc: -30 });
    DM.ev('58:4', 'pop', 'bubbles wiggle', { sfx: 'none' });
    // type (right column)
    say(ty, 'T090', { x: COLR, y: 200 });
    // cut on 57:3 (handover); 「私聊，」 enters UNDER 「对方愿意，才成朋友。」 and jumps to the top when it leaves (reading order)
    say(ty, 'T091', { x: COLR, y: 470, outFx: 'cut' });
    jumpAt(say(ty, 'T092', { x: COLR, y: 805 }), '57:3', 218 - 805);
    say(ty, 'T093', { x: COLR, y: 405 });
  }

  // ======================================================================= SEG B · S3 · 59:1 -> 60:1 (L4 desktop, slap-on)
  {
    const D04 = DM.clip(CAP.D04);
    const sh = DM.shot('A5-S3-quiet', '59:1', '60:1', { drift: { s: 1.02 }, enter: { kind: 'slap', sfx: 'slap' } });
    sh.pulse(['59:2', '59:4'], 0.012, 0.1);
    // v3: one continuous take (rc.2 D-04): 林间's 3D close-up, the tap 「认识一下」 (click f333) on 59:1.5, her card slides in over the
    // close-up (in f333, settled f405 = 59:3.9) so she and her card share the frame; a slow push toward the card
    const desk = DM.desk(sh, { media: feed(D04, '59:1', '59:1.5', 333), w: 1800, x: 960, y: 540, srcW: 3840, srcH: 2160,
      view: [['59:1', { s: 1.0, u: 0.5, v: 0.5 }], ['60:1', { s: 1.08, u: 0.6, v: 0.53 }, E.ioSine]] });
    desk.show('59:1');
    DM.ev('59:1.5', 'tap', 'tap 认识一下');
    // rc.2 card: 「TA 选择安静参与，不接新招呼。」 quietLine box [2736, 1346, 550, 48] (settled)
    underlineOn(desk, { x0: 2740, x1: 3286, y: 1402, at: '59:4', dur: beat * 0.6, color: 'mint', width: 8, label: 'mint underline 不接新招呼' });
    // die cards bottom-left (L4: type over footage sits on paper).  v3 (art #16, read #9): both cut on 60:1 with the shot, so nothing
    // of S3 rides into the chat room; 「不接新招呼。」 enters on 59:2 to keep its reading time
    const ty = DM.shot('A5-S3-cards', '59:1', '60:1', { paper: false, z: 35, drift: null, log: false });
    const cA = DM.card(ty, { w: 700, hgt: 168, x: 445, y: 706, r: -2, z: 4 }).in('slap', '59:1', { big: 1.0, spin: -6, dy: -40, sfx: 'none', log: false }).out('cut', '60:1');
    const cB = DM.card(ty, { w: 640, hgt: 168, x: 440, y: 878, r: 1.5, z: 5 }).in('slap', '59:2', { big: 1.0, spin: 6, dy: -40, sfx: 'none', log: false }).out('cut', '60:1');
    say(ty, 'T095', { parent: cA, x: 40, y: 84, outFx: 'cut' });
    // v3: the product's words in rc.2 (her card: 「TA 选择安静参与，不接新招呼。」; v2 「不接收新招呼」 is rc.1)
    say(ty, 'T096', { parent: cB, x: 40, y: 84, text: '【不接新招呼】。', at: '59:2', until: '60:1', outFx: 'cut' });
  }

  // ======================================================================= SEG C · S4 + S5 + S6 · 60:1 -> 65:1 (L2, one phone, swaps on 61:1 and 63:1)
  {
    const P14 = DM.clip(CAP.P14), P15 = DM.clip(CAP.P15), P16 = DM.clip(CAP.P16);
    const whipKeys = [['60:1', { x: 0, y: 0, s: 1 }], ['64:4.5', { x: -10, y: 0, s: 1.02 }, E.ioSine], ['65:1', { x: -1500, y: 0, s: 1.04 }, E.inExpo]];
    const blur = [['64:4.5', 0], ['64:4.75', 12], ['65:1', 60, E.inQ]];
    const sh = DM.shot('A5-S4S6-room-cup-game', '60:1', '65:1', { drift: null, cam: whipKeys, blur, enter: { kind: 'slap', sfx: 'slap' } });
    const ty = DM.shot('A5-S4S6-type', '60:1', '65:1', { paper: false, z: 30, drift: null, log: false, blur, cam: [['64:4.5', { x: 0 }], ['65:1', { x: -1500 }, E.inExpo]] });
    sh.pulse(['61:1', '63:1', '64:1'], 0.016, 0.12);
    sh.pulse(['60:3', '61:3', '62:1', '62:3', '63:3', '64:3'], 0.006, 0.1);
    const media = DM.seq(
      // S4 (rc.2): the chip row opens on 「音乐探索 ↗ · 一起玩 · 音乐话题 · 专辑世界杯」 (f200), slides to 专辑世界杯 at 2x, the message scroll on 60:3
      DM.ramp(P14, [['60:1', f2s(200)], ['60:3', f2s(320), E.lin]], { after: 'play' }),
      '61:1', feed(P15, '61:1', '61:1', 220),                           // S5: VS 61:1, 选《午夜站台》 61:3, tick 62:1, 投票 62:2, 2票 scroll 62:3
      '63:1', DM.ramp(P16, [['63:1', f2s(476)], ['63:2', f2s(505), E.lin], ['63:3', f2s(544), E.lin], ['63:4', f2s(574), E.lin], ['64:1', srcAfter(574, '63:4', '64:1'), E.lin]]),
      '64:1', feed(P16, '64:1', '64:1', 762));                          // S6: 我选「午夜站台」 63:2, tick 63:3, 提交 63:4, reveal 64:1 (wait cut)
    const ph = DM.phone(sh, { media, x: L2.x, y: L2.y, r: L2.r, shadow: 'mint', z: 10, label: 'phone S4-S6',
      view: [['60:1', { s: 1.0, x: 540, y: 1170 }], ['60:4.8', { s: 1.1, x: 540, y: 1300 }, E.ioSine],
        ['61:1', { s: 1.12, x: 520, y: 1300 }, E.step], ['61:2.9', { s: 1.12, x: 520, y: 1300 }], ['61:3.3', { s: 1.12, x: 520, y: 1820 }, E.ioC],
        ['62:3', { s: 1.12, x: 520, y: 1820 }], ['62:3.6', { s: 1.22, x: 500, y: 1180 }, E.ioC], ['62:4.9', { s: 1.24, x: 495, y: 1180 }],
        // (v3: the focus sits left of centre so the panels' left margin (x 55) stays in frame)
        ['63:1', { s: 1.2, x: 500, y: 1520 }, E.step], ['63:4.9', { s: 1.23, x: 495, y: 1520 }],
        // rc.2 reveal 「2 人选择 · 本轮有共同选择」 [127, 1729, 365, 100] under the 午夜站台 card [107, 1314, 416, 350]
        ['64:1', { s: 1.5, x: 315, y: 1700 }, E.step], ['65:1', { s: 1.58, x: 315, y: 1700 }, E.ioSine]] });
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
    // S5: VS punch (rc.2 VS badge at (548, 1088)) + taps in the footage
    ph.punch('61:1', { s: 1.08, x: 505, y: 1090 }, { until: '61:2.5', sfx: 'none', label: 'punch VS' });
    DM.pops(sh, [['sparkle', 'yellow', 1215, 150, 70], ['star', 'pink', 1290, 250, 52, 12]], '61:1', beat / 4, { z: 3, sfx: 'none' }).forEach(n => n.out('pop', '62:4'));
    DM.ev('61:3', 'tap', 'tap 选《午夜站台》');
    DM.ev('62:1', 'tap', 'tick 投出后不能改', { sfx: 'tick' });
    DM.ev('62:2', 'tap', 'tap 投票');
    // rc.2: 「2票」 under the 午夜站台 card after the scroll at (134, 1259), 「· 你选了这张」 pill [104, 1330, 249, 81]
    DM.deco(sh, { parent: ph.screen, kind: 'star', color: 'yellow', size: 64, x: 230 * 0.4, y: 1200 * 0.4, z: 5, r: 10 }).in('pop', '62:3.5', { sfx: 'ding', gain: -4, label: 'star on 2票' }).out('pop', '63:1');
    // 62:3 the storyboard's digits 「2」 punch: the product's own count after your vote (「2票 · 你选了这张」), arrow into the phone
    DM.title(ty, { text: '【2】票', recipe: 'digits', size: 'XL', kind: 'label', x: COLL + 20, y: 330, r: -5, at: '62:3', fx: 'POP', until: '63:1', outFx: 'cut', label: 'digits 2票' });
    DM.arrow(sh, { from: [470, 350], to: () => { const [x, y] = ph.toWorld(Tc('62:4'), 134, 1259); return [x - 60, y - 6]; }, bend: -0.22, at: '62:3.5', dur: beat * 0.5, until: '63:1', color: 'pink', width: 9, z: 16, sfx: 'none', label: 'arrow 2票 -> phone' });
    // S6: taps, then the reveal; sparkles on the shared choice
    DM.ev('63:2', 'tap', 'tap 我选「午夜站台」');
    DM.ev('63:3', 'tap', 'tick 就选它，提交后不能改', { sfx: 'tick' });
    DM.ev('63:4', 'tap', 'tap 提交');
    DM.ev('64:1', 'cut', 'reveal (wait cut)', { sfx: 'swish', gain: -4 });
    // a fat yellow marker ring around 「选到一起了！」 (art #4: no starburst)
    DM.stroke(ty, { color: 'yellow', width: 20, at: '64:1.25', dur: beat * 0.5, z: 1, erase: '64:4.5', edur: 0.08, sfx: 'squeak', gain: -8, label: 'ring 选到一起了',
      gen: r => DM.paths.loop(470, 632, 420, 130, r, { tilt: -3, turns: 1.15 }) });
    DM.pops(sh, [['sparkle', 'yellow', 505 * 0.4, 1330 * 0.4, 46], ['star', 'pink', 90 * 0.4, 1430 * 0.4, 40, 12], ['sparkle', 'mint', 520 * 0.4, 1690 * 0.4, 34]], '64:3', beat / 4, { parent: ph.screen, z: 6, sfx: 'sparkle', gain: -6 }).forEach(n => n.out('pop', '65:1'));
    // type (left column)
    say(ty, 'T097', { x: COLL, y: 285 });
    say(ty, 'T098', { x: COLL, y: 600 });
    say(ty, 'T099', { x: COLL, y: 880 });
    say(ty, 'T101', { x: COLL, y: 220 });
    // v3: the product's own rule for the game (rc.2 games list 「默契局：先各自选，再一起揭晓。」; rc.1's 「揭晓前只显示你自己的选择。」 is gone)
    say(ty, 'T102', { x: COLL, y: 410, step: beat / 8, text: '先各自选，再一起揭晓。' });   // 32nds (11 characters, typed by 63:4.4, before the 64:1 reveal)
    say(ty, 'T103', { x: COLL, y: 630 });
  }

  // ======================================================================= SEG D · MAP + S7 + S8 + S9 + S10 · 65:1 -> 73:1 (L1, slides in from the right)
  {
    const MP = DM.clip(CAP.MAP), P17 = DM.clip(CAP.P17), P22 = DM.clip(CAP.P22), P19 = DM.clip(CAP.P19), P20 = DM.clip(CAP.P20);
    const enter = { kind: 'slide', dx: 760, dur: 0.14, sfx: 'swish' };
    // the act's exit: a whip pan on 72:4.5 (as into 65:1), so A6 starts on clean paper on 73:1
    const whipKeys = [['65:1', { x: 0, y: 0, s: 1 }], ['72:4.5', { x: -10, y: 0, s: 1.02 }, E.ioSine], ['73:1', { x: -1500, y: 0, s: 1.04 }, E.inExpo]];
    const blur = [['72:4.5', 0], ['72:4.75', 12], ['73:1', 60, E.inQ]];
    const sh = DM.shot('A5-SD-map-community-corner-card-myspace', '65:1', '73:1', { drift: null, cam: whipKeys, blur, enter });
    const ty = DM.shot('A5-SD-type', '65:1', '73:1', { paper: false, z: 30, drift: null, log: false, blur, cam: [['72:4.5', { x: 0 }], ['73:1', { x: -1500 }, E.inExpo]], enter: Object.assign({}, enter, { sfx: 'none' }) });
    sh.pulse(['67:1', '69:1', '70:1', '71:1', '71:3'], 0.016, 0.12);
    sh.pulse(['65:2', '65:3', '66:1', '66:2', '66:3', '67:3', '68:1', '68:3', '69:3', '70:3', '72:1', '72:3'], 0.006, 0.1);
    const media = DM.seq(
      // MAP (MAP-P1-round, phone 1080x2340): the record table 「寻声 · 费玉清 → 邓紫棋，隔着几首歌？」, flip 《千里之外》 (click f232) on 65:2
      feed(MP, '65:1', '65:2', 229),
      '65:3', feed(MP, '65:3', '65:3', 317),                            // tap 「来源」 on 65:3: the paper 共同演唱 周杰伦 × 费玉清 slides up (f320-340)
      '66:1', feed(MP, '66:1', '66:1', 531),                            // 前往 周杰伦 → 「前往周杰伦 · 第 1 步」 (the paper's close is cut)
      '66:2', feed(MP, '66:2', '66:2', 762),                            // 「前往林俊杰 · 第 2 步」
      '66:3', feed(MP, '66:3', '66:3', 981),                            // 「抵达邓紫棋！3 步」: the closing ceremony opens the duet network
      // S7 (P-17, the fan side of the venue's community): 这家 Livehouse 的乐迷社群 on 67:1 (beat 0 f103), tick 67:3, 加入，继续聊 67:4 -> room
      '67:1', feed(P17, '67:1', '67:1', 103),
      '68:3', feed(P17, '68:3', '68:3', 345),                           // 下一场预告 「回声现场 Vol.2」 (the menu taps are cut)
      // S8 (P-22, the creation corner with the cast joining in rc.2): tick on 69:2 (f119), 发出邀请 69:3 (f148) -> 「等 TA 加入。」
      '69:1', feed(P22, '69:1', '69:2', 119),
      '69:4', feed(P22, '69:4', '69:4', 466),                           // 小满 joined (f460): 「同一晚，我们的另一面。」 with both avatars
      // S9 (P-19): the recap card on 70:1 (beat 0 f194), 保存我的纪念卡 ↗ on 70:3 (f253); the form with its three ticks set and the
      // download on 70:4 (f399, 「已开始下载。」): rhythm #10's beat of invisible ticks is cut
      '70:1', feed(P19, '70:1', '70:1', 194),
      '70:4', feed(P19, '70:4', '70:4', 399),
      '71:3', feed(P20, '71:3', '71:3', 68));                           // S10: MY SPACE settled (f68; f63-f67 cross-fade from the room)
    const ph = DM.phone(sh, { media, x: L1.x, y: L1.y, r: L1.r, shadow: 'pink', z: 10, label: 'phone MAP-S10',
      view: [
        // MAP: the whole screen on 65:1 (slip + table + hand), onto the hand for the flip, the paper, then the table for the steps
        ['65:1', { s: 1.0, x: 540, y: 1170 }], ['65:1.75', { s: 1.0, x: 540, y: 1170 }], ['65:2.25', { s: 1.16, x: 540, y: 1480 }, E.outC], ['65:2.9', { s: 1.17, x: 540, y: 1480 }],
        ['65:3', { s: 1.12, x: 540, y: 1560 }, E.step], ['65:4.9', { s: 1.14, x: 540, y: 1560 }],
        ['66:1', { s: 1.3, x: 540, y: 1170 }, E.step], ['66:2.9', { s: 1.32, x: 540, y: 1170 }],
        ['66:3', { s: 1.15, x: 540, y: 980 }, E.step], ['66:3.5', { s: 1.15, x: 540, y: 980 }], ['66:4.9', { s: 1.3, x: 540, y: 1000 }, E.ioSine],
        // S7: the venue's join card, then (product cut on 67:4) the community room's 3D header at <= 1.3 (art #15), then the next show
        ['67:1', { s: 1.05, x: 525, y: 1620 }, E.step], ['67:3.9', { s: 1.07, x: 525, y: 1620 }],
        ['67:4', { s: 1.12, x: 520, y: 700 }, E.step], ['68:2.9', { s: 1.17, x: 512, y: 660 }, E.ioSine],
        ['68:3', { s: 1.1, x: 525, y: 1450 }, E.step], ['68:4.9', { s: 1.12, x: 525, y: 1450 }],
        // S8: the corner sheet; after 发出邀请 the sheet drops (「等 TA 加入。」 at y 2037-2078); 小满 joined: the card with both avatars
        ['69:1', { s: 1.08, x: 540, y: 1700 }, E.step], ['69:2.9', { s: 1.08, x: 540, y: 1700 }], ['69:3', { s: 1.1, x: 540, y: 1760 }, E.outC],
        ['69:4', { s: 1.06, x: 530, y: 1180 }, E.step], ['69:4.9', { s: 1.07, x: 530, y: 1180 }],
        // S9: the recap card close (title [150, 1088], button [150, 1301]), then the form with the ticks and the download
        ['70:1', { s: 1.35, x: 480, y: 1210 }, E.step], ['70:3.9', { s: 1.37, x: 480, y: 1210 }],
        ['70:4', { s: 1.1, x: 540, y: 1320 }, E.step], ['71:2.9', { s: 1.12, x: 540, y: 1330 }],
        // S10: MY SPACE, a short push onto the tiles
        ['71:3', { s: 1.0, x: 540, y: 1170 }, E.step], ['71:3.6', { s: 1.1, x: 510, y: 1080 }, E.outC], ['73:1', { s: 1.13, x: 510, y: 1080 }]] });
    shadowSeq(ph, [['65:1', 'pink'], ['67:1', 'mint'], ['69:1', 'yellow'], ['70:1', 'pink'], ['71:3', 'mint']]);
    ph.pulse(['67:1', '69:1', '70:1', '71:3'], 0.035, 0.1);
    backing(sh, L1, '65:1', '67:1', 'mint', 5);
    backing(sh, L1, '67:1', '69:1', 'yellow', 6);
    backing(sh, L1, '69:1', '70:1', 'pink', 7);
    backing(sh, L1, '70:1', '71:3', 'mint', 8);
    backing(sh, L1, '71:3', '73:1', 'yellow', 9);
    DM.ev('72:4.5', 'slide', 'whip pan out of A5', { sfx: 'whoosh', gain: -4 });

    // ---- MAP (65-66): taps in the footage, the duet paper, one step per beat
    DM.ev('65:2', 'tap', 'tap 翻开《千里之外》');
    DM.ev('65:3', 'tap', 'tap 来源');
    // the duet paper 「共同演唱 · 周杰伦 × 费玉清 · 千里之外 · 《依然范特西》· 合唱录音室版」 (the product's own paper, MAP-P1-round f346)
    // pops out of the phone where the product draws it (its pair line at (380, 1295)) onto the paper below the type column
    const DUET = { x: 1440, y: 768, r: 3 };
    const duet = dieCrop(sh, { src: CAP.DUET, crop: [0, 0, 620, 540], w: 500, x: DUET.x, y: DUET.y, r: DUET.r, z: 14, label: '共同演唱 周杰伦 × 费玉清 · 千里之外' });
    popOut(duet, ph, '65:4', 380, 1295, { r0: -4, arc: -30, dur: 0.18 });
    duet.wiggle('66:2', '66:3', 1.5, 3);
    duet.out('cut', '67:1');
    DM.ev('65:4', 'pop', 'pop-out the duet paper', { sfx: 'pop', gain: -3 });
    DM.tape(sh, { parent: duet, color: 'y', x: 260, y: 2, r: -3, w: 170, z: 30 }).in('slap', '65:4.5', { big: 1.5, spin: 8, sfx: 'tape', gain: -4, label: 'tape duet paper' });
    // the steps: a small punch on the product's toast each beat (前往周杰伦 · 第 1 步 [304, 1392, 468, 111]; 第 2 步 just below)
    ph.punch('66:1', { s: 1.05, x: 540, y: 1300 }, { until: '66:1.5', sfx: 'none', label: 'punch step 1' });
    ph.punch('66:2', { s: 1.05, x: 540, y: 1300 }, { until: '66:2.5', sfx: 'none', label: 'punch step 2' });
    DM.ev('66:1', 'tap', 'tap 前往 周杰伦 (第 1 步)', { note: 0 });
    DM.ev('66:2', 'tap', 'tap 前往 林俊杰 (第 2 步)', { note: 3 });
    DM.ev('66:3', 'tap', 'tap 前往 邓紫棋 = 抵达 (3 步)', { sfx: 'ding', gain: -4 });
    DM.pops(sh, [['sparkle', 'yellow', 720, 150, 64], ['star', 'pink', 740, 330, 50, 12], ['sparkle', 'mint', 200, 90, 44]], '66:3', beat / 4, { z: 16, sfx: 'sparkle', gain: -8 }).forEach(n => n.out('pop', '67:1'));

    // ---- S7 (67-68): the venue's fan community
    DM.ev('67:1', 'cut', 'S7 screen swap: 月台 Livehouse 乐迷社群', { sfx: 'none' });
    DM.ev('67:3', 'tap', 'tick 我愿意加入这个乐迷社群', { sfx: 'tick' });
    DM.ev('67:4', 'tap', 'tap 加入，继续聊');
    DM.ev('68:3', 'cut', '下一场预告 回声现场 Vol.2', { sfx: 'whoosh', gain: -8 });
    DM.pops(sh, [['star', 'yellow', 760, 140, 66, -8], ['heart', 'pink', 770, 310, 48, 8]], '68:1.5', beat / 2, { z: 14, gain: -10 }).forEach(n => n.out('pop', '68:3'));
    DM.deco(sh, { parent: ph.screen, kind: 'sparkle', color: 'yellow', size: 46, x: 960 * 0.4, y: 1430 * 0.4, z: 5 }).in('pop', '68:3.5', { sfx: 'ding', gain: -8, label: 'sparkle 下一场预告' }).out('pop', '69:1');

    // ---- S8 (69): the creation corner; the cast joins in rc.2
    DM.ev('69:1', 'cut', 'S8 screen swap: 创作角', { sfx: 'none' });
    DM.ev('69:2', 'tap', 'tick 邀请 TA，并展示我的昵称和小人', { sfx: 'tick' });
    DM.ev('69:3', 'tap', 'tap 发出邀请');
    // the product's own line after the invitation, 「等 TA 加入。」 (P-22 f175, x 60-296, y 2037-2078), pops out on the 8th after
    // the tap and gets the pink underline on 69:4 — when 小满 joins on screen
    const CON = { x: 1260, y: 672, r: -3 };
    const consent = dieCrop(sh, { src: CAP.WAIT, crop: [0, 0, 270, 84], w: 430, x: CON.x, y: CON.y, r: CON.r, z: 14, label: '等 TA 加入。' });
    popOut(consent, ph, '69:3.5', 178, 2058, { r0: 5, arc: -24 });
    consent.out('cut', '70:1');
    DM.ev('69:3.5', 'pop', 'pop-out 等 TA 加入。', { sfx: 'pop', gain: -4 });
    tiltWave(sh, { x0: CON.x - 190, x1: CON.x + 160, y: CON.y + 46, cx: CON.x, cy: CON.y, deg: CON.r, amp: 6, wl: 46, at: '69:4', dur: beat * 0.5, erase: '70:1', edur: 0.02, color: 'pink', width: 8, z: 16, label: 'underline 等 TA 加入' });
    DM.ev('69:4', 'cut', '小满 joined: 同一晚，我们的另一面。', { sfx: 'boop', gain: -4 });
    DM.deco(sh, { kind: 'heart', color: 'pink', size: 70, x: 760, y: 250, z: 16, r: -8 }).in('pop', '69:4.5', { gain: -8, label: 'heart 小满 joined' }).out('pop', '70:1');

    // ---- S9 (70-71): the memory card
    DM.ev('70:1', 'cut', 'S9 screen swap: recap', { sfx: 'none' });
    DM.ev('70:3', 'tap', 'tap 保存我的纪念卡');
    DM.ev('70:4', 'tap', 'tap 下载纪念卡 PNG');
    // the three ticks are already set in the form on 70:4 (photo / 带上我的小人 / 确认保存到我的设备, checkboxes at (105, 591),
    // (164, 1329), (120, 1581)): a mint check pops beside each on 16ths, so the consent reads (rhythm #10: no beat without a change)
    [[105, 591, '70:4'], [164, 1329, '70:4.25'], [120, 1581, '70:4.5']].forEach(([x, y, at], i) => DM.deco(sh, { parent: ph.screen, kind: 'check', color: 'mint', size: 44, x: (x + 64) * 0.4, y: (y - 34) * 0.4, z: 6, lw: 1.1 })
      .in('pop', at, { sfx: i ? 'tick' : 'none', gain: -6, note: i * 2, label: 'check ' + (i + 1) }).out('pop', '71:3'));
    const CARD = { x: 1600, y: 330, w: 360 };            // the memory card's landing spot (top right; 「把这一晚，留在手里。」 sits below it)
    const crop = [30, 25, 1020, 1392];                     // CUT-08: the card with its own ink border + hard shadow (the PNG's paper margin trimmed)
    const ch = Math.round(CARD.w * crop[3] / crop[2]);
    const cardEl = DM.h('div'); cardEl.style.cssText = `width:${CARD.w}px;height:${ch}px;position:relative`;
    const k = CARD.w / crop[2];
    cardEl.innerHTML = `<div style="position:absolute;left:0;top:0;width:${CARD.w}px;height:${ch}px;overflow:hidden"><img decoding="sync" src="${DM.asset(CAP.CUT08)}" style="position:absolute;left:${(-crop[0] * k).toFixed(1)}px;top:${(-crop[1] * k).toFixed(1)}px;width:${(1080 * k).toFixed(1)}px;height:${(1440 * k).toFixed(1)}px"></div>`;
    const card = DM.node(sh, cardEl, { x: CARD.x, y: CARD.y, r: -3, z: 20, boil: { px: 0.4, deg: 0.15 }, label: 'CUT-08 memory card PNG' }).show('71:1');
    const t71 = DM.T('71:1');
    if (t71 !== null) {
      // flies out of the phone screen on 71:1: from the phone (scale .25, -10 deg) to the landing spot in 10 frames, ease-out-back
      const fromX = L1.x - CARD.x, fromY = L1.y + 60 - CARD.y;
      card.track(t => { const u = clamp((t - t71) / 0.16); if (u >= 1) return null; const k2 = E.outBack(u, 1.4);
        return { x: lerp(fromX, 0, Math.min(1, E.outC(u))), y: lerp(fromY, 0, Math.min(1, E.outC(u))) - Math.sin(u * Math.PI) * 60, s: lerp(0.25, 1, k2), r: lerp(-10, 0, E.outC(u)) }; });
      DM.ev('71:1', 'slap', 'memory card PNG lands', { sfx: 'slap', gain: 2, note: 0 });
      sh.shake('71:1.1', 6, 4);
      DM.pops(sh, [['sparkle', 'yellow', CARD.x - 240, CARD.y + 40, 60], ['star', 'mint', CARD.x + 230, CARD.y - 110, 56, 10], ['sparkle', 'pink', CARD.x + 220, CARD.y + 230, 48]], '71:1', beat / 4, { z: 22, sfx: 'none' }).forEach(n => n.out('pop', '71:3'));
    }
    DM.tape(sh, { parent: card, color: 'p', x: CARD.w * 0.5, y: 4, r: -4, w: 170, z: 30 }).in('slap', '71:1.5', { big: 1.6, spin: 9, sfx: 'tape', gain: -2, label: 'tape 1' });
    DM.tape(sh, { parent: card, color: 'm', x: CARD.w - 26, y: ch - 40, r: -38, w: 130, z: 30 }).in('slap', '71:2', { big: 1.6, spin: -9, sfx: 'tape', gain: -3, label: 'tape 2' });
    // S10 (71:3): the card steps aside — smaller, pinned bottom-right — so 「散场后，仍有地方回来。」 gets the column
    card.move('71:2.75', '71:3.25', { x: 1730 - CARD.x, y: 862 - CARD.y, s: 0.5, r: 7 }, E.outBack);
    DM.ev('71:2.75', 'slide', 'memory card steps aside', { sfx: 'swish', gain: -8 });

    // ---- S10 (71:3-72): MY SPACE; the four tiles of this act underlined on 8ths (rc.2 tiles: 我的乐迷社群 / 好友与新招呼 / 私聊 / 共同记忆)
    DM.ev('71:3', 'cut', 'S10 screen swap: MY SPACE', { sfx: 'none' });
    [['我的乐迷社群', 150, 432, 1252], ['好友与新招呼', 150, 430, 1445], ['私聊', 650, 755, 1445], ['共同记忆', 150, 338, 1640]].forEach(([nm, x0, x1, y], i) => {
      underlineOn(ph, { x0, x1, y, at: `72:${1 + i * 0.5}`, dur: beat * 0.4, color: 'yellow', width: 10, erase: '72:4.5', edur: 0.06, sfx: 'tick', gain: -4, label: 'tile ' + nm });
    });
    ph.punch('72:3', { s: 1.06, x: 290, y: 1210 }, { until: '72:4', sfx: 'none', label: 'punch 我的乐迷社群' });

    // ---- type (right column).  Reading order: a new line always enters below the older one, which jumps to the top slot on the
    // downbeat its upper neighbour leaves.
    // MAP (v3, new lines T113-T115; T114 + T115 are the map's own tagline 「从一位喜欢的歌手出发，沿着合唱找到下一首。」)
    line(ty, 'T113', { text: '【音乐探索】：', recipe: 'ink-yellow', x: COLR, y: 222, at: '65:1', until: '66:1', outFx: 'cut' });
    jumpAt(line(ty, 'T114', { text: '沿着【合唱】，', recipe: 'ink-mint', x: COLR, y: 450, at: '65:3', until: '67:1', outFx: 'cut' }), '66:1', 222 - 450);
    line(ty, 'T115', { text: '找到【下一首】。', recipe: 'ink-pink', x: COLR, y: 450, at: '66:1', until: '67:1', outFx: 'cut' });
    // S7 (owner 2026-10-07: the community is the Livehouse's own; v3: the product names it 「Livehouse 乐迷社群」)
    say(ty, 'T104', { x: COLR, y: 222, text: 'Livehouse 的\n【乐迷社群】，', at: '67:1', until: '68:1', outFx: 'cut' });
    jumpAt(say(ty, 'T105', { x: COLR - 14, y: 560, text: '也给你\n留一个【位置】。', at: '67:3', until: '69:1', outFx: 'cut' }), '68:1', 222 - 560);   // x - 14: the SLAM overshoot stays inside the title-safe edge
    say(ty, 'T106', { x: COLR, y: 560, at: '68:1', until: '69:1', outFx: 'cut' });
    // S8
    say(ty, 'T107', { x: COLR, y: 225, at: '69:1', until: '70:1', outFx: 'cut' });
    say(ty, 'T108', { x: COLR, y: 420, at: '69:3', until: '70:3', step: beat / 8 });   // 32nds (9 characters, typed by 69:4.1, before the 70:1 cut)
    // S9: the recap's own title, under the corner's line (T108 leaves on 70:3), below the landing card
    say(ty, 'T109', { x: COLR, y: 765, at: '70:1', until: '71:3', outFx: 'cut' });
    // (v3: T110 「纪念卡，」 and T111 「在你的浏览器里生成。」 are gone: the memory card and My Space share three bars to make room for the
    // Music Map; the PNG lands on its own and rc.2 no longer says 「不会上传或自动公开」, T111's support in the product)
    // S10
    say(ty, 'T112', { x: 775, y: 270, at: '71:3', until: '73:1', outFx: 'cut' });
  }

  // (v3: S11, the drum-roll recap of CUT-01..08 on 72, is gone: STORYBOARD §5 lists it as the first A5 bar to cut (✂2); it repeated the
  // hook collage and its stills were rc.1 (old copy).  The whip on 72:4.5 hands A6 clean paper on 73:1.)
})();
