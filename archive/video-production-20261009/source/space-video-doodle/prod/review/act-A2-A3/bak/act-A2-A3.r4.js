/* Music Space · Doodle video — ACT A2 ENTER (bars 21-28) + ACT A3 PHOTO + AI (bars 29-40).
 * Words: SCRIPT.md T041-T049 (A2), T050-T067 (A3), via DM.say (text, font, size, recipe, entrance, in/out from the script).
 * Pictures and beats: STORYBOARD.md E1 (the drop: the phone rises with the real first screen), E2 (wardrobe, a look per beat),
 * E3 (entry form: 愿意打招呼 / 安静参与, consent tick), E4 (desktop 3D room, the five circled, 示例角色 stamp), A1 (room -> upload form,
 * 拍摄于 21:48), A2 (「✦ AI 判断：人海」 on the chime, 人海。, AI 在本机判断，照片不上传), A3 (the honest 「✦ 不确定，请选择」, tap 舞台),
 * A4 (save -> wall panel, desktop 3D wall 4 -> 5 photos, 上墙啦！), A5 (21:47 同一刻, the rule line ≤ 3 min, 规则判断，不是 AI, the badge).
 * Footage: TAKE-P1 P-01/02/03/05/07/08, TAKE-P2 P-06 (fresh world, never saved), desktop D-02 / D-03a / D-03b (4K masters).  All the
 * phone taps were choreographed on the 123 BPM grid of Flipping In: clips play at rate R = (60/123) / beat so the taps stay on the beats
 * under any tempo map (R = 1 under flipping-in).  Positions on the footage are source pixels (1080 x 2340 phone, 3840 x 2160 desktop),
 * measured on the captures (review/act-A2-A3/fr/g-*.png).
 * Local helpers (not in the library): `patch` (a crop of a capture still laid over the phone screen, here to hide the rig's tap ring on a
 * held frame), `hlOn` (highlighter glued to footage whose band height follows the zoom), `z0` (see below: DM.circle/check/underline/
 * highlight with numeric x/y are offset twice by DM.Node; the library's own acts pass functions, which are not affected), `cutKey`
 * (a hard change of a device's zoom at a cut), `fromAt` (clip start so that a given source frame lands on a beat at rate R).
 * Lift-offs: real UI elements (CUT-04a chip, WALL-01 rule, CUT-05 badge, POL-03/04/05 wall cards: die-cuts of the same build and state,
 * from capture/P2P3/cut) fly out of the phone from their on-screen position and size (device.toWorld + view zoom), then back.
 */
(() => {
  const E = DM.E, T = DM.T, Tc = DM.Tc, say = DM.say;
  const beat = DM.beatS();
  const R = (60 / 123) / beat;                    // playback rate of the beat-choreographed captures (1 under flipping-in)
  const fr = n => n / 60;                          // source frame -> source second
  // source second at which a clip must start at `start` so that its frame `f` lands on `anchor` (playing at rate R)
  const fromAt = (f, anchor, start) => fr(f) - R * (Tc(anchor) - Tc(start));
  // two keys = a hard change of the view at a cut
  const cutKey = (pos, before, after) => [[Tc(pos) - 0.0005, before, E.lin], [Tc(pos), after, E.lin]];
  const bars = (a, b, beats = [1, 3]) => { const o = []; for (let i = a; i <= b; i++) for (const k of beats) o.push(`${i}:${k}`); return o; };

  // -------------------------------------------------------------------------------------------- local primitives
  /** a crop of a still (source px rect sx,sy,sw,sh of a 1080x2340 capture) laid over a phone screen at dst (source px), feathered */
  const patch = (sh, ph, o) => {
    const k = ph.sw0 / 1080;
    const n = DM.div(sh, { parent: ph.screen, w: o.sw * k, hgt: o.sh * k, x: o.dx * k, y: o.dy * k, ax: 0, ay: 0, boil: false, z: 5,
      html: `<img decoding="sync" src="${DM.asset(o.src)}" style="position:absolute;left:${(-o.sx * k).toFixed(2)}px;top:${(-o.sy * k).toFixed(2)}px;width:${(1080 * k).toFixed(2)}px;height:${(2340 * k).toFixed(2)}px;max-width:none">`,
      label: 'patch ' + o.label });
    n.el.style.overflow = 'hidden';
    n.el.style.webkitMaskImage = n.el.style.maskImage = 'radial-gradient(closest-side, #000 74%, transparent 100%)';
    return n;
  };
  /** highlighter band over UI text in footage: x, y, w, hgt in source px (the band height scales with the zoom, unlike DM.highlight on:) */
  const hlOn = (sh, dev, o) => {
    const st = new DM.Stroke(sh, { parent: dev.screen, vw: 1080, vh: 2340, color: o.color || 'yellow', width: o.hgt, at: o.at, dur: o.dur ?? beat * 0.8,
      erase: o.erase, kind: 'swipe', label: o.label || 'highlight', opacity: o.opacity ?? 0.6, linecap: 'butt', z: 15,
      gen: r => DM.paths.line([[o.x, o.y + o.hgt / 2 + (r() - .5) * 3], [o.x + o.w * 0.5, o.y + o.hgt / 2 + (r() - .5) * 4], [o.x + o.w, o.y + o.hgt / 2 + (r() - .5) * 3]], r, { jit: 2 }) });
    st.el.style.width = dev.sw0 + 'px'; st.el.style.height = dev.sh0 + 'px'; st.p.style.mixBlendMode = 'multiply';
    return st;
  };
  // DM.circle / DM.check / DM.underline read x / y as path coordinates, but DM.Node also takes numeric o.x / o.y as the element's
  // own offset (the stroke would be drawn twice as far): zero the node offset (functions are not affected; the library's own acts use those)
  const z0 = n => { n.x = 0; n.y = 0; return n; };
  const tapAt = (at, label, note = 0) => DM.ev(at, 'tap', label, { sfx: 'click', note });     // the capture shows its own tap ring; this is the click

  // ============================================================================================== A2 · E1-E3 · THE PHONE (L1) · 21:1 -> 27:1
  // One composition: the phone stays (X5 screen swaps on 23:1 and 25:1), the right column carries the type.
  {
    const sh = DM.shot('A2-E-phone', '21:1', '27:1', { drift: null });
    const ty = DM.shot('A2-E-type', '21:1', '27:1', { paper: false, z: 30, drift: null, log: false });
    sh.pulse(bars(21, 26), 0.008, 0.1);
    const P01 = DM.clip('P-01'), P02 = DM.clip('P-02'), P03 = DM.clip('P-03');
    const tE2freeze = Tc('23:1') + fr(550 - 331) / R;          // P-02 f550: the save tap ring is down, the wardrobe still open
    const feed = DM.seq(
      DM.play(P01, { at: '21:1', from: fromAt(363, '22:3', '21:1'), rate: R }),   // E1: first screen; the tap on 进入示例现场 = 22:3
      '23:1', DM.play(P02, { at: '23:1', from: fr(331), rate: R }),               // E2: presets 23:1-23:4, angles 24:1-24:4, save 24:4.5
      tE2freeze, DM.play(P02, { at: tE2freeze, from: fr(550), rate: 0 }),
      '25:1', DM.play(P03, { at: '25:1', from: fr(121), rate: R }));              // E3: scroll 25:2, tick 26:1, enter 26:3
    const full = { s: 1, x: 540, y: 1170 };
    // view keys (source px).  E2's punch onto the figure (24:1) is written as keys so that it ends with the hard cut on 25:1.
    const view = [
      ['21:1', full], ['21:3', full], ['22:1', { s: 1.07, x: 540, y: 1250 }, E.ioSine],
      ...cutKey('23:1', { s: 1.08, x: 540, y: 1250 }, { s: 1.32, x: 560, y: 700 }),
      ['24:1', { s: 1.36, x: 560, y: 700 }, E.ioSine], [Tc('24:1') + 4 / 60, { s: 1.76, x: 540, y: 610 }, E.outC],
      ...cutKey('25:1', { s: 1.82, x: 540, y: 610 }, full),
      ['25:3', full], ['25:4', { s: 1.14, x: 540, y: 1270 }, E.ioC], ['26:3', { s: 1.17, x: 540, y: 1280 }, E.ioSine], ['26:3.6', full, E.outC], ['27:1', { s: 1.03, x: 540, y: 1170 }, E.ioSine],
    ];
    const ph = DM.phone(sh, { media: feed, x: 470, y: 548, r: -2, w: 500, shadow: 'mint', z: 6, view, label: 'phone E' });
    ph.drift('21:3', '27:1', { s: 1.025, y: -4 });
    ph.in('rise', '21:1', { dur: 0.42, dist: 1150, spin: 5, sfx: 'whoosh', label: 'phone rises (drop)' });
    // E1 punch onto the 「同一刻，另一面。」 card, back out for the tap
    ph.punch('22:1', { s: 1.3, x: 320, y: 1390 }, { until: '22:2.5', sfx: 'thump', label: 'punch: the card 同一刻，另一面。' });
    // E2 punch onto the figure for the four angles
    DM.ev('24:1', 'punch', 'punch: the figure turns', { sfx: 'thump', gain: -4 });
    // the drop: starburst behind the phone, a boom under it (the bed's own drop is soft under some maps)
    DM.burst(sh, { x: 470, y: 560, rOut: 600, rIn: 455, n: 22, color: 'yellow', spin: 12, z: 1 }).in('grow', '21:1', { dur: 0.22, log: false }).out('shrink', '22:4.5', { dur: 0.12 });
    DM.sfx('21:1', 'boom', { gain: -9 });
    // E2 / E3 colour blocks behind the phone (a new paper per section)
    DM.scrap(sh, { w: 640, hgt: 860, color: 'pink', x: 470, y: 560, r: 5, z: 1 }).in('slap', '23:1', { big: 1.12, spin: -6, sfx: 'slap', gain: -6, label: 'pink paper' }).out('cut', '25:1');
    DM.scrap(sh, { w: 660, hgt: 820, color: 'mint', x: 480, y: 580, r: -4, z: 1 }).in('slap', '25:1', { big: 1.12, spin: 6, sfx: 'slap', gain: -6, label: 'mint paper' });
    ph.pulse(['23:1', '25:1'], 0.03, 0.08);

    // ---- E1 (21-22): type, a tap, a ding
    say(ty, 'T041', { x: 880, y: 375 });
    const t42 = say(ty, 'T042', { x: 880, y: 655 });
    DM.underline(ty, { wavy: true, amp: 7, wl: 56, width: 9, color: 'mint', at: '22:1.5', dur: beat * 0.6, z: 25, label: 'wavy 同一间',
      x0: () => t42.keyRect().x0 - 4, x1: () => t42.keyRect().x1 + 6, y: () => t42.keyRect().y1 + 2 }).out('cut', '23:1');
    tapAt('22:3', 'tap 进入示例现场');
    DM.pops(sh, [['sparkle', 'pink', 790, 150, 64]], '21:2', beat, { z: 12, gain: -10 });
    DM.pops(sh, [['star', 'mint', 1760, 905, 84, 12]], '21:4', beat, { z: 12, gain: -10 }).forEach(d => d.out('pop', '23:1'));
    DM.deco(sh, { kind: 'heart', color: 'pink', size: 92, x: 790, y: 905, r: -10, z: 12 }).in('pop', '22:4', { sfx: 'ding', gain: -6, label: 'ding heart' }).out('pop', '23:1');

    // ---- E2 (23-24): the wardrobe flips on every beat; a tiny star per tap, the note
    say(ty, 'T043', { x: 850, y: 470 });
    say(ty, 'T044', { x: 845, y: 215, r: -4 });
    const st = [[805, 520, 'yellow'], [835, 700, 'mint'], [790, 860, 'pink'], [840, 1000, 'yellow']];
    ['23:1', '23:2', '23:3', '23:4'].forEach((at, i) => {
      tapAt(at, 'tap preset ' + (i + 1), i % 2 ? 3 : 0);
      DM.deco(sh, { kind: i % 2 ? 'sparkle' : 'star', color: st[i][2], size: 58 + (i % 2) * 6, x: st[i][0], y: st[i][1], r: (i - 1.5) * 9, z: 12 })
        .in('pop', at, { sfx: 'none', label: 'look ' + (i + 1) }).out('pop', '25:1');
    });
    ['24:1', '24:2', '24:3', '24:4'].forEach((at, i) => tapAt(at, 'tap angle ' + (i + 1), i % 2 ? 3 : 0));
    DM.pops(sh, [['sparkle', 'mint', 790, 640, 50], ['sparkle', 'pink', 815, 380, 44]], '24:2', beat, { z: 12, sfx: 'none' }).forEach(d => d.out('pop', '25:1'));
    DM.deco(sh, { kind: 'star', color: 'yellow', size: 96, x: 800, y: 905, r: 10, z: 12 }).in('pop', '24:4', { sfx: 'ding', gain: -6, label: 'ding star' }).out('pop', '25:1');
    tapAt('24:4.5', 'tap 保存这个我 (off frame; E3 opens on the toast 小人已保存)');
    z0(DM.check(sh, { x: 800, y: 760, size: 90, at: '24:4.5', dur: beat * 0.4, color: 'mint', width: 11, z: 12, sfx: 'pencil', label: 'saved check' })).out('cut', '25:1');

    // ---- E3 (25-26): the participation choice; bracket from the two options to the type; the consent tick
    say(ty, 'T045', { x: 880, y: 290 });
    say(ty, 'T046', { x: 880, y: 575 });
    say(ty, 'T047', { x: 905, y: 865, r: -4 });
    // after the scroll (P-03 f179): 愿意打招呼 y 1000-1262, 安静参与 y 1298-1500 (x 88-969); consent box (122, 1651); 进入示例现场 (535, 1839)
    const sp = (sx, sy) => ph.toWorld(DM._lastT, sx, sy);
    DM.stroke(sh, { color: 'pink', width: 9, at: '25:3', dur: beat * 0.7, z: 14, label: 'bracket around both options', erase: '26:3', sfx: 'squeak',
      gen: r => { const a = sp(1010, 1000), b = sp(1010, 1500); const x = Math.max(a[0], b[0]) + 18, m = (a[1] + b[1]) / 2;
        return DM.paths.curve([[x - 14, a[1]], [x + 10, a[1] + 14], [x + 12, m - 30], [x + 38, m], [x + 12, m + 30], [x + 10, b[1] - 14], [x - 14, b[1]]], r, { jit: 3 }); } });
    tapAt('26:1', 'tick consent');
    z0(DM.check(sh, { on: ph, x: 128, y: 1652, size: 150, at: '26:1', color: 'mint', width: 11, label: 'mint check on the consent tick', sfx: 'pencil', erase: '26:3' }));
    tapAt('26:3', 'tap 进入示例现场');
    DM.deco(sh, { kind: 'star', color: 'mint', size: 92, x: 790, y: 1000, r: -8, z: 12 }).in('pop', '26:4', { sfx: 'ding', gain: -6, label: 'ding star' });
  }
  DM.wipe('W-A2-room', '26:4.5', '27:1', { colors: ['mint', 'yellow'] });

  // ============================================================================================== A2 · E4 · WHO IS HERE (L4) · 27:1 -> 29:1
  {
    const sh = DM.shot('A2-E4-room', '27:1', '29:1', { drift: null, cam: [['27:1', { x: 0, y: 0, s: 1.0 }], ['29:1', { x: -6, y: -4, s: 1.025 }, E.ioSine]] });
    const ty = DM.shot('A2-E4-type', '27:1', '29:1', { paper: false, z: 30, drift: null, log: false });
    sh.pulse(bars(27, 28), 0.008, 0.1);
    const D02 = DM.clip('D-02-room-hero');
    // +2 elastic bar (maps that insert a bar after 28): the product camera glides from the overview to the photo wall (D-02 8.0 s)
    const feed = DM.seq(DM.play(D02, { at: '27:1', from: 0.4 }), '28+1:1', DM.play(D02, { at: '28+1:1', from: 8.0 }));
    const view = DM.has('28+1:1')
      ? [['27:1', { s: 1.8, x: 1700, y: 1098 }], ['28+1:1', { s: 1.88, x: 1710, y: 1070 }, E.ioSine], ['28+1:2', { s: 1.12, x: 1920, y: 1080 }, E.ioC], ['29:1', { s: 1.16, x: 1920, y: 1080 }, E.ioSine]]
      : [['27:1', { s: 1.8, x: 1700, y: 1098 }], ['29:1', { s: 1.9, x: 1712, y: 1062 }, E.ioSine]];
    const desk = DM.desk(sh, { media: feed, w: 1800, x: 960, y: 532, z: 4, srcW: 3840, srcH: 2160, label: 'desk 3D room', view });
    desk.show('27:1');
    // the five, circled on the beats (figure boxes measured on D-02, master px)
    const K = 1800 / 3840;
    const who = [['27:2', '阿遥', 1320, 1162, 'pink', -5], ['27:3', '小满', 1507, 1156, 'yellow', 4], ['27:4', '北屿', 1716, 1166, 'mint', -3], ['28:1', '林间', 2145, 1168, 'pink', 5]];
    who.forEach(([at, nm, x, y, c, tilt], i) => {
      z0(DM.circle(sh, { on: desk, x, y, rx: 118, ry: 262, tilt, at, dur: beat * 0.55, color: c, width: 9, erase: '28+1:1', label: 'circle ' + nm, gain: -8, note: i,
        origin: [x * K, y * K] })).wiggle('28:3', '28:4.2', 4, 6);
    });
    // 阿宁 · 我: a yellow loop + a pink heart on 28:2
    z0(DM.circle(sh, { on: desk, x: 1945, y: 1152, rx: 118, ry: 262, tilt: 3, at: '28:2', dur: beat * 0.5, color: 'yellow', width: 10, erase: '28+1:1', label: 'circle 阿宁 · 我', sfx: 'none',
      origin: [1945 * K, 1152 * K] })).wiggle('28:3', '28:4.2', 4, 6);
    const heart = DM.deco(sh, { kind: 'heart', color: 'pink', size: 64, x: 0, y: 0, z: 12 }).in('pop', '28:2', { sfx: 'boop', gain: -4, label: 'heart on 阿宁 · 我' });
    heart.track(t => { const [x, y] = desk.toWorld(t, 1937, 868); return { x, y }; });
    DM.pops(sh, [['sparkle', 'yellow', 0, 0, 52], ['sparkle', 'mint', 0, 0, 44]], '28:3', beat / 2, { z: 12, gain: -10 }).forEach((d, i) =>
      d.track(t => { const [x, y] = desk.toWorld(t, i ? 2330 : 1150, i ? 990 : 1010); return { x, y }; }));
    // inserted bar (maps +28+1 only): the product's camera glides to the photo wall (the cast hides on the way, product behaviour)
    DM.ev('28+1:1', 'slide', 'camera glides to the photo wall', { sfx: 'whoosh', gain: -6 });
    DM.pops(sh, [['star', 'yellow', 1500, 260, 80, 8], ['sparkle', 'pink', 1640, 380, 56]], '28+1:3', beat / 2, { z: 12, gain: -9 });
    // type on a die card (bottom left) + the stamp over the cast
    DM.card(ty, { w: 820, hgt: 196, x: 520, y: 912, r: -2, z: 5 }).in('slap', '27:1', { big: 1.15, spin: -4, sfx: 'none', log: false });
    say(ty, 'T048', { x: 152, y: 905, r: -2, z: 8 });
    say(ty, 'T049', { x: 1420, y: 905, ax: 0.5, r: -6, z: 8, until: DM.has('28+1:1') ? '28+1:2' : '29:1' });   // leaves while the cast hides in the glide
    DM.deco(ty, { kind: 'star', color: 'yellow', size: 88, x: 1745, y: 700, r: 12, z: 9 }).in('pop', '28:4', { sfx: 'ding', gain: -6, label: 'ding star' });
  }

  // ============================================================================================== A3 · A1-A4 · THE PHONE (L2) · 29:1 -> 36:1
  // P-05 (room -> upload form, 21:48, the AI chip), P-06 (the honest case, a fresh world), P-07 (save -> the wall panel); X5 swaps.
  // fixed disclosure for every frame that shows the AI concert photos (29:1 -> 41:1); a paper backing over desktop footage (bar 36)
  {
    const fx = DM.shot('A3-fixed', '29:1', '41:1', { paper: false, z: 45, drift: null, log: false });
    DM.card(fx, { w: 440, hgt: 60, x: 334, y: 994, r: 0, z: 1 }).show('36:1', '37:1');
    DM.fine(fx, { text: '照片为 AI 生成的示例图', x: 132, y: 994, ax: 0, at: '29:1', fx: 'FADE', until: '41:1', outFx: 'cut', z: 3, label: 'AI disclosure' });
  }
  {
    const sh = DM.shot('A3-A-phone', '29:1', '36:1', { drift: null, enter: { kind: 'slap', dur: 0.14, big: 1.08, spin: -2, sfx: 'slap' } });
    const ty = DM.shot('A3-A-type', '29:1', '36:1', { paper: false, z: 30, drift: null, log: false });
    sh.pulse(bars(29, 35), 0.008, 0.1);
    const P05 = DM.clip('P-05'), P06 = DM.clip('P-06'), P07 = DM.clip('P-07');
    // P-05: tap on 人海 · 示例照片 = f63 on 29:3; the sheet settles by f76; the product jumps to the photo + AI chip at f77 = 31:3 (chime).
    // f76 is held 29:3.45 -> 31:3 (a real frame of the settled form; the AI's pre-selection 人海 ✓ is already visible, it is not
    // staged as "thinking"); after the jump the rig's tap ring finishes fading (f77-f89), then the static form is held.
    const tF76 = Tc('29:3') + fr(76 - 63) / R, tF100 = Tc('31:3') + fr(100 - 77) / R;
    const feed = DM.seq(
      DM.play(P05, { at: '29:1', from: fromAt(63, '29:3', '29:1'), rate: R }),
      tF76, DM.play(P05, { at: tF76, from: fr(76), rate: 0 }),
      '31:3', DM.play(P05, { at: '31:3', from: fr(77), rate: R }),
      tF100, DM.play(P05, { at: tF100, from: fr(100), rate: 0 }),
      '33:3', DM.play(P06, { at: '33:3', from: fromAt(134, '33:4', '33:3'), rate: R }),     // P-06: 不确定 on 33:4, tap 舞台 on 34:3
      '35:1', DM.play(P07, { at: '35:1', from: fromAt(63, '35:2', '35:1'), rate: R }));     // P-07: tap 保存这张照片 on 35:2 -> the wall
    const full = { s: 1, x: 540, y: 1170 };
    const chips = { s: 1.5, x: 450, y: 1660 };          // the 我拍的这一面 area (pre-jump layout); after the jump: the AI chip + hint
    const honest = { s: 1.22, x: 530, y: 1400 };        // P-06 after its jump: the dashed chips + 不确定 line + hint
    const view = [
      ['29:1', full], ['30:1', full], ['30:4.5', { s: 1.06, x: 560, y: 1100 }, E.ioSine], ['30:4.75', full, E.outC],
      ['31:1', full], ['31:2', chips, E.outC], ['31:3', { s: 1.53, x: 450, y: 1670 }, E.ioSine], ['33:1', { s: 1.58, x: 450, y: 1680 }, E.ioSine],
      ['33:1.5', { s: 1.15, x: 520, y: 1640 }, E.outC], ['33:3', { s: 1.18, x: 520, y: 1650 }, E.ioSine],
      ...cutKey('33:3', { s: 1.18, x: 520, y: 1650 }, { s: 1.0, x: 540, y: 1170 }),
      ['33:3.9', full], ['33:4', honest, E.outC], ['34:4', { s: 1.25, x: 530, y: 1400 }, E.ioSine], ['34:4.5', full, E.outC],
      ...cutKey('35:1', full, { s: 1.45, x: 540, y: 1640 }),
      ['35:2', { s: 1.5, x: 540, y: 1660 }, E.ioSine], ['35:2.5', { s: 1.1, x: 540, y: 1000 }, E.outC], ['36:1', { s: 1.16, x: 540, y: 980 }, E.ioSine],
    ];
    const ph = DM.phone(sh, { media: feed, x: 1452, y: 548, r: 2, w: 500, shadow: 'yellow', z: 6, view, label: 'phone A' });
    ph.show('29:1').drift('29:1', '36:1', { s: 1.025, y: -4 });
    DM.scrap(sh, { w: 700, hgt: 900, color: 'yellow', x: 1440, y: 560, r: -5, z: 1 }).show('29:1').out('cut', '33:3');
    DM.scrap(sh, { w: 680, hgt: 880, color: 'pink-soft', x: 1460, y: 560, r: 4, z: 1 }).in('slap', '33:3', { big: 1.1, spin: 6, sfx: 'slap', gain: -8, label: 'pink paper' }).out('cut', '35:1');
    DM.scrap(sh, { w: 690, hgt: 880, color: 'mint', x: 1450, y: 560, r: -3, z: 1 }).in('slap', '35:1', { big: 1.1, spin: -6, sfx: 'slap', gain: -8, label: 'mint paper' });
    // hide the rig's half-faded tap ring on the held frame f76 with the same pixels from the settled form (CUT-04-full = P-05 f239,
    // scrolled 606 px further): dst (400..680, 1440..1710) <- src y - 606
    patch(sh, ph, { src: 'CUT-04-full', sx: 400, sy: 1440 - 606, sw: 280, sh: 270, dx: 400, dy: 1440, label: 'tap ring on the held f76' }).show(tF76, '31:3');

    // ---- A1 (29-30): room -> upload form -> 拍摄于 21:48
    z0(DM.circle(sh, { on: ph, x: 535, y: 1572, rx: 470, ry: 92, at: '29:2', dur: beat * 0.6, color: 'pink', width: 9, erase: '29:3', label: 'circle 人海 · 示例照片' }));
    tapAt('29:3', 'tap 人海 · 示例照片');
    DM.ev('29:4', 'slide', 'upload form slides up', { sfx: 'shutter', gain: -6 });
    {   // the build's own sample photo (AI image, labelled) slaps onto the paper on the tap and flies into the form's polaroid
      const P0 = [610, 700], t294 = Tc('29:4'), dur = beat * 0.75;
      const pol = DM.polaroid(sh, { src: 'photo:sample-crowd', w: 340, hgt: 425, x: P0[0], y: P0[1], r: -6, z: 9, tape: 'y', tapeW: 150, label: 'sample photo flies in' })
        .in('slap', '29:3', { big: 1.3, spin: -8, sfx: 'slap', gain: -4 });
      pol.t1 = t294 + dur;
      pol.track(t => { const k = E.ioC(DM.clamp((t - t294) / dur)); if (k <= 0) return null;
        const [tx, ty] = ph.toWorld(t, 278, 1078);
        return { x: (tx - P0[0]) * k, y: (ty - P0[1]) * k, s: DM.lerp(1, 0.447, k), r: 8 * k, o: 1 - E.inQ(DM.clamp((k - 0.7) / 0.3)) }; });
      DM.ev('29:4', 'slide', 'the photo flies into the form', { sfx: 'swish', gain: -8 });
    }
    ph.punch('30:1', { s: 2.1, x: 752, y: 1235 }, { until: '30:4.5', sfx: 'thump', label: 'punch: 拍摄于 21:48 + the note' });
    z0(DM.underline(sh, { on: ph, x0: 548, x1: 880, y: 1046, at: '30:1.5', dur: beat * 0.5, color: 'pink', width: 8, erase: '30:4.5', label: 'underline 21:48' }));
    say(ty, 'T050', { x: 120, y: 380 });
    say(ty, 'T051', { x: 120, y: 300 });
    say(ty, 'T052', { x: 120, y: 620 });
    say(ty, 'T053', { x: 1290, y: 962, ax: 0.5, r: -3, z: 9 });
    // ---- A2 (31-33): 拍的是哪一面？ -> the AI chip on the chime -> 人海。 -> AI 在本机判断，照片不上传
    say(ty, 'T054', { x: 120, y: 205 });
    DM.sfx('31:3', 'chime', { gain: 0 });
    DM.ev('31:3', 'cut', 'AI chip on screen (product jump)', { sfx: 'none' });
    z0(DM.circle(sh, { on: ph, x: 320, y: 1607, rx: 285, ry: 78, at: '31:3.5', dur: beat * 0.6, color: 'pink', width: 10, label: 'circle AI 判断：人海', erase: '33:3' }));
    DM.pops(sh, [['sparkle', 'yellow', 1185, 600, 66], ['sparkle', 'pink', 1240, 420, 48], ['star', 'yellow', 1215, 790, 58, -10]], '31:3', beat / 4, { z: 12, gain: -9 });
    ph.punch('32:1', { s: 1.45, x: 322, y: 1610 }, { until: '33:1', sfx: 'none', label: 'punch x2.2 on the AI chip (the XXL slam carries the hit)' });
    {   // 31:4 the product's own chip 「✦ AI 判断：人海」 (CUT-04a: the same element, cut out of the build at the phone's DPR) lifts off the
        // screen as a big sticker; 32:1 it moves up to make room for 「人海。」; 33:1 it pops out
      const W = 500, P1 = [450, 470], P2 = [380, 175], t314 = Tc('31:4'), t321 = Tc('32:1');
      const chip = DM.sticker(sh, { src: 'CUT-04a', w: W, x: P1[0], y: P1[1], r: -4, z: 22, label: 'AI chip sticker' })
        .in('pop', '31:4', { sfx: 'pop', note: 5, label: 'AI chip lifts off the phone' }).out('pop', '33:1');
      chip.track(t => {
        const k = E.outBack(DM.clamp((t - t314) / 0.22), 1.4), m = E.outC(DM.clamp((t - t321) / 0.2));
        const [fx, fy] = ph.toWorld(t, 320, 1607); const s0 = 502 * (ph.sw0 / 1080) * ph.viewAt(t).s / W;
        return { x: (fx - P1[0]) * (1 - k) + (P2[0] - P1[0]) * m, y: (fy - P1[1]) * (1 - k) + (P2[1] - P1[1]) * m, s: DM.lerp(s0, 1, k) * (1 - 0.18 * m), r: 4 * (1 - k) + 2 * m };
      });
      DM.deco(sh, { kind: 'burstline', color: 'yellow', size: 170, x: P1[0] + 250, y: P1[1] - 70, r: 10, z: 21, lw: 1.3 }).in('pop', '31:4', { sfx: 'none', label: 'burst lines' }).out('pop', '32:1');
    }
    DM.burst(ty, { x: 330, y: 445, rOut: 255, rIn: 195, n: 18, color: 'yellow', spin: 18, z: 2 }).in('grow', '32:1', { dur: 0.16, log: false }).out('shrink', '32:4.5', { dur: 0.16 });
    say(ty, 'T055', { x: 125, y: 440, z: 6 });
    say(ty, 'T056', { x: 125, y: 750 }).move('33:1', Tc('33:1') + 0.22, { y: -235 }, E.outBack);
    say(ty, 'T057', { x: 120, y: 650 });
    DM.deco(ty, { kind: 'lock', color: 'ink', size: 92, x: 860, y: 650, r: 8, z: 7, lw: 1.2 }).in('pop', '33:2', { sfx: 'click', gain: -4, label: 'padlock' }).out('pop', '34:1');
    hlOn(sh, ph, { x: 600, y: 1712, w: 236, hgt: 44, color: 'mint', at: '33:1', dur: beat * 0.5, erase: '33:3', label: 'hl AI 在本机判' });
    hlOn(sh, ph, { x: 80, y: 1768, w: 384, hgt: 44, color: 'mint', at: '33:1.5', dur: beat * 0.5, erase: '33:3', label: 'hl 断，照片不上传' });
    // ---- A3 (33:3-35): the honest case
    say(ty, 'T058', { x: 120, y: 200 });
    z0(DM.circle(sh, { on: ph, x: 322, y: 1730, rx: 230, ry: 80, at: '33:3', dur: beat * 0.4, color: 'pink', width: 9, erase: '33:4', label: 'circle 舞台 · 示例照片' }));
    tapAt('33:3.5', 'tap 舞台 · 示例照片');
    DM.sfx('33:4', 'hmm', { gain: -2 });
    DM.ev('33:4', 'cut', '不确定，请选择 on screen (product jump)', { sfx: 'none' });
    z0(DM.circle(sh, { on: ph, x: 335, y: 1607, rx: 300, ry: 82, at: '34:1', dur: beat * 0.7, color: 'pink', width: 9, dash: [16, 13], erase: '34:3', label: 'dashed circle 不确定' }));
    ph.punch('34:1', { s: 1.35, x: 380, y: 1450 }, { until: '34:4', sfx: 'thump', gain: -4, label: 'punch: 不确定 + the dashed 舞台' });
    say(ty, 'T059', { x: 120, y: 425 });
    tapAt('34:3', 'tap 舞台');
    say(ty, 'T060', { x: 150, y: 645, r: -4 });
    z0(DM.check(sh, { on: ph, x: 300, y: 1205, size: 120, at: '34:3.5', color: 'mint', width: 10, label: 'check 舞台', sfx: 'pencil', erase: '35:1' }));
    // ---- A4 (35): save -> the wall panel
    say(ty, 'T061', { x: 120, y: 850 });
    tapAt('35:2', 'tap 保存这张照片');
    DM.ev('35:2', 'slide', 'wall panel', { sfx: 'whoosh', gain: -6 });
    z0(DM.underline(sh, { on: ph, x0: 90, x1: 870, y: 495, wavy: true, amp: 6, wl: 50, at: '35:3', dur: beat * 0.6, color: 'pink', width: 8, label: 'wavy 这一晚，大家看到了什么？' }));
    DM.pops(sh, [['star', 'pink', 1180, 260, 70, -12], ['sparkle', 'mint', 1735, 120, 52]], '35:4', beat / 2, { z: 12, gain: -9 });
  }

  // ============================================================================================== A3 · A4 · THE 3D WALL (L4) · 36:1 -> 37:1
  {
    const sh = DM.shot('A3-A4-wall', '36:1', '37:1', { drift: null, cam: [['36:1', { x: 0, y: 0, s: 1.0 }], ['37:1', { x: 0, y: -6, s: 1.03 }, E.ioSine]] });
    const ty = DM.shot('A3-A4-type', '36:1', '37:1', { paper: false, z: 30, drift: null, log: false });
    sh.pulse(['36:1', '36:3'], 0.012, 0.1);
    const Da = DM.clip('D-03a-wall-before'), Db = DM.clip('D-03b-wall-after');
    const feed = DM.seq(DM.play(Da, { at: '36:1', from: 0.5 }), '36:3', DM.play(Db, { at: '36:3', from: 0.5 }));
    const desk = DM.desk(sh, { media: feed, w: 1800, x: 960, y: 532, z: 4, srcW: 3840, srcH: 2160, label: 'desk 3D wall',
      view: [['36:1', { s: 1.3, x: 1900, y: 1010 }], ...cutKey('36:3', { s: 1.34, x: 1900, y: 1010 }, { s: 1.5, x: 1900, y: 905 }), ['37:1', { s: 1.58, x: 1910, y: 915 }, E.ioSine]] });
    desk.show('36:1');
    // your polaroid (sample-crowd, bottom right of the five; D-03b master px 1930-2170 x 1050-1350)
    z0(DM.circle(sh, { on: desk, x: 2050, y: 1200, rx: 170, ry: 205, tilt: -4, at: '36:3', dur: beat * 0.45, color: 'pink', width: 9, sfx: 'none', label: 'circle your polaroid' }));
    const star = DM.deco(sh, { kind: 'star', color: 'yellow', size: 120, x: 0, y: 0, z: 12 }).in('pop', '36:3', { sfx: 'pop', label: 'star: your polaroid' });
    star.track(t => { const [x, y] = desk.toWorld(t, 2235, 1035); return { x, y }; });
    DM.sfx('36:3', 'tape', { gain: -6 });
    DM.card(ty, { w: 420, hgt: 150, x: 1520, y: 860, r: 3, z: 5 }).in('slap', '36:3', { big: 1.15, spin: 5, sfx: 'none', log: false });
    say(ty, 'T062', { x: 1360, y: 858, r: -4, z: 8 });
    DM.arrow(ty, { from: [1420, 775], to: () => { const t = DM._lastT; const [x, y] = sh.toScreen(t, ...desk.toWorld(t, 1990, 1355)); return [x - 10, y + 18]; }, bend: -0.3, at: '36:4', dur: beat * 0.6, color: 'pink', width: 8, z: 9, label: 'arrow to the new polaroid' });
  }

  // ============================================================================================== A3 · A5 · THE RULE (L2) · 37:1 -> 41:1
  {
    const sh = DM.shot('A3-A5-phone', '37:1', '41:1', { drift: null, enter: { kind: 'slap', dur: 0.14, big: 1.08, spin: 2, sfx: 'slap' } });
    const ty = DM.shot('A3-A5-type', '37:1', '41:1', { paper: false, z: 30, drift: null, log: false });
    sh.pulse(bars(37, 40), 0.008, 0.1);
    const P08 = DM.clip('P-08');
    const feed = DM.play(P08, { at: '37:1', from: fr(150), rate: 0 });     // the first wall screen: 21:47 同一刻, the rule line, the badge
    const view = [
      ['37:1', { s: 1.4, x: 466, y: 925 }], ['38:1', { s: 1.43, x: 466, y: 935 }, E.ioSine], ['39:3', { s: 1.45, x: 468, y: 945 }, E.ioSine],
      ['40:1', { s: 1.3, x: 540, y: 1470 }, E.ioC], ['41:1', { s: 1.34, x: 540, y: 1480 }, E.ioSine],
    ];
    const ph = DM.phone(sh, { media: feed, x: 1452, y: 548, r: 2, w: 500, shadow: 'mint', z: 6, view, label: 'phone A5' });
    ph.show('37:1').drift('37:1', '41:1', { s: 1.025, y: -4 });
    DM.scrap(sh, { w: 690, hgt: 880, color: 'yellow', x: 1455, y: 560, r: 4, z: 1 }).show('37:1');
    // 37:3 21:47 underlined · 38:1 the rule lifts off · 38:3 highlighter over 相差不超过 3 分钟 · 39:3 down to the badge · 40:1 punch on it
    z0(DM.underline(sh, { on: ph, x0: 88, x1: 400, y: 884, at: '37:3', dur: beat * 0.5, color: 'yellow', width: 11, label: 'underline 21:47' }));
    // the real group header + rule (WALL-01: the same UI cut out at the phone's DPR; source box on P-08 f150 = x 76..863, y 744..1113)
    const LW = 760, LS = (LW - 44) / 787, LX = 1335, LY = 640, t381 = Tc('38:1'), t393 = Tc('39:3');
    // 37:2-37:3 three real cards of that group (the build's own wall cards: 小满·示例 21:48, yours 21:48 「AI 建议，未改动」, 北屿·示例 21:49)
    // slap onto the paper; 37:3.5-37:4 their shooting times get a highlighter; on the "and" of 4 they fly back into the phone (the group),
    // and on 38:1 the rule that grouped them lifts out of it
    const CW = 270, CH = Math.round(CW * 936 / 483), CK = CW / 483, t3745 = Tc('37:4.5');
    [['POL-03', 285, 650, -7], ['POL-04', 535, 628, 2], ['POL-05', 785, 655, 8]].forEach(([id, x, y, r], i) => {
      const c = DM.div(sh, { w: CW, hgt: CH, x, y, r, z: 14 + i, label: 'wall card ' + id,
        html: `<img decoding="sync" src="${DM.asset(id)}" style="width:${CW}px;height:${CH}px;display:block">` });
      c.in('slap', `37:${2 + i * 0.5}`, { big: 1.25, spin: i % 2 ? 8 : -8, sfx: 'slap', gain: -6, note: i * 2, label: 'wall card ' + id });
      z0(DM.highlight(sh, { parent: c, x: 46 * CK, y: 584 * CK, w: 228 * CK, hgt: 48 * CK, at: `37:${3.5 + i * 0.25}`, dur: beat * 0.3, color: 'yellow', opacity: 0.75, z: 3, label: 'hl time ' + id, gain: -6 }));
      const t0 = t3745 + i * 0.02, d = 0.2; c.t1 = t0 + d;
      c.track(t => { const k = E.inC(DM.clamp((t - t0) / d)); if (k <= 0) return null; const [tx, ty] = ph.toWorld(t, 470, 929);
        return { x: (tx - x) * k, y: (ty - y) * k, s: 1 - 0.8 * k, r: -r * k, o: 1 - k * k }; });
    });
    DM.ev('37:4.5', 'slide', 'the three cards fly into the phone', { sfx: 'swish', gain: -8 });
    const lift = DM.cutout(sh, { src: 'WALL-01.opaque', w: LW, hgt: 'auto', x: LX, y: LY, r: -3, z: 20, label: 'WALL-01 lifted' });
    lift.t0 = t381; lift.t1 = t393 + 0.12;
    lift.track(t => {
      const k = E.outBack(DM.clamp((t - t381) / 0.2), 1.5), back = E.inQ(DM.clamp((t - t393) / 0.12));
      const [fx, fy] = ph.toWorld(t, 470, 929); const kk = k * (1 - back);
      const s0 = 787 * (ph.sw0 / 1080) * ph.viewAt(t).s / (LW - 44);
      return { x: (fx - LX) * (1 - kk), y: (fy - LY) * (1 - kk), s: DM.lerp(s0, 1, kk), r: 3 * (1 - kk) };
    });
    DM.ev('38:1', 'slap', 'the rule block lifts off the phone', { sfx: 'slap', gain: -2 });
    DM.ev('39:3', 'slide', 'the rule block drops back', { sfx: 'swish', gain: -8 });
    z0(DM.highlight(sh, { parent: lift, x: 22 + 400 * LS, y: 22 + 249 * LS, w: 336 * LS, hgt: 52 * LS, at: '38:3', dur: beat * 0.6, color: 'yellow', opacity: 0.8, z: 3, label: 'hl 相差不超过 3 分钟' }));
    // 40:1 the badge card lifts out of the phone as a callout (CUT-05: the same element cut out at the phone's DPR; source box on
    // P-08 f150 = x 98..956, y 1188..1783); 40:2 its pill gets a pink circle; 40:3 the note's arrow points at it
    const BW = 740, BK = (BW - 44) / 858, BX = 585, BY = 650, t401 = Tc('40:1');
    const badge = DM.cutout(sh, { src: 'CUT-05.opaque', w: BW, hgt: 'auto', x: BX, y: BY, r: -3, z: 20, label: 'badge callout' });
    badge.t0 = t401;
    badge.track(t => { const k = E.outBack(DM.clamp((t - t401) / 0.22), 1.4); const [fx, fy] = ph.toWorld(t, 527, 1485);
      const s0 = 858 * (ph.sw0 / 1080) * ph.viewAt(t).s / (BW - 44);
      return { x: (fx - BX) * (1 - k), y: (fy - BY) * (1 - k), s: DM.lerp(s0, 1, k), r: 5 * (1 - k) }; });
    DM.ev('40:1', 'slap', 'the badge lifts out of the phone', { sfx: 'slap', gain: -2 });
    DM.ev('40:1', 'punch', 'badge callout', { sfx: 'thump', gain: -6 });
    z0(DM.circle(sh, { parent: badge, x: 22 + 224 * BK, y: 22 + 110 * BK, rx: 250 * BK, ry: 92 * BK, at: '40:2', dur: beat * 0.6, color: 'pink', width: 10, z: 5, label: 'circle 同一刻的另一面' }));
    say(ty, 'T063', { x: 120, y: 215 });
    say(ty, 'T065', { x: 120, y: 450 });
    say(ty, 'T064', { x: 120, y: 690 });
    say(ty, 'T066', { x: 532, y: 872, ax: 0.5, r: 6 });
    say(ty, 'T067', { x: 150, y: 235, r: -4 });
    DM.arrow(ty, { from: [430, 250], to: [598, 375], bend: -0.35, at: '40:3', dur: beat * 0.5, color: 'pink', width: 8, z: 9, label: 'arrow to the badge' });
    DM.pops(sh, [['sparkle', 'pink', 990, 330, 60], ['star', 'yellow', 1000, 880, 70, 10], ['sparkle', 'yellow', 170, 820, 52]], '40:2.5', beat / 2, { z: 22, gain: -9 });
  }
  DM.wipe('W-A3-A4', '40:4.5', '41:1', { colors: ['pink', 'yellow'] });
})();
