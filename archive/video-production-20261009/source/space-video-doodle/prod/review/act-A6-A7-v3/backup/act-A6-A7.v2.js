/* Music Space · Doodle video — ACT A6 WHY IT MATTERS (bars 73-82) + ACT A7 END CARD (bars 83-90, the end of the film).
 * Words: SCRIPT.md T120-T132 and T140-T146; every line through DM.say (text, font, recipe, entrance, in/out from the script).
 * Pictures and beats: STORYBOARD.md, with the owner's v2 changes (2026-10-07):
 *   V  73-76  (v2, replaces W1 + W2) THE VENUE: a Livehouse opens a room (H-01 主办方 / 开一个现场, 场地 「月台 Livehouse」), its own
 *             long-term community (H-02, the 3D header with the venue sign), the next show's preview published to the community
 *             (H-03 发布新的活动预告 -> 「活动预告 · 尚未开现场」 lifted out), the fans peek up; real footage from TAKE-H (capture/H1-host)
 *   W3 77-78  pillar stickers 隐私 / 同意 / 好玩 over real UI die-cuts (CUT-04c AI chip + hint, CUT-11 consent tick + send,
 *             CUT-12 World Cup VS card), each with its sub-line
 *   W4 79-80  曲终，人不散。 — the five who walked away in P3 (A1) come back from the sides, stand together, hop on the beats
 *   W5 81-82  the real desktop room (D-02 master, 4K) in a taped frame, framed on the 3D world (v2: the page header and the footer
 *             stay out); 「打开链接，」 / 「一人就能走完全程。」 on die cards; on 82:1 the five on stage get a pink loop
 *   C1 83-end end card: 同一刻，另一面。, MUSIC SPACE, the link, the QR (decodes to https://musicmapteam.github.io/musicSpace/),
 *             浏览器直接打开 · 无需安装, and ONE small credits line on a paper strip (T146: the cast and photos are fictional, the photos
 *             AI-generated, the music credit of the chosen map)
 * Everything is in storyboard bar:beat; the tempo map decides the seconds.  Elements of bars a map cuts drop out (tea-party: 81,
 * 89-90; flipping-in: 90); the end card lasts to DM.end() (grid + the map's tail or ring-out) and gets hops on '90+1' when a map
 * inserts that bar.  Honesty: the venue story says only what the build does (the host opens a room with a 场地, keeps a long-term
 * community, publishes the next show to its members, who still decide for themselves; no marketing push, no automatic entry, no
 * old photos); no TME logo or app picture; the privacy words are the product's own (AI 在本机判断，照片不上传 / 双方同意，才交换).
 * v2 (owner 「去掉那些说明性文字，这个产品必须是完整的」): no 「设想」 vision sheet, no AI-photo tag, no magnified 「示例站」 footer, no
 * end-card disclaimer block — one credits line only.
 *
 * Local primitives (kept here, not in dm/): hop() beat hops; spin() one turn; loopArrowPath() an arrow with one loop-the-loop;
 * stack() the W1 layer stack (reused small in W2); typedLink() the link pill typing on the beat grid (the library's TYPE logs its
 * type event 4 frames late); W1 accents per map (the break's own drum hits).  Library note: DM.circle / DM.check (and the other
 * stroke helpers that take x / y) also move their SVG layer by (x, y) when the numbers are plain, so this file draws its circle and
 * check with DM.stroke / Device.annotate and explicit path generators.
 */
(() => {
  const E = DM.E, clamp = DM.clamp;
  const beat = DM.beatS();
  const say = DM.say;
  const MAPID = (DM.map() && DM.map().id) || '';
  const ORIGINAL = /^original/.test(MAPID);

  // ---------------------------------------------------------------- local primitives
  /** hop on each time in `times`: half a sine `px` high over `dur` s, with a little squash */
  const hop = (node, times, px = 16, dur = beat * 0.8) => {
    const ts = times.map(DM.T).filter(x => x !== null).sort((a, b) => a - b);
    return node.track(t => { let last = null; for (const x of ts) if (x <= t + 1e-6) last = x; if (last === null) return null;
      const u = (t - last) / dur; if (u >= 1) return null; const k = Math.sin(u * Math.PI); return { y: -px * k, sy: 1 + 0.035 * k, sx: 1 - 0.025 * k }; });
  };
  /** one full turn of a node starting at `at` */
  const spin = (node, at, dur = beat * 0.75, turns = 1) => { const t0 = DM.T(at); if (t0 === null) return node;
    return node.track(t => { const u = clamp((t - t0) / dur); return u <= 0 ? null : { r: 360 * turns * E.ioC(u), s: 1 + 0.14 * Math.sin(u * Math.PI) }; }); };
  /** hand-drawn arrow from a to b with one loop-the-loop in the middle (a prolate cycloid on the a->b axis), head at b */
  const loopArrowPath = (a, b, r, o = {}) => {
    const R = o.loop ?? 60, side = o.side ?? 1, n = 72, w0 = o.w0 ?? 0.3, w1 = o.w1 ?? 0.7;
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, nx = -uy * side, ny = ux * side;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, w = clamp((u - w0) / (w1 - w0)), th = w * 2 * Math.PI, bow = Math.sin(u * Math.PI) * (o.bow ?? 0.12) * len;
      const f = len * u - R * Math.sin(th), s = R * (1 - Math.cos(th)) + bow;
      pts.push([a[0] + ux * f + nx * s, a[1] + uy * f + ny * s]);
    }
    const body = DM.paths.curve(pts, r, { jit: 2 });
    const p = pts[n - 5], ang = Math.atan2(b[1] - p[1], b[0] - p[0]), hs = o.head ?? 32;
    return body + ' ' + DM.paths.line([[b[0] - hs * Math.cos(ang - 0.5), b[1] - hs * Math.sin(ang - 0.5)], b, [b[0] - hs * Math.cos(ang + 0.5), b[1] - hs * Math.sin(ang + 0.5)]], r, { jit: 2 });
  };
  /** the W1 stack in a group's local space: ticket 「演出」, card 「散场」, the phone with the real first screen on top */
  const stack = (sh, o) => {
    const grp = DM.group(sh, { x: o.x, y: o.y, s: o.s ?? 1, z: o.z ?? 4, origin: [0, 0] });
    const tk = DM.ticket(sh, { parent: grp, text: '演出', sub: 'ADMIT ONE', w: 560, hgt: 250, x: -300, y: -120, r: -6, z: 1 });
    const cd = DM.card(sh, { parent: grp, w: 420, hgt: 210, x: -40, y: 110, r: 4, z: 2 });
    DM.title(sh, { parent: cd, text: '散场', recipe: 'ink-pink', size: 124, x: 205, y: 102, ax: 0.5, kind: 'label', boil: false });
    const ph = DM.phone(sh, { parent: grp, media: o.media, x: 330, y: -40, w: 360, r: 5, shadow: 'yellow', z: 4 });
    return { grp, tk, cd, ph };
  };
  /** the link pill (T143) popping on the beat and typing on 64ths from the same beat, complete before the QR lands (the library's
   *  TYPE logs its type event 4 frames after the beat; this one logs it on the beat: QC wants every event on the 16th grid) */
  const typedLink = (shot, id, o) => {
    const n = say(shot, id, Object.assign({}, o, { fx: 'POP' }));
    const t = DM.T(o.at ?? DM.line(id).start); if (t === null) return n;
    const chars = [...DM.line(id).text]; n.textEl.innerHTML = chars.map(c => `<span class="ch">${DM.esc(c)}</span>`).join('');
    const els = [...n.textEl.querySelectorAll('.ch')]; const step = o.step ?? beat / 16; const t0 = t + 2 / 60;
    n.typeT = t; n.inner = tt => { els.forEach((e, i) => { e.style.opacity = tt + 0.5 / 60 >= t0 + i * step ? '1' : '0'; }); };
    DM.ev(t, 'type', 'link', { shot: shot.id, dur: step * chars.length, note: chars.length, gain: o.typeGain });
    return n;
  };

  /** a magnifier strip: the frames of `feed` (a DM.play feed) cropped to the source rectangle src = [x, y, w, h] (source px of a
   *  srcW x srcH capture), drawn w px wide in a die-cut paper frame; every frame waits for its decode like the devices do */
  const loupe = (sh, o) => {
    const [sx, sy, sw, sH] = o.src, W = o.w, H = Math.round(W * sH / sw), pad = o.pad ?? 12, k = W / sw;
    const el = DM.h('div', 'die'); el.style.width = (W + 2 * pad + 16) + 'px'; el.style.height = (H + 2 * pad + 16) + 'px'; el.style.padding = pad + 'px';
    el.innerHTML = `<div class="cut"><img decoding="sync" style="position:absolute;display:block;max-width:none;left:${(-sx * k).toFixed(2)}px;top:${(-sy * k).toFixed(2)}px;width:${(o.srcW * k).toFixed(2)}px;height:${(o.srcH * k).toFixed(2)}px"></div>`;
    const n = DM.node(sh, el, Object.assign({ boil: { px: 0.3, deg: 0.06 } }, o)); const img = el.querySelector('img'); let last = null;
    n.label = o.label || 'loupe';
    n.inner = t => { const u = o.feed(t); if (u && u !== last) { last = u; img.src = u; DM.wait(img.decode().catch(() => DM.warn('loupe decode failed ' + u))); } };
    return n;
  };

  /** the QR as a seamless raster: the module rects of the vector QR (dm/assets/qr.svg, 10-unit modules + quiet zone) drawn one
   *  pixel per module on a canvas and shown with image-rendering:pixelated (one <rect> per module at a fractional scale leaves
   *  hairline seams between modules); runs before layout, deterministic */
  const qrRaster = img => { DM._preLayout.push(async () => {
    const svg = await (await fetch(DM.asset('qr'))).text(); const N = Math.round(+svg.match(/viewBox="0 0 (\d+)/)[1] / 10);
    const cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d');
    g.fillStyle = '#fffaf0'; g.fillRect(0, 0, N, N); g.fillStyle = '#1c1b1a';
    for (const m of svg.matchAll(/<rect x="(\d+)" y="(\d+)" width="10" height="10"\/>/g)) g.fillRect(+m[1] / 10, +m[2] / 10, 1, 1);
    img.src = cv.toDataURL('image/png'); await img.decode();
  }); };

  // the stop-time break 73-74: the accents sit on the break's own hits (Flipping In 119-120 = kick on 1/3, snare on 2/4; the same on
  // grab-a-partner's break; the original score = stop hits on 1, 2.5, 3.5)
  const W1 = ORIGINAL ? { hits: ['73:1', '73:2.5', '73:3.5', '74:1', '74:2.5', '74:3.5'], extra: [] }
                      : { hits: ['73:1', '73:2', '73:4', '74:1', '74:2', '74:4'], extra: ['73:3', '74:3'] };
  // ======================================================================= A6 · V · THE VENUE · 73:1 -> 77:1 (L2)   (v2, owner 2026-10-07)
  // The owner's positioning: the music community is the LIVEHOUSE's — a venue runs Music Space to keep its own local music community,
  // which gives it a reason to promote it to its audience.  Real host-side footage from TAKE-H (capture/H1-host, the filmed build):
  //   73:1  H-01 主办方 / 开一个现场: the 场地 field gets 「月台 Livehouse」 on 32nds (the 场次名称 「周五 · 月台夜」 is already in)
  //   73:3  the venue's community, H-02: its 3D header with the sign 「月台 Livehouse」 in a landscape die-cut window over the phone
  //         (the community's own 「1 位社群成员 · 不是在线人数」 chip stays out of the crop); hearts and notes pop on the drum-break hits
  //   75:1  H-03 SPACE · 发布新的活动预告 (周六 · 月台夜 · 月台 Livehouse · 10/17 20:00 · 下周六，还在月台见！) on the full band's return:
  //         75:2 the tick 「确认向本社群成员发布活动资料」, 75:3 发布活动预告 -> 「活动预告 · 尚未开现场」, 76:1 the card lifts out of the
  //         phone onto the paper, 76:3 the fans peek up under it
  // Words (SCRIPT.md T120-T125, changed 2026-10-07): 「Livehouse 开个房，」「乐迷留在【本地社群】。」「下一场的【预告】，」「直接发给社群。」
  // 「场地有了【自己的乐迷】，」「更愿意【推广】。」 — reading time >= 0.25 s per unit, <= 2 layered titles + 1 plain line, top-down order.
  // Product facts only: the host opens a room with a 场地; the community is the host's long-term space; the host publishes the next
  // show to its members (each member still decides to join); no marketing push, no automatic entry, no old photos.
  {
    const H = W1.hits;                                     // the drum break's own accents (flipping-in: 1, 2, 4 of 73 and 74)
    const RT = (60 / 123) / beat;                          // TAKE-H taps sit on a 123 BPM grid: play at RT so they stay on the beats
    const f2s = f => f / 60;
    const feedAt = (clip, at, anchor, f) => DM.play(clip, { at, from: Math.max(0, f2s(f) - (DM.Tc(anchor) - DM.Tc(at)) * RT), rate: RT });
    const H01 = DM.clip('H-01'), H02 = DM.clip('H-02'), H03 = DM.clip('H-03');
    const sh = DM.shot('A6-V-venue', '73:1', '77:1', { drift: { s: 1.025, x: -6, y: 2 }, focus: [1300, 540] });
    const ty = DM.shot('A6-V-type', '73:1', '77:1', { paper: false, z: 30, drift: null, log: false });
    sh.pulse(H, 0.016, 0.1);
    sh.pulse(['75:1', '75:3', '76:1', '76:3'], 0.012, 0.1);
    // the phone (L2, right): H-01 from its 场地 tap (f104 = the take's beat 1.5; typing from f108 = 73:1.25); H-02 behind the window; H-03 from its
    // beat 0 (f60, the form filled) on 75:1: tick on 75:2 (f95), publish on 75:3 (f125), the card from f126
    const media = DM.seq(
      feedAt(H01, '73:1', '73:1.25', 108),                // the first character of 「月台 Livehouse」 (f108) on 73:1.25
      '73:3', DM.ramp(H02, [['73:3', f2s(300)], ['75:1', f2s(410), E.lin]]),
      '75:1', feedAt(H03, '75:1', '75:1', 60));
    const view = [
      // (73:1: the bottom of the create sheet's header out of frame: the wardrobe's 「小人已保存」 toast from the take's setup is still
      // fading at the top of H-01 until f144)
      ['73:1', { s: 1.75, x: 400, y: 820 }], ['73:2.9', { s: 1.8, x: 400, y: 820 }, E.ioSine],
      ['73:3', { s: 1.2, x: 540, y: 600 }, E.step],
      ['75:1', { s: 1.55, x: 420, y: 1560 }, E.step], ['75:3', { s: 1.57, x: 420, y: 1556 }, E.ioSine],
      ['75:3.5', { s: 1.62, x: 450, y: 1180 }, E.outC], ['76:1', { s: 1.64, x: 450, y: 1170 }, E.ioSine],
    ];
    const ph = DM.phone(sh, { media, x: 1452, y: 548, r: 2, w: 500, shadow: 'yellow', z: 6, view, label: 'phone venue' });
    ph.in('slap', H[0], { big: 1.12, spin: -5, dy: -40, sfx: 'slap', label: 'phone: 主办方 / 开一个现场' });
    ph.drift('73:1', '77:1', { s: 1.02, y: -4 });
    // 73:3 the phone ducks out right under the community window; 75:1 it slaps back on the SPACE sheet with the full band
    ph.move(DM.Tc('73:3') - 0.1, '73:3', { x: 1150, r: 12 }, E.inC);
    ph.move('75:1', DM.Tc('75:1') + 0.22, { x: -1150, r: -12 }, E.outBack);
    ph.pulse(['75:1'], 0.035, 0.1);
    DM.scrap(sh, { w: 690, hgt: 880, color: 'yellow', x: 1440, y: 560, r: -5, z: 1 }).in('slap', H[0], { big: 1.1, spin: 6, sfx: 'none', log: false }).out('cut', '73:3');
    DM.scrap(sh, { w: 690, hgt: 880, color: 'pink', x: 1460, y: 560, r: 4, z: 1 }).in('slap', '75:1', { big: 1.12, spin: -6, sfx: 'slap', gain: -6, label: 'pink paper (the full band)' });
    // 73:1-73:3: the 场地 field (H-01 source px x 90..975, y 840..965) gets its pink underline on the break's second hit
    DM.ev('73:1', 'tap', 'tap 场地 (H-01)', { sfx: 'click', gain: -4 });
    DM.ev('73:1.25', 'type', 'typing 月台 Livehouse', { dur: beat * 12 / 8, note: 12, gain: -4 });
    ph.annotate({ gen: r => DM.paths.wave(110, 640, 990, r, { amp: 8, wl: 60 }), color: 'pink', width: 9, at: H[1], dur: beat * 0.6, erase: '73:3', edur: 0.05, label: 'wavy under 月台 Livehouse', sfx: 'squeak', gain: -6 });
    // 73:3-75:1: the community's 3D header in a landscape die-cut window over the phone (H-02 source px x 30..1045, y 205..620)
    const winFeed = DM.ramp(H02, [['73:3', f2s(300)], ['75:1', f2s(410), E.lin]]);
    const WW = 960, WX = 1355, WY = 548;
    const win = loupe(sh, { feed: winFeed, src: [30, 205, 1015, 415], srcW: 1080, srcH: 2340, w: WW, x: WX, y: WY, r: -2, z: 12, pad: 14, label: 'the venue community (3D)' });
    win.in('slap', '73:3', { big: 1.2, spin: -6, dy: -30, sfx: 'slap', gain: -2, label: 'window: 月台 Livehouse community' }).out('pop', '75:1');
    DM.tape(sh, { parent: win, x: 120, y: 2, r: -8, w: 190, color: 'm', z: 3 }).show('73:3');
    DM.tape(sh, { parent: win, x: WW - 90, y: 2, r: 7, w: 170, color: 'y', z: 3 }).show('73:3');
    // the venue sign in the window (source x 75..420, y 395..470 -> window-local px): a yellow loop on the break's third hit, the
    // camera punches onto it on the fourth
    const wk = WW / 1015, wl = (sx, sy) => [14 + (sx - 30) * wk, 14 + (sy - 205) * wk];
    { const [lx, ly] = wl(248, 432), H2 = 415 * wk + 28; sh.punch(H[3], { x: WX - WW / 2 - 14 + lx, y: WY - H2 / 2 + ly, s: 1.18, until: '74:3', sfx: 'thump', gain: -4, label: 'punch: the venue sign' }); }
    DM.stroke(sh, { parent: win, color: 'yellow', width: 14, at: H[2], dur: beat * 0.45, z: 6, label: 'loop 月台 Livehouse (sign)', sfx: 'squeak', gain: -8,
      gen: r => { const [cx, cy] = wl(248, 432); return DM.paths.loop(cx, cy, 190, 66, r, { tilt: -2, turns: 1.1, wob: 0.05 }); } });
    DM.pops(sh, [['heart', 'pink', 1020, 300, 76, -10], ['note', 'ink', 1840, 330, 66, 8]], H[4], beat / 4, { z: 14, gain: -9 }).forEach(n => n.out('pop', '75:1'));
    DM.pops(sh, [['note', 'mint', 1000, 820, 62, -6], ['heart', 'pink', 1830, 800, 70, 10], ['sparkle', 'yellow', 1700, 170, 54]], H[5], beat / 4, { z: 14, gain: -9 }).forEach(n => n.out('pop', '75:1'));
    if (W1.extra.length) DM.pops(sh, [['sparkle', 'pink', 980, 560, 52]], W1.extra[1], 0, { gain: -10, z: 14 }).forEach(n => n.out('pop', '75:1'));
    // 75:1: the full band is back — the window pops, the phone is on the SPACE sheet's 发布新的活动预告 (impact + shake)
    sh.shake('75:1', 9, 6); DM.sfx('75:1', 'impact', { gain: -5 });
    DM.ev('75:2', 'tap', 'tick 确认向本社群成员发布活动资料', { sfx: 'tick' });
    ph.annotate({ gen: r => DM.paths.curve([[46, 2034], [78, 2066], [132, 1990]], r, { jit: 3 }), color: 'mint', width: 12, at: '75:2', dur: beat * 0.35, erase: '75:3', edur: 0.04, label: 'check over the real tick', sfx: 'none' });
    DM.ev('75:3', 'tap', 'tap 发布活动预告', { gain: -2 });
    DM.ev('75:3', 'cut', 'the event card 「活动预告 · 尚未开现场」 (product)', { sfx: 'none' });
    // 76:1 the event card lifts out of the phone (a die-cut of the same frame: CUT-H3-space-after, source px x 41..1038, y 765..1415)
    {
      const CW = 820, crop = [41, 765, 997, 650], k = (CW - 32) / crop[2], P = [1345, 505], t0 = DM.Tc('76:1');
      const CH = Math.round(crop[3] * k) + 32;
      const el = DM.h('div', 'die'); el.style.width = CW + 'px'; el.style.height = CH + 'px'; el.style.padding = '8px';
      el.innerHTML = `<div class="cut"><img decoding="sync" src="${DM.asset('CUT-H3-space-after')}" style="position:absolute;display:block;max-width:none;left:${(-crop[0] * k).toFixed(1)}px;top:${(-crop[1] * k).toFixed(1)}px;width:${(1080 * k).toFixed(1)}px;height:${(2340 * k).toFixed(1)}px"></div>`;
      const card = DM.node(sh, el, { x: P[0], y: P[1], r: -3, z: 20, boil: { px: 0.4, deg: 0.12 }, label: 'event card lifted (活动预告 · 周六 · 月台夜)' });
      card.t0 = t0;
      card.track(t => {
        const u = E.outBack(clamp((t - t0 + 0.5 / 60) / 0.2), 1.4);
        const [fx, fy] = ph.toWorld(t, crop[0] + crop[2] / 2, crop[1] + crop[3] / 2); const s0 = crop[2] * (ph.sw0 / 1080) * ph.viewAt(t).s / (CW - 32);
        return { x: (fx - P[0]) * (1 - u), y: (fy - P[1]) * (1 - u), s: DM.lerp(s0, 1, u), r: 3 * (1 - u) };
      });
      DM.ev('76:1', 'slap', 'the event card lifts out of the phone', { sfx: 'slap', gain: -2 });
      DM.tape(sh, { parent: card, x: CW / 2, y: 0, r: -3, w: 220, color: 'y', z: 3 }).in('slap', '76:2', { big: 1.5, spin: 6, sfx: 'tape', gain: -4, label: 'tape on the card' });
      card.pulse(['76:3', '77:1'], 0.04, 0.1);
      // 76:3 the fans peek up under the card (the product's own avatars), 76:4 hearts
      [['avatar:man', 1080, -6], ['avatar:bei', 1230, 4], ['avatar:maichong', 1700, -3]].forEach(([src, x, r], i) =>
        DM.sticker(sh, { src, w: 136, x, y: 1110, ay: 1, z: 22 + i, r, label: 'fan ' + src }).in('slide', `76:${3 + i * 0.25}`, { dy: 330, dur: 0.24, ease: E.outBack, sfx: i ? 'none' : 'pop', gain: -8, label: 'a fan peeks up' }));
      DM.pops(sh, [['heart', 'pink', 1075, 300, 70, -8], ['heart', 'pink', 1770, 250, 62, 10], ['sparkle', 'yellow', 1840, 820, 52]], '76:4', beat / 4, { z: 24, gain: -9 });
    }
    // type (left column).  73-74: two lines; 75-76: 「下一场的预告，」 / 「直接发给社群。」 (a plain line) / 「场地有了自己的乐迷，」 /
    // 「更愿意推广。」 — the plain Marker line makes the third line allowed; when 「下一场的预告，」 leaves (76:2) the column keeps its order
    say(ty, 'T120', { x: 120, y: 175, until: '75:1', outFx: 'cut', text: 'Livehouse 开个房，' });
    say(ty, 'T121', { x: 120, y: 480, at: '73:3', until: '75:1', outFx: 'cut', size: 128, recipe: 'ink-mint', text: '乐迷留在\n【本地社群】。' });
    say(ty, 'T122', { x: 120, y: 175, at: '75:1', until: '76:2', outFx: 'cut', kind: 'title', font: 'display', size: 128, recipe: 'ink-yellow', fx: 'SLAM', text: '下一场的【预告】，' });
    say(ty, 'T123', { x: 128, y: 350, at: '75:3', until: '77:1', size: 84, recipe: 'ink', fx: 'TYPE', step: beat / 8, text: '直接发给社群。' });
    say(ty, 'T124', { x: 120, y: 600, at: '75:4', until: '77:1', size: 128, recipe: 'ink-pink', font: 'display', fx: 'SLAM', text: '场地有了\n【自己的乐迷】，' });
    const t125 = say(ty, 'T125', { x: 120, y: 880, at: '76:2', until: '77:1', size: 128, recipe: 'ink-mint', text: '更愿意【推广】。' });
    DM.stroke(ty, { color: 'yellow', width: 16, at: '76:3', dur: beat * 0.45, z: 1, sfx: 'squeak', gain: -8, label: 'ring 推广',
      gen: r => { const k = t125.keyRect(); return DM.paths.loop((k.x0 + k.x1) / 2, (k.y0 + k.y1) / 2, (k.x1 - k.x0) / 2 + 46, (k.y1 - k.y0) / 2 + 26, r, { tilt: -3, turns: 1.15 }); } });
  }

  // ======================================================================= A6 · W3 · 隐私 / 同意 / 好玩 · 77:1 -> 79:1 (L6)
  // the full band is back (FI 105): three pillar stickers on 1, 2, 3, each over a die-cut of the real UI it stands for; the pillar
  // only overlaps the die's paper margin, never the UI itself (the consent tick stays visible).
  {
    const sh = DM.shot('A6-W3-cards', '77:1', '79:1', { drift: { s: 1.025, y: 6 }, enter: { kind: 'slap', dur: 0.14, sfx: 'none' } });
    const ty = DM.shot('A6-W3-type', '77:1', '79:1', { paper: false, z: 30, drift: null, log: false, enter: { kind: 'slap', dur: 0.14, sfx: 'none' } });
    sh.pulse(['77:1', '77:2', '77:3', '78:1', '78:3'], 0.012);
    const cols = [
      // v2 (truth #6): the brief's / product's own privacy line 「AI 在本机判断，照片不上传」 instead of v1's 「AI 在本机 · 你决定给谁看」
      { at: '77:1', x: 400, sx: 424, src: 'CUT-04c.opaque', w: 500, r: -2.5, pillar: 'T126', sub: 'T126s', subY: 912, color: 'mint', pr: -4, ul: '78:1', text: 'AI 在本机判断，\n照片不上传', size: 50 },
      // T127s: the product's own words (「双方同意才交换」, the brief's 「双方同意，才交换」 = A4's T082/T083), not the table's 「双方点头」
      { at: '77:2', x: 960, sx: 960, src: 'CUT-11.opaque', w: 560, r: 2, pillar: 'T127', sub: 'T127s', subY: 748, color: 'pink', pr: 3, ul: '78:1.5', text: '双方同意，才交换' },
      { at: '77:3', x: 1520, sx: 1510, src: 'CUT-12.opaque', w: 480, r: -2, pillar: 'T128', sub: 'T128s', subY: 918, color: 'yellow', pr: -3, ul: '78:2' },
    ];
    cols.forEach((c, i) => {
      const cut = DM.cutout(sh, { src: c.src, w: c.w, hgt: 'auto', x: c.x, y: 345, ay: 0, r: c.r, z: 4 + i, label: c.src })
        .in('slap', c.at, { big: 1.25, spin: i % 2 ? -8 : 8, dy: -30, sfx: 'slap', note: i * 2 });
      DM.tape(sh, { parent: cut, x: c.w * 0.82, y: -4, r: 24 - 8 * i, w: 150, color: ['m', 'p', 'y'][i], z: 3 }).show(c.at);
      const pil = say(ty, c.pillar, { x: c.x - 8, y: 200, ax: 0.5, r: c.pr, z: 10 });
      const sub = say(ty, c.sub, Object.assign({ x: c.sx, y: c.subY, ax: 0.5, step: beat / 8, z: 10, typeSfx: i ? 'none' : undefined, align: 'center' }, c.text ? { text: c.text } : {}, c.size ? { size: c.size } : {}));
      DM.underline(ty, { x0: () => sub.keyRect().x0 + 4, x1: () => sub.keyRect().x1 - 4, y: () => sub.keyRect().y1 + 4, at: c.ul, dur: beat * 0.45, color: c.color, width: 9, z: 9, label: 'underline ' + c.sub, sfx: i ? 'none' : 'squeak' });
      cut.wiggle('78:3', '78:4.25', 2.2, 4); pil.wiggle('78:3', '78:4.25', 3.5, 4);
    });
    DM.pops(sh, [['lock', 'ink', 668, 318, 74, 10], ['check', 'mint', 1262, 700, 70, -6], ['heart', 'pink', 1790, 330, 64, 12]], '77:4', beat / 4, { gain: -8, z: 12 });
    DM.ev('78:3', 'pop', 'all three wiggle', { sfx: 'boop', gain: -8 });
    DM.pops(sh, [['sparkle', 'yellow', 790, 960, 54], ['star', 'pink', 1180, 900, 58, -8], ['sparkle', 'mint', 1850, 700, 52]], '78:3', beat / 4, { gain: -12, z: 12 });
  }
  DM.wipe('A6-X-W3-W4', '78:4.5', '79:1', { colors: ['pink', 'ink'] });

  // ======================================================================= A6 · W4 · 曲终，人不散。 · 79:1 -> 81:1 (L6)
  // callback to P3 (A1): the five who walked away come back from the sides on 8ths, stand together and hop on the beats.
  {
    const sh = DM.shot('A6-W4-stay', '79:1', '81:1', { drift: { s: 1.035, y: -6 }, focus: [890, 900] });
    const ty = DM.shot('A6-W4-type', '79:1', '81:1', { paper: false, z: 30, drift: null, log: false });
    sh.pulse(['79:1', '79:3', '80:1', '80:2', '80:3', '80:4'], 0.012);
    say(ty, 'T129', { x: 130, y: 220, sfx: 'boom', gain: -3 });   // v2: a warm boom while the bed ducks ~20 dB (film.js bed automation)
    say(ty, 'T130', { x: 1810, ax: 1, y: 438 });
    const cast = [['avatar:yao', 470, '阿遥'], ['avatar:man', 680, '小满'], ['avatar:you', 890, 'you'], ['avatar:bei', 1100, '北屿'], ['avatar:maichong', 1310, 'person']];
    // P3 sent them out: yao left, maichong right, man left, bei right; they come back in reverse order
    const back = { 3: ['79:1.5', 1100], 1: ['79:2', -1100], 4: ['79:2.5', 900], 0: ['79:3', -900] };
    cast.forEach(([src, x, nm], i) => {
      const st = DM.div(sh, { cls2: 'stand', w: 170, hgt: 38, x, y: 1006, z: 4, html: '' });
      st.el.style.cssText += ';border-radius:50%;background:var(--mint);border:5px solid var(--ink);box-shadow:5px 6px 0 var(--ink)';
      const a = DM.sticker(sh, { src, w: 175, x, y: 1000, ay: 1, z: 6, r: [-3, 2, 0, -2, 3][i], label: 'avatar ' + nm });
      if (back[i]) { const [at, dx] = back[i]; a.in('slide', at, { dx, dur: 0.3, dr: dx > 0 ? -12 : 12, ease: E.outBack, sfx: 'swish', gain: -6, label: 'comes back ' + nm }); const ta = DM.T(at); if (ta !== null) st.in('pop', ta + 0.2, { sfx: 'none', log: false }); else st.show(at); }
      else { a.in('pop', '79:1', { sfx: 'none', label: 'you' }); st.in('pop', '79:1', { sfx: 'none', log: false }); }
      hop(a, i % 2 ? ['80:2', '80:4'] : ['80:1', '80:3'], 24);
    });
    ['80:1', '80:2', '80:4'].forEach(at => DM.ev(at, 'bob', 'avatars hop', { sfx: 'none' }));
    DM.pops(sh, [['heart', 'pink', 575, 655, 72, -10], ['heart', 'pink', 995, 662, 84, 6]], '80:3', beat / 2, { z: 12, sfx: 'boop', gain: -4 });
    DM.pops(sh, [['sparkle', 'yellow', 785, 640, 50], ['heart', 'pink', 1205, 650, 64, 12]], '80:3.25', beat / 2, { z: 12, sfx: 'none' });
    DM.pops(sh, [['star', 'yellow', 1520, 840, 74, 8], ['note', 'ink', 300, 760, 62, -8], ['sparkle', 'pink', 1700, 960, 52]], '79:3.5', beat / 4, { z: 3, gain: -12 });
  }

  // ======================================================================= A6 · W5 · ONE PERSON, THE WHOLE ROUTE · 81:1 -> 83:1 (L4)
  // the real desktop room (D-02 master 4K, the overview hold: all five on stage), framed on the 3D world only (v2, owner 0b: the page
  // header 「回声现场 · 示例场 / 月台 Livehouse（虚构场地）」 and the footer 「示例站 · …」 stay out of frame; v1 circled and magnified
  // that footer); type on two die cards slapped on the beats; on 82:1 the five on stage get a pink loop, 82:2 a heart.
  {
    const sh = DM.shot('A6-W5-room', '81:1', '83:1', { drift: { s: 1.025, x: -6, y: 4 } });
    const ty = DM.shot('A6-W5-type', '81:1', '83:1', { paper: false, z: 30, drift: null, log: false });
    const feed = () => DM.play(DM.clip('D-02-room-hero'), { at: '81:1', from: 0.4 });
    // the stage of D-02 fills the frame (x2.3 around the five: master px x ~1000..2520, y ~660..1520): the room's title sign, side
    // panel and now-playing ticket stay out of frame
    const desk = DM.desk(sh, { media: feed(), w: 1240, x: 1250, y: 405, r: -1.2, z: 3, srcW: 3840, srcH: 2160,
      view: [['81:1', { s: 2.3, x: 1760, y: 1090 }], ['83:1', { s: 2.4, x: 1760, y: 1100 }, E.ioSine]] });
    desk.show(DM.Tc('81:1'));
    // the five on stage (D-02 master px, act-A2-A3 E4): 阿遥 1320, 小满 1507, 北屿 1716, 阿宁 1945, 林间 2145 (feet ~1400, heads ~900)
    desk.annotate({ gen: r => DM.paths.loop(1735, 1150, 560, 300, r, { tilt: -2, turns: 1.1 }), color: 'pink', width: 10, at: '82:1', dur: beat * 0.7, label: 'loop around the five on stage', sfx: 'squeak', gain: -6 });
    const heart = DM.deco(sh, { kind: 'heart', color: 'pink', size: 86, x: 0, y: 0, z: 9, r: -8 }).in('pop', '82:2', { sfx: 'boop', gain: -6, label: 'heart over the stage' });
    heart.track(t => { const [x, y] = desk.toWorld(t, 2350, 860); return { x, y }; });
    DM.pops(sh, [['sparkle', 'yellow', 1840, 120, 56], ['star', 'mint', 640, 120, 60, 10]], '82:3', beat / 2, { z: 9, gain: -10 });
    const cardA = DM.card(ty, { w: 600, hgt: 190, x: 100, y: 470, ax: 0, ay: 0, r: -1.5, z: 5 }).in('slap', '81:1', { big: 1.12, spin: -3, sfx: 'slap', label: 'die card 1' });
    say(ty, 'T131', { parent: cardA, x: 50, y: 95 });
    cardA.out('pop', '82:3');
    const cardB = DM.card(ty, { w: 800, hgt: 370, x: 80, y: 642, ax: 0, ay: 0, r: 1, z: 6 }).in('slap', '81:3', { big: 1.1, spin: 3, sfx: 'none', log: false });
    say(ty, 'T132', { parent: cardB, x: 52, y: 185, font: 'marker' });   // v2: Marker (Display 完 reads like 亮)
    DM.pops(ty, [['star', 'yellow', 840, 640, 64, 10]], '81:3.5', 0, { z: 8, gain: -12 });
  }
  DM.wipe('A6-X-W5-C1', '82:4.5', '83:1', { colors: ['mint', 'pink', 'yellow'], width: 360 });

  // ======================================================================= A7 · C1 · END CARD · 83:1 -> the end of the film (L6)
  {
    const END = DM.end();
    const sh = DM.shot('A7-C1-end', '83:1', END, { drift: { s: 1.02 } });
    const ty = DM.shot('A7-C1-type', '83:1', END, { paper: false, z: 30, drift: null, log: false });
    sh.pulse(['83:1', '83:2.5', '84:1', '84:2.5', '85:1'], 0.012);
    // every end-card line stays to the last frame of the film: the script's 91:1 is the end of the bar grid, and each map adds its
    // tail or ring-out after it (DM.end())
    say(ty, 'T140', { x: 120, y: 375, until: END });
    say(ty, 'T141', { x: 120, y: 645, until: END });
    const logo = say(ty, 'T142', { x: 452, y: 154, ax: 0.5, size: 112, r: -2, until: END });   // centre anchor: POP and wiggle pivot on the middle
    typedLink(ty, 'T143', { x: 1812, ax: 1, y: 158, size: 56, r: -2, until: END });
    // the product's ⇄ holds the QR's place while the title lands (同一刻，另一面。 = the swap): it pops with 另一面, spins with the
    // logo and shrinks away on 85:1 as the QR pops into the same spot
    const swc = DM.swap(sh, { x: 1500, y: 462, size: 300, z: 5 }).in('pop', '83:2.5', { sfx: 'none', label: '⇄ holds the QR spot' });
    spin(swc, '84:1', beat * 0.9); swc.out('shrink', '85:1', { dur: 0.1 });
    DM.pops(sh, [['sparkle', 'pink', 1690, 350, 54], ['star', 'yellow', 1330, 645, 60, -10]], '83:4', beat / 2, { z: 7, sfx: 'none' }).forEach(d => d.out('pop', '85:1'));   // gone before the QR lands: nothing ever covers the code
    // the QR: ink modules on paper-card, 4-module quiet zone; the paper card tilts -2.5 deg but the code inside is counter-rotated, so
    // the modules stay square to the camera (STORYBOARD §4 C1: tilt the paper, keep the code square), and the card does not jitter
    const qrc = DM.card(sh, { w: 456, hgt: 456, x: 1500, y: 462, r: -2.5, z: 6, boil: false,   // v2: 23 px higher (room for the 40 px fine print)
      html: `<img decoding="sync" src="${DM.asset('qr')}" style="position:absolute;left:19.5px;top:19.5px;width:407px;height:407px;display:block;image-rendering:pixelated;transform:rotate(2.5deg)">` });
    qrRaster(qrc.el.querySelector('img'));
    qrc.in('pop', '85:1', { big: 1.12, wob: 3, sfx: 'pop', label: 'QR' });
    DM.tape(sh, { parent: qrc, x: 228, y: -8, r: 3, w: 200, color: 'y', z: 3 }).in('slap', '85:1.5', { big: 1.5, sfx: 'tape', gain: -4 });
    say(ty, 'T144', { x: 1480, ax: 0.5, y: 750, until: END });
    // v2 (owner 2026-10-07 「去掉那些说明性文字，这个产品必须是完整的」): ONE small credits line instead of v1's fine-print block
    // (T145 「示例角色与照片为虚构…角色自动回复 · 数据只存在…」 is gone): T146 = the disclosure + the chosen map's music credit, on a
    // paper strip across the bottom (in front of the cast's legs: one line needs the whole width).  It types in from 86:1 (a map that
    // cuts the last bars starts it up to one bar earlier, so it keeps its reading time); width from the hand font's real advances
    // (printable ASCII in 1/100 em, measured from hand.ttf; everything else is 1 em)
    const credit = (DM.credit() || DM.line('T146').text).replace('（CC0 1.0 公共领域）', '（CC0）');
    const creditLine = '演示角色与照片为虚构，照片由 AI 生成 · ' + credit;
    const HAND_ASCII = [33,24,45,63,53,89,70,32,29,31,61,55,32,56,32,39,57,57,57,57,57,57,57,57,57,57,32,32,69,77,72,49,83,72,64,76,72,64,61,68,73,39,44,67,61,87,73,76,61,76,65,61,69,73,68,90,62,68,61,30,47,30,32,48,25,54,57,50,58,52,41,55,54,23,39,53,27,78,53,53,58,58,45,42,38,56,52,75,48,49,45,29,32,29,48];
    const handW = (str, px) => [...str].reduce((w, c) => { const k = c.charCodeAt(0); return w + (k >= 0x20 && k < 0x7f ? HAND_ASCII[k - 0x20] / 100 : 1) * px; }, 0);
    const FP = Math.min(36, Math.floor(36 * 1600 / handW(creditLine, 36)));      // one line, at most 1600 px wide
    const CW = Math.round(handW(creditLine, FP) + 76);
    const units = (creditLine.match(/[\u3400-\u9fff]/g) || []).length + (creditLine.replace(/[\u3400-\u9fff]/g, ' ').match(/[A-Za-z0-9.]+/g) || []).length;
    const room = DM.end() - DM.Tc('86:1'), need = 0.25 * units + 1.6;
    const t146 = room >= need ? '86:1' : room + beat * 2 >= need ? '85:3' : '85:1';
    DM.card(ty, { w: CW, hgt: Math.round(FP * 1.7), x: 960, y: 997, r: -0.5, z: 3, label: 'credits strip' }).in('slap', t146, { big: 1.06, spin: -1, sfx: 'tape', gain: -8, label: 'credits strip' });
    say(ty, 'T146', { x: 960, ax: 0.5, ay: 0.5, y: 997, size: FP, align: 'center', at: t146, until: END, step: beat / 16, typeSfx: 'none', z: 4, text: creditLine });
    DM.mark('qr', '86:1');
    // the five peek from the bottom edge and slide up on 8ths, then hop; a heart on the biggest hit.
    // v2 (rhythm #7: v1's end card was the stillest picture while the band still played at full level): the cast hops on EVERY beat
    // from 86:1 (two groups, 1-3 / 2-4), the logo bounces on the downbeats, sparkles on the backbeats; on flipping-in-b the drum
    // break's hits (87:3 87:4 88:2 88:3) and the band's last hits (89:1.5, 89:4.5, half a beat into the tail) carry the accents
    const FIB = /^flipping-in-b/.test(MAPID);
    const cast = [['avatar:yao', 175], ['avatar:man', 345], ['avatar:you', 515], ['avatar:bei', 685], ['avatar:maichong', 855]];
    const hopsA = FIB ? ['86:1', '86:3', '87:1', '87:3', '88:2', '89:1.5'] : ['86:1', '86:3', '87:1', '87:3', '88:1', '88:3', '89:1', '89:3', '90:1', '90:3', '90+1:1'];
    const hopsB = FIB ? ['86:2', '86:4', '87:2', '87:4', '88:3', '89:4.5'] : ['86:2', '86:4', '87:2', '87:4', '88:2', '88:4', '89:2', '89:4', '90:2', '90:4', '90+1:3'];
    if (FIB) { const tHit = DM.gridEnd() + beat / 2; if (tHit < END - 0.15) { hopsA.push(tHit); hopsB.push(tHit); } }   // the band's final hit: all five together
    else for (let k = 1, g = DM.gridEnd(); g + k * beat < END - 0.12; k++) (k % 2 ? hopsA : hopsB).push(g + k * beat);   // the tail / ring-out
    cast.forEach(([src, x], i) => {
      const a = DM.sticker(sh, { src, w: 176, x, y: 1185, ay: 1, z: 5, r: [-4, 3, 0, -3, 4][i], label: 'avatar' });
      a.in('slide', `85:${3 + i * 0.5}`, { dy: 420, dur: 0.32, ease: E.outBack, sfx: i % 2 ? 'none' : 'pop', gain: -8, note: i * 2, label: 'avatar peeks' });
      hop(a, i % 2 ? hopsB : hopsA, 18);
    });
    [...hopsA, ...hopsB].forEach(at => DM.ev(at, 'bob', 'avatars hop', { sfx: 'none' }));
    DM.pops(sh, [['heart', 'pink', 985, 770, 84, -6]], FIB ? '88:3' : '88:1', 0, { z: 9, sfx: 'boop', gain: -6 });
    const wig = FIB ? '89:1.5' : '89:1';
    logo.wiggle(wig, DM.Tc(wig) + beat * 1.5, 4, 4); DM.ev(wig, 'pop', 'logo wiggle', { sfx: 'none' });
    logo.pulse(['85:1', '86:1', '87:1', '88:1', ...(FIB ? ['89:4.5'] : ['89:1'])], 0.07, 0.12);
    // sparkles on the backbeats of the full-band bars, and on the band's last hits
    [['85:2', 1880, 640], ['85:4', 1075, 560], ['86:2', 1870, 300], ['86:4', 1100, 760]].forEach(([at, x, y], i) =>
      DM.pops(sh, [[i % 2 ? 'star' : 'sparkle', ['pink', 'yellow', 'mint', 'pink'][i], x, y, 46 + (i % 2) * 8, i * 7]], at, 0, { z: 8, sfx: 'none' }).forEach(d => d.out('pop', DM.Tc(at) + beat * 1.5)));
    if (FIB) {
      DM.pops(sh, [['star', 'yellow', 1120, 300, 70, -8], ['sparkle', 'pink', 1880, 760, 60]], '89:4.5', beat / 4, { z: 9, sfx: 'sparkle', gain: -8 });
      const tHit = DM.gridEnd() + beat / 2;
      if (tHit < END - 0.15) DM.pops(sh, [['heart', 'pink', 1050, 640, 70, 8], ['sparkle', 'mint', 1885, 470, 56], ['star', 'pink', 1180, 880, 54, 10]], tHit, 0, { z: 9, sfx: 'none' });   // together, on the hit (QC grid)
    }
    DM.pops(sh, [['star', 'yellow', 1070, 330, 84, -8], ['sparkle', 'pink', 1130, 610, 58], ['sparkle', 'mint', 905, 225, 46]], '84:3', beat / 2, { z: 8, gain: -12 });
    // twinkles: three small stars scale-pulse every other beat through the hold (no sound)
    [['sparkle', 'yellow', 1110, 885, 44], ['star', 'mint', 1855, 560, 46, 10], ['sparkle', 'pink', 1045, 470, 40]].forEach(([k, c, x, y, z, r], i) => {
      const d = DM.deco(sh, { kind: k, color: c, size: z, x, y, r: r || 0, z: 8 }).in('pop', `86:${2 + i}`, { sfx: 'none', label: 'twinkle' });
      d.pulse(['87:2', '88:2', '89:2', '90:2', '90+1:2'].map(p => p.replace(':2', ':' + (2 + i % 2 * 2))), 0.35, 0.16);
    });
    // stars twinkle on 90:1 (and on the inserted bar when a map has one)
    for (const at of ['90:1', '90+1:2']) DM.pops(sh, [['sparkle', 'yellow', 1840, 720, 52], ['star', 'pink', 1020, 690, 54, 10]], at, beat / 2, { z: 9, sfx: 'none' });
  }
})();
