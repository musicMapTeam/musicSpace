/* Music Space · Doodle video — ACT A4 SAME MOMENT + EXCHANGE 同一刻与交换 (storyboard bars 41-54).
 * Words: SCRIPT.md T070-T087 (DM.say: text, font, size, recipe, entrance and in/out from script/out/timeline.json).
 * Pictures and beats: STORYBOARD.md M1 (the two polaroids collide), M2 (the real badge 「同一刻的另一面」), M3 (exchange compose),
 * M4 (consent + send), M5 (the wait 「等待本人回应」), M6 (PAYOFF 「交换已接受」 on 51:1), M7 (revoke, then 「然后呢？」).
 * Footage: TAKE-P1 clips P-09 (badge -> tap -> compose -> scroll -> tick -> send), P-10 (the real wait) and P-11 (accepted), one
 * continuous example world.  The capture's taps sit on a 123 BPM grid; the feed below pins every tap / state change to its storyboard
 * beat (DM.ramp), so they land on the beat under any tempo map.  The static 「等待本人回应」 screen is held until 51:1 (no UI is faked).
 * The phone is drawn large (600 px, full UI width always visible) and framed by moving it on the beats; punch-ins are camera punches,
 * so the UI is never cropped mid-line.
 * Paper polaroids use the build's own photos (dist-pages/demo/sample-crowd.jpg = yours, 21:48; yao-stage.jpg = 阿遥·示例, 21:47): AI-
 * generated example images; since v2 (owner 0b) the disclosure is the end card's one credits line, not a tag on every frame.
 * Elastic: maps that insert a bar after 54 ('54+1': grab-a-partner, consternation) get STORYBOARD §5 +3 on the inserted bar — the 3D
 * wall with both photos circled and a pink ⇄ slaps in under the 「然后呢？」 card, which shrinks to the corner; no bar of 41-54 is cut by
 * any map.
 * Local primitives (not in dm/): clockSticker (ticking hand), squash (squash-and-hold), wpt (source px -> screen px through two layers),
 * confettiBurst (art-directed payoff confetti: each doodle tossed from behind the phone onto a chosen free spot, settles, twinkles).
 */
(() => {
  const E = DM.E, lerp = DM.lerp, clamp = DM.clamp, say = DM.say, Tc = DM.Tc;
  const beat = DM.beatS();
  const F = 1 / 60;
  const L = E.lin;
  const sf = n => n / 60;                                         // capture frame -> source second (60 fps clips)
  const INS = DM.has('54+1:1');                                   // map inserts a bar after 54
  const K = v => () => v;
  const jumpAt = pos => Tc(pos) - 0.5 / 60 - 0.001;   // (v2) a line that re-slots on a downbeat jumps there on that frame (no crossing)
  const z0 = n => { n.x = 0; n.y = 0; return n; };   // stroke helpers with numeric x/y: keep the node at 0,0 (see act-A2-A3.js)   // stroke coordinates as functions: DM.circle/underline/check also use numeric x/y as the node position (double offset)

  // ------------------------------------------------------------------------------------------------ the phone feed (one take)
  // P-09: f0-61 badge view (wall scrolled to the badge) · f62 finger down / f65 click 「和 TA 交换这个视角」 -> compose · f182-211 the
  // product scrolls to the reason card · f299-322 scrolls to the consent · f328 tick · f358 send -> 「等待本人回应」.  P-10 f73 = the same
  // send frame + the real wait.  P-11 f207 = the first frame of 「交换已接受」 (the sticker fades in, the polaroids drop in by ~f232).
  const P09 = DM.clip('P-09'), P10 = DM.clip('P-10'), P11 = DM.clip('P-11');
  const t45 = Tc('45:1'), t473 = Tc('47:3'), t51 = Tc('51:1');
  const feedWall = DM.ramp(P09, [['43:1', sf(0), L], [t45 - 3 * F, sf(62), L], ['45:1', sf(65), L], ['46:1', sf(182), L], ['47:1', sf(299), L],
    ['47:2', sf(328), L], ['47:3', sf(358), L]]);
  // measured with ffmpeg (0-based n): the first accepted frame is P-10 n=304 and P-11 n=206 (the manifest's sync says 305 / 207), so the
  // wait ends on n=302 (no accepted frame can leak before the cut) and the payoff starts on n=209, where the product's own sticker is
  // already half in: it completes its pop within 3 frames of the downbeat, together with the punch.
  const feedWait = DM.ramp(P10, [['47:3', sf(73), L], [t473 + 0.6, sf(109), L], [t51 - F, sf(302), L]]);
  const feedDone = DM.play(P11, { at: '51:1', from: sf(209) });
  const FEED = DM.seq(feedWall, '47:3', feedWait, '51:1', feedDone);
  // source px of the UI (1080 x 2340 capture), measured on the frames (review/act-A4/geo)
  const UI = {
    badgePill: [328, 955], badgeCard: [526, 1150], reason2: [290, 1182], offerBtn: [532, 1333],      // wall, scrolled to the badge
    pair: [544, 730], decide: [433, 960, 1543],                                                         // compose (decide line after scroll 1)
    tick: [84, 1767], send: [540, 2170],                                                                // after scroll 2
    status: [255, 354], pairWait: [544, 870],                                                           // pending
    sticker: [550, 433], pairDone: [544, 990], revoke: [541, 1644], fine: [540, 1815],                  // accepted
  };
  // phone 600 wide: screen 540 x 1170 at 0.5 px per source px, body 600 x 1236.  World y of a source y = PY - 585 + sy / 2.
  const PX = 1480;
  const PY = { badge: 550, top: 668, consent: 350, revoke: 300 };
  const phone = (sh, o = {}) => DM.phone(sh, Object.assign({ media: FEED, w: 600, x: PX, y: PY.top, r: 1.5, shadow: 'pink', z: 10, label: 'phone exchange' }, o));
  /** screen px of a source pixel on a phone (through its shot's camera) at time t */
  const wpt = (sh, ph, sx, sy, t) => { const tt = t ?? DM._lastT ?? 0; return sh.toScreen(tt, ...ph.toWorld(tt, sx, sy)); };

  // ------------------------------------------------------------------------------------------------ local primitives
  /** squash on `at` (2 frames down, 6 frames back), then hold — STORYBOARD M5 50:4 */
  const squash = (node, at, k = 1) => { const t0 = Tc(at); node.track(t => { const u = (t - t0) * 60; if (u < -0.01 || u > 9) return null;
    const e = u < 2 ? u / 2 : Math.max(0, 1 - (u - 2) / 6); return { sx: 1 + 0.06 * e * k, sy: 1 - 0.09 * e * k }; }); return node; };
  /** clock sticker: yellow face, ink ring + hard shadow, the pink hand jumps 30 deg on every tick time (small overshoot) */
  const clockSticker = (shot, o) => {
    const el = DM.h('div'); const S = o.size || 150;
    let marks = ''; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, r0 = i % 3 ? 40 : 36; marks += `<line x1="${(60 + Math.cos(a) * r0).toFixed(1)}" y1="${(60 + Math.sin(a) * r0).toFixed(1)}" x2="${(60 + Math.cos(a) * 45).toFixed(1)}" y2="${(60 + Math.sin(a) * 45).toFixed(1)}" stroke="#1c1b1a" stroke-width="${i % 3 ? 3 : 5}" stroke-linecap="round"/>`; }
    el.innerHTML = `<svg viewBox="0 0 120 120" width="${S}" height="${S}" style="display:block;overflow:visible">`
      + `<path d="M40 9 L47 1 M80 9 L73 1" stroke="#1c1b1a" stroke-width="7" stroke-linecap="round"/>`
      + `<circle cx="67" cy="68" r="52" fill="#1c1b1a"/><circle cx="60" cy="60" r="52" fill="var(--yellow)" stroke="#1c1b1a" stroke-width="6"/>${marks}`
      + `<line class="hh" x1="60" y1="60" x2="60" y2="35" stroke="#1c1b1a" stroke-width="8" stroke-linecap="round"/>`
      + `<line class="hm" x1="60" y1="60" x2="60" y2="21" stroke="var(--pink)" stroke-width="7" stroke-linecap="round"/><circle cx="60" cy="60" r="7" fill="#1c1b1a"/></svg>`;
    const n = new DM.Node(shot, el, Object.assign({ boil: { px: 0.8, deg: 1.2 }, layer: 18 }, o));
    const hm = el.querySelector('.hm'), hh = el.querySelector('.hh'); const ticks = (o.ticks || []).map(DM.T).filter(x => x !== null).sort((a, b) => a - b);
    n.label = 'clock';
    n.inner = t => { let k = 0, last = -1e9; for (const x of ticks) if (x <= t + 0.5 * F) { k++; last = x; }
      const u = (t - last) * 60; const over = u < 6 ? 10 * Math.sin(u / 6 * Math.PI) : 0;
      hm.setAttribute('transform', `rotate(${(k * 30 + over).toFixed(2)} 60 60)`); hh.setAttribute('transform', `rotate(${(90 + k * 2.5).toFixed(2)} 60 60)`); };
    return n;
  };
  /** payoff confetti, art-directed (STORYBOARD §1.4: 12-16 doodles burst from behind the phone on 51:1, settle by 52:3, then twinkle).
   *  DM.confetti is ballistic and lands at random (behind the phone or on the words); here every piece is tossed from `from` (behind the
   *  phone) along an arc onto a chosen free spot of the composition, floats down onto it by `settle`, and twinkles on `twinkle`.
   *  pieces: [kind, colour, size, x, y, rot] in shot px. */
  const confettiBurst = (shot, o) => {
    const t0 = DM.T(o.at); if (t0 === null) return [];
    const tSet = Tc(o.settle), tw = (o.twinkle || []).map(DM.T).filter(x => x !== null).sort((a, b) => a - b), [ox, oy] = o.from;
    const out = o.pieces.map(([kind, color, size, x, y, rot = 0], i) => {
      const R = DM.rng(DM.hash(o.id, i));
      const fly = lerp(0.3, 0.48, R()), arc = lerp(70, 190, R()), spin = (R() < 0.5 ? -1 : 1) * lerp(260, 620, R());
      const sink = lerp(12, 30, R()), sway = lerp(5, 12, R()), ph = R() * 6.283;
      const d = DM.deco(shot, { kind, color, size, x, y, r: rot, z: o.z ?? 8, id: `${o.id}-${i}` });
      d.t0 = t0;
      d.track(t => {
        const u = t - t0 + 0.5 * F; if (u < 0) return null;
        const e = 1 - Math.pow(1 - Math.min(1, u / fly), 3), w = E.ioSine(clamp((t - t0 - fly) / Math.max(0.1, tSet - t0 - fly)));
        let s = 0.55 + 0.45 * e; let last = null; for (const q of tw) if (q <= t + 0.5 * F) last = q;
        if (last !== null) s *= 1 + 0.24 * Math.exp(-(t - last) / 0.1);
        return { x: (ox - x) * (1 - e) + sway * Math.sin(u * 5 + ph) * (1 - w) * e,
          y: (oy - y + sink) * (1 - e) - arc * Math.sin(Math.PI * e) - sink * (1 - w),
          r: spin * (1 - e) + 7 * Math.sin(u * 4 + ph) * (1 - w) * e, s };
      });
      if (o.until !== undefined) d.out('pop', o.until);
      return d;
    });
    DM.ev(t0, 'confetti', o.label || 'confetti', { sfx: o.sfx ?? 'none', gain: o.gain, shot: shot.id });
    return out;
  };

  // (v2, owner 2026-10-07 「去掉那些说明性文字，这个产品必须是完整的」: v1's fixed 「照片为 AI 生成的示例图」 line over this act is
  // gone; the end card's one credits line carries the disclosure)

  // ================================================================================================ M1 · 41:1 -> 43:1 · L6
  // the key frame of the film: yours (人海) and 阿遥's (舞台) slam in from both sides and collide on 41:1, bounce apart on 41:3 with
  // the ⇄ sticker between them; the two capture times stamp on (42:1, 42:2) and the bracket says 「不到 1 分钟」 (42:3).  Whip on 42:4.5.
  {
    const cam = [['41:1', { x: 0, y: 0, s: 1 }], ['42:4.5', { x: -30, y: 0, s: 1.025 }, E.ioSine], ['43:1', { x: -1500, y: 0, s: 1.05 }, E.inExpo]];
    const camT = [['41:1', { x: 0 }], ['42:4.5', { x: 0 }], ['43:1', { x: -1500 }, E.inExpo]];
    const blur = [['42:4.5', 0], ['42:4.75', 12], ['43:1', 60, E.inQ]];
    const sh = DM.shot('M1-collide', '41:1', '43:1', { drift: null, cam, blur });
    const ty = DM.shot('M1-type', '41:1', '43:1', { paper: false, z: 30, drift: null, log: false, cam: camT, blur });
    sh.pulse(['41:3', '42:1', '42:2', '42:3', '42:4'], 0.01, 0.1);
    sh.shake('41:1', 16, 7);
    const tHit = Tc('41:1'), tSep = Tc('41:3');
    const W = 560, H = 412;
    const REST = { you: [500, 650, -5], ta: [1405, 690, 4] }, HIT = { you: [780, 650, -11], ta: [1142, 668, 9] };
    // v2: no starburst here (it is kept for the three biggest hits, 5:1 / 21:1 / 51:1; review art #4): ink burst lines on the hit,
    // then a fat yellow marker ring scribbled around the ⇄ when the photos bounce apart
    DM.deco(sh, { kind: 'burstline', color: 'ink', size: 380, x: 962, y: 670, z: 3, lw: 1.5 }).in('pop', tHit, { log: false }).out('pop', '41:2.5');
    z0(DM.circle(sh, { x: 958, y: 682, rx: 150, ry: 136, tilt: -6, turns: 1.25, at: '41:3.25', dur: beat * 0.45, color: 'yellow', width: 26, z: 4, sfx: 'squeak', gain: -8, label: 'ring around ⇄' }));
    // the two polaroids (the build's own sample photos; captions use the product's names)
    const you = DM.polaroid(sh, { src: 'photo:sample-crowd', w: W, hgt: H, cap: '阿宁 · 人海', x: HIT.you[0], y: HIT.you[1], r: HIT.you[2], z: 6, tape: 'm', tapeW: 170, label: 'yours 人海', pos: '50% 42%' });
    const ta = DM.polaroid(sh, { src: 'photo:yao-stage', w: W, hgt: H, cap: '阿遥 · 舞台', x: HIT.ta[0], y: HIT.ta[1], r: HIT.ta[2], z: 5, tape: 'p', tapeW: 170, label: '阿遥 舞台', pos: '50% 60%' });
    you.in('slide', tHit - 5 * F, { dx: -1500, dur: 5 * F, dr: -14, ease: E.inQ, log: false });
    ta.in('slide', tHit - 5 * F, { dx: 1500, dur: 5 * F, dr: 14, ease: E.inQ, log: false });
    const recoil = dir => t => { const u = t - tHit; if (u < 0 || u > 0.7) return null; const k = Math.exp(-u / 0.06);
      return { x: -dir * 44 * Math.sin(u * 26) * Math.exp(-u / 0.15), r: -dir * 3 * Math.sin(u * 26) * Math.exp(-u / 0.15), sx: 1 - 0.09 * k, sy: 1 + 0.07 * k }; };
    you.track(recoil(1)); ta.track(recoil(-1));
    // pressed together until 41:3: a nervous jitter on the 16ths
    const press = dir => t => { if (t < tHit + 0.2 || t >= tSep) return null; const k = Math.floor((t - tHit) / (beat / 4)); return { x: dir * 4 * DM.sr('press', dir, k), r: 0.6 * DM.sr('pr', dir, k) }; };
    you.track(press(1)); ta.track(press(-1));
    you.move(tSep, tSep + 0.34, { x: REST.you[0] - HIT.you[0], y: REST.you[1] - HIT.you[1], r: REST.you[2] - HIT.you[2] }, E.outBack);
    ta.move(tSep, tSep + 0.34, { x: REST.ta[0] - HIT.ta[0], y: REST.ta[1] - HIT.ta[1], r: REST.ta[2] - HIT.ta[2] }, E.outBack);
    DM.ev('41:1', 'slap', 'the two polaroids collide', { sfx: 'boom', gain: -3 });
    DM.sfx('41:1', 'slap', { gain: 0 });
    DM.ev('41:3', 'slide', 'they bounce apart', { sfx: 'swish', gain: -8 });
    // ⇄ between them
    DM.swap(sh, { x: 958, y: 680, size: 176, z: 12 }).in('spring', '41:3', { sfx: 'zip', gain: -2, label: '⇄ pops' }).wiggle('41:3.5', '42:1', 7, 4);
    DM.pops(sh, [['sparkle', 'pink', 960, 470, 66], ['star', 'mint', 1030, 880, 60, 12], ['sparkle', 'yellow', 880, 870, 50], ['plus', 'pink', 1840, 160, 52]], '41:3.5', beat / 4, { z: 13, gain: -10 });
    // v2: the photos' real capture times to the second (sample-crowd EXIF 21:48:10, 阿遥·示例's takenAt 21:47:20: 50 s apart, so
    // 「不到 1 分钟」 reads right at first glance; truth #4), printed like a camera date in each photo's corner on 41:4 / 41:4.5; the
    // bracket and 「不到 1 分钟」 on 42:1 (1.7 s before the whip; v1 0.5 s, read #7)
    const stampTime = (pol, text, at, r) => DM.title(sh, { parent: pol, text: `【${text}】`, recipe: 'digits', size: 64, x: W - 34, y: H - 74 - 48, ax: 1, r, at, fx: 'STAMP', kind: 'label', z: 9, label: 'time ' + text,
      hlTop: 0.1, hlH: 0.86 });   // the yellow band behind the whole height: ink digits never sit on the dark photo
    stampTime(you, '21:48:10', '41:4', -2);
    stampTime(ta, '21:47:20', '41:4.5', 2);
    DM.stroke(sh, { color: 'ink', width: 7, at: '42:1', dur: beat * 0.6, z: 4, label: 'bracket 21:48:10-21:47:20', sfx: 'squeak',
      gen: r => DM.paths.line([[668, 902], [672, 976], [1572, 976], [1576, 944]], r, { jit: 3 }) });
    say(ty, 'T072', { x: 1122, y: 976, ax: 0.5, at: '42:1' });
    // type layer
    say(ty, 'T070', { x: 110, y: 232, sfx: 'none' });   // box top >= 54 (the 1.4x key makes the line box 350 px tall)
    say(ty, 'T071', { x: 1812, y: 352, ax: 1 });
    DM.ev('42:4.5', 'slide', 'paper pans on', { sfx: 'whoosh', gain: -4 });
  }

  // ================================================================================================ M2-M5 · 43:1 -> 51:1 · L2
  // one phone for the whole request (the screen is one take): the badge (43-44), tap -> compose (45:1), camera punch on the pair (45:3),
  // the product scrolls to the reason (46:1), mint swipe over 「要不要交换，仍由你和对方决定。」 (46:3), consent (47:1), tick (47:2),
  // send (47:3) -> 「等待本人回应」 (punch 48:1, clock 48:3), the wait with a heartbeat (49-50), dots (50:2.5-50:3.5), squash + hold (50:4).
  let shR, phR;
  {
    const enter = { kind: 'slide', dx: 700, dur: 0.14, sfx: 'none' };
    const sh = shR = DM.shot('M2-M5-request', '43:1', '51:1', { drift: null, enter, cam: [
      ['43:1', { x: 0, y: 0, s: 1 }], ['44:1', { x: -4, y: 0, s: 1.015 }, E.ioSine], ['45:1', { x: -44, y: 26, s: 1.1 }, E.ioQ], ['45:1', { x: 0, y: 0, s: 1 }],
      ['49:1', { x: -10, y: 0, s: 1.02 }, E.ioSine], ['50:4', { x: -150, y: 30, s: 1.12 }, E.ioQ], ['51:1', { x: -150, y: 30, s: 1.12 }]] });
    sh.pulse(['43:3', '44:1', '44:3', '45:1', '46:1', '46:3', '47:1', '48:1', '48:3'], 0.008, 0.1);
    const V = (s, x, y) => ({ s, x, y });
    const ph = phR = phone(sh, { y: PY.badge, view: [['43:1', V(1.12, 500, 1150)], ['45:1', V(1.16, 500, 1150), E.ioSine], ['45:1.25', V(1, 540, 1170), E.outExpo]] });
    // framing moves on the beats (the phone travels; the screen is never cropped sideways)
    ph.keys([['43:1', { y: 0 }], ['45:1', { y: 0 }], ['45:1.5', { y: PY.top - PY.badge }, E.outExpo], ['47:1', { y: PY.top - PY.badge }],
      ['47:1.5', { y: PY.consent - PY.badge }, E.ioC], ['47:3', { y: PY.consent - PY.badge }], ['47:3.5', { y: PY.top - PY.badge }, E.outExpo]]);
    ph.wiggle('44:3', '45:1', 2.8, 2.6);
    DM.ev('44:3', 'pop', 'phone wiggles', { sfx: 'boop', gain: -12 });
    DM.pops(sh, [['sparkle', 'pink', 1150, 420, 58], ['sparkle', 'yellow', 1160, 560, 44]], '44:2', beat / 4, { z: 21, gain: -12 }).forEach(n => n.out('pop', '45:1'));
    DM.pops(sh, [['heart', 'pink', 1135, 700, 70, -10], ['star', 'mint', 1850, 640, 60, 8]], '44:3.5', beat / 2, { z: 21, gain: -11 }).forEach(n => n.out('pop', '45:1'));
    DM.sfx('43:1', 'sparkle', { gain: -4 });
    // M2: pink circle around the badge pill (glued to the footage), mint wavy underline under 「你拍人海，TA 拍舞台」
    DM.circle(sh, { on: ph, x: K(UI.badgePill[0]), y: K(UI.badgePill[1]), rx: 255, ry: 78, at: '43:3', dur: beat * 0.7, color: 'pink', width: 9, label: 'circle 同一刻的另一面', until: '45:1' });
    DM.underline(sh, { on: ph, x0: 105, x1: 585, y: K(UI.reason2[1] + 40), at: '44:1', dur: beat * 0.6, wavy: true, amp: 9, wl: 70, color: 'mint', width: 9, label: 'underline 你拍人海，TA 拍舞台', until: '45:1' });
    DM.pops(sh, [['sparkle', 'yellow', 1135, 160, 74], ['star', 'pink', 1840, 250, 70, 10], ['sparkle', 'mint', 1120, 880, 60], ['star', 'yellow', 1850, 960, 64, -8]], '43:3', beat / 4, { z: 20, gain: -10 }).forEach(n => n.out('pop', '45:1'));
    DM.pops(sh, [['star', 'yellow', 1110, 250, 64, -8], ['sparkle', 'pink', 1855, 420, 56]], '46:3.5', beat / 2, { z: 20, gain: -12 }).forEach(n => n.out('pop', '48:3'));
    // M3: 45:1 the tap (the capture's own tap ring) -> compose; 45:3 camera punch on the pair + ⇄; 46:1 the product scrolls
    DM.ev('45:1', 'tap', 'tap 和 TA 交换这个视角', { gain: -2 });
    DM.ev('45:1.5', 'slide', 'frame the compose', { sfx: 'whoosh', gain: -10 });
    DM.onLayout(() => {
      const [px, py] = ph.toWorld(Tc('45:3'), ...UI.pair);
      sh.punch('45:3', { x: px, y: py, s: 1.32, center: 0.2, until: '46:1', label: 'punch the pair + ⇄' });
      // 46:3 the product's own words under 「你们俩说了算。」: punch on 「要不要交换，仍由你和对方决定。」 while the swipe draws (whole line kept)
      const [dx, dy] = ph.toWorld(Tc('46:3'), (UI.decide[0] + UI.decide[1]) / 2, UI.decide[2]);
      sh.punch('46:3', { x: dx, y: dy, s: 1.3, center: 0.2, until: '47:1', sfx: 'none', label: 'punch 要不要交换，仍由你和对方决定' });
      const [cx, cy] = ph.toWorld(Tc('48:1'), ...UI.status);
      sh.punch('48:1', { x: cx, y: cy, s: 1.3, center: 0.15, until: '48:3', label: 'punch 等待本人回应' });
    });
    DM.ev('46:1', 'slide', 'the product scrolls to the reason card', { sfx: 'swish', gain: -10 });
    // 46:3 mint highlighter over 「要不要交换，仍由你和对方决定。」 (width in screen px: 58 source px x 0.5)
    { const [x0, x1, y] = UI.decide;
      // yellow, not mint: the reason card is mint.  The blend goes on the stroke's root <svg> (it carries a transform, so a blend set on
      // the path inside it only mixed with the svg's own transparent backdrop and the band covered the words)
      const hl = ph.annotate({ kind: 'swipe', label: 'swipe 要不要交换，仍由你和对方决定', color: 'yellow', width: 30, opacity: 0.9, linecap: 'butt', at: '46:3', dur: beat * 0.8, erase: '47:1', edur: 0.08,
        gen: r => DM.paths.line([[x0 - 8, y + (r() - .5) * 3], [(x0 + x1) / 2, y + (r() - .5) * 4], [x1 + 8, y + (r() - .5) * 3]], r, { jit: 2 }) });
      hl.el.style.mixBlendMode = 'multiply'; }
    // M4: 47:1 the product scrolls to the consent (the phone follows), 47:2 the tick: a mint check draws over the real one, 47:3 send
    DM.ev('47:1', 'slide', 'scroll to the consent', { sfx: 'swish', gain: -10 });
    DM.check(sh, { on: ph, x: K(UI.tick[0] + 8), y: K(UI.tick[1] - 6), size: 120, at: '47:2', width: 12, label: 'check over the real tick', sfx: 'tick', until: '47:3' });
    DM.ev('47:3', 'tap', 'tap 把这两张交给对方确认', { gain: -2 });
    DM.ev('47:3.5', 'slide', 'pending: back to the top', { sfx: 'swish', gain: -10 });
    // 48:3 clock sticker pops beside the phone and ticks on every beat, on 8ths in bar 50
    const ticks = ['48:3', '48:4', '49:1', '49:2', '49:3', '49:4', '50:1', '50:1.5', '50:2', '50:2.5', '50:3', '50:3.5'];
    const clock = clockSticker(sh, { x: 1150, y: 860, size: 150, r: -8, z: 16, ticks }).in('pop', '48:3', { sfx: 'pop', gain: -6, label: 'clock sticker' });
    clock.pulse(ticks, 0.05, 0.08);
    ticks.slice(1).forEach(at => DM.ev(at, 'tick', 'clock tick', { sfx: 'tick', gain: -4 }));
    // the wait: heartbeat pulse on every beat (49:1 -> 50:3)
    const hb = ['49:1', '49:2', '49:3', '49:4', '50:1', '50:2', '50:3'];
    ph.pulse(hb, 0.022, 0.12);
    const heart = DM.deco(sh, { kind: 'heart', color: 'pink', size: 104, x: 1102, y: 545, r: -8, z: 18, lw: 1.2 }).in('pop', '49:1', { sfx: 'none', label: 'heart (heartbeat)' });
    heart.pulse(hb, 0.28, 0.09);
    hb.forEach((at, i) => DM.sfx(at, 'heartbeat', { gain: i ? -3 : -2 }));
    // 50:2.5-50:3.5 three dots pop in a speech bubble (waiting for TA), 50:4 everything squashes and holds until the drop
    const bub = DM.card(sh, { w: 200, hgt: 100, x: 1100, y: 196, r: -5, z: 17, label: 'dots bubble' }).in('pop', '50:2.5', { sfx: 'none', log: false });
    [0, 1, 2].forEach(i => DM.deco(sh, { parent: bub, kind: 'dot', color: i === 1 ? 'pink' : 'ink', size: 30, x: 55 + i * 45, y: 47, z: 2 }).in('pop', `50:${2.5 + i * 0.5}`, { sfx: 'blip', gain: -8, note: i * 3, label: 'dot ' + (i + 1) }));
    for (const n of [ph, clock, bub, heart]) squash(n, '50:4');
    DM.ev('50:4', 'pop', 'squash and hold', { sfx: 'none' });
    DM.sfx('50:1', 'riser', { gain: -5, dur: Tc('50:4') - Tc('50:1') });
  }
  {
    const ty = DM.shot('M2-M5-type', '43:1', '51:1', { paper: false, z: 30, drift: null, log: false, enter: { kind: 'slide', dx: 700, dur: 0.14, sfx: 'none' } });
    // M2
    say(ty, 'T073', { x: 120, y: 360, outFx: 'cut' });
    const t74 = say(ty, 'T074', { x: 120, y: 612, outFx: 'cut' });
    DM.arrow(ty, { from: () => [t74.keyRect().x1 + 40, 600], to: () => { const p = wpt(shR, phR, 110, UI.badgePill[1] + 10); return [p[0] - 18, p[1] + 6]; }, bend: -0.12, head: 30,
      at: '43:3.5', dur: beat * 0.45, color: 'pink', width: 9, label: 'arrow to the badge', sfx: 'pencil', until: '45:1' });
    // M3-M4, v2 (review read #4): the column scrolls like a teleprompter — every new line enters in the lower slot and the line above
    // it jumps to the top slot on the same downbeat, so the column always reads top-down in order (v1 alternated top / bottom slots:
    // 「换不换，／换 TA 看到的。」, 「我同意，／你们俩说了算。」, 「还要 TA 也同意。／交给 TA 确认。」 for a second each)
    const SA = 380, SB = 592, up = (n, at) => n.move(jumpAt(at), jumpAt(at) + 0.0005, { y: SA - SB }, E.lin);
    say(ty, 'T075', { x: 120, y: SA, outFx: 'cut' });
    up(say(ty, 'T076', { x: 120, y: SB, outFx: 'cut' }), '46:1');
    up(say(ty, 'T077', { x: 124, y: SB, outFx: 'cut' }), '46:3');
    up(say(ty, 'T078', { x: 120, y: SB, outFx: 'cut' }), '47:1');
    const t79 = up(say(ty, 'T079', { x: 120, y: SB, outFx: 'cut' }), '47:3');
    // the check draws by 「我同意，」 in the lower slot and is redrawn (whole) by it in the upper slot after the jump
    DM.check(ty, { x: () => t79.keyRect().x1 + 80, y: K(SB - 8), size: 124, at: '47:1.5', dur: beat * 0.45, width: 14, color: 'mint', label: 'check 我同意', sfx: 'pencil', until: '47:3' });
    DM.check(ty, { x: () => t79.keyRect().x1 + 80, y: K(SA - 8), size: 124, at: '47:3', dur: 0.001, width: 14, color: 'mint', label: 'check 我同意 (after the jump)', log: false, until: '48:1' });
    const t80 = up(say(ty, 'T080', { x: 124, y: SB, step: beat / 8 }), '48:1');   // v2: 32nds (typed by 47:4.2; v1 ran into 48:1.25)
    DM.arrow(ty, { from: () => [t80.keyRect().x1 + 28, SA + 33], to: () => [t80.keyRect().x1 + 92, SA - 33], bend: 0.1, head: 22, at: '48:1.5', dur: beat * 0.4, color: 'ink', width: 8, label: 'arrow ↗', sfx: 'pencil', until: '48:3' });
    say(ty, 'T081', { x: 120, y: SB + 8, outFx: 'cut' });
    // M5
    const t82 = say(ty, 'T082', { x: 120, y: 380 });
    const t83 = say(ty, 'T083', { x: 120, y: 650 });
    squash(t82, '50:4'); squash(t83, '50:4');
  }

  // ================================================================================================ M6-M7 · 51:1 -> 55:1
  // 51:1 PAYOFF, the biggest hit of the film: hard cut; the real 「交换已接受」 sticker pops in the product under a punch-in (x1.7 on the
  // 600 px phone = the storyboard's x2.2 on a 480 px phone), a yellow starburst behind the phone, confetti from behind it, the frame
  // shakes, the giant mint sticker word 「交换已接受」 and both paper polaroids slam on the downbeat (boom + impact, crackle a 16th later);
  // 51:2 tape across both + ⇄, 51:2.5 the product's 「双方已明确同意」 stamp, 51:3 pull back to both photos; 52:1 「同一刻，」 52:3 「两面 / 都齐了。」.
  // M7: 53:1 the phone travels down to 「撤销这次交换的在线访问」, 53:2 mint circle, 53:3 punch on the fine print + 「随时可以撤销。」,
  // 54:1 the phone slides out left and a paper card drops 「然后呢？」, 54:3 it bounces, 54:4.5 yellow scribble wipe.
  {
    const sh = DM.shot('M6-M7-accepted', '51:1', INS ? '54+1:1' : '55:1', { drift: null, cam: [['51:1', { x: 0, y: 0, s: 1 }], ['53:1', { x: -10, y: 0, s: 1.03 }, E.ioSine], ['55:1', { x: -16, y: 0, s: 1.05 }, E.ioSine]] });
    const ty = DM.shot('M6-M7-type', '51:1', '55:1', { paper: false, z: 30, drift: null, log: false });
    sh.shake('51:1', 20, 9);
    sh.pulse(['51:3', '52:1', '52:3', '53:1', '53:3', '54:1', '54:3'], 0.014, 0.12);
    const burst = DM.burst(sh, { x: PX, y: 420, rOut: 640, rIn: 480, n: 26, color: 'yellow', spin: 12, z: 1, id: 'M6-burst' }).in('grow', '51:1', { dur: 0.05, log: false });   // near-instant: yellow fills the frame on the hit
    burst.pulse(['51:3', '52:1', '52:3', '53:1', '53:3'], 0.03, 0.12).move('53:1', '53:1.5', { x: 130, y: 120 }, E.outExpo).move('54:1', '54:1.5', { s: 0.0001 }, E.inC);
    const ph = phone(sh, { shadow: 'mint', view: [['51:1', { s: 1, x: 540, y: 1170 }]] });
    ph.keys([['51:1', { y: 0 }], ['53:1', { y: 0 }], ['53:1.5', { y: PY.revoke - PY.top }, E.outExpo]]);
    ph.punch('51:1', { s: 1.7, x: 518, y: UI.sticker[1] + 20 }, { until: '51:3', sfx: 'none', label: 'punch 交换已接受' });   // 1.7 on a 600 px phone = x2.1 of the storyboard's 480 px phone; keeps the header uncut
    ph.wiggle('52:1', '52:2', 2.2, 3);
    // 17 doodles tossed from behind the phone onto the free paper: the strip right of the phone, the gap between the words and the
    // phone, the top margin, the left margin and the bottom; none lands on a word (now or later: T084-T086), an avatar or the UI
    confettiBurst(sh, { id: 'A4-confetti', at: '51:1', from: [PX, 400], settle: '52:3', twinkle: ['51:4', '52:4', '53:4'], until: '54:1', z: 8, label: 'payoff confetti', pieces: [
      ['star', 'pink', 76, 1856, 112, 12], ['plus', 'yellow', 54, 1874, 292], ['heart', 'mint', 66, 1852, 470, -8], ['star', 'yellow', 72, 1866, 650, -10],
      ['sparkle', 'pink', 60, 1846, 832], ['heart', 'pink', 62, 1872, 1004, 10],
      ['star', 'yellow', 88, 1118, 112, -10], ['heart', 'pink', 60, 1150, 300, 8], ['sparkle', 'mint', 58, 1010, 440], ['plus', 'pink', 48, 1108, 590], ['star', 'mint', 58, 1160, 740, 14],
      ['sparkle', 'yellow', 52, 410, 66], ['star', 'pink', 54, 760, 58, -12], ['plus', 'mint', 42, 230, 84],
      ['sparkle', 'pink', 46, 52, 470], ['star', 'yellow', 50, 60, 780, 10], ['plus', 'yellow', 44, 640, 1044]] });
    DM.sfx('51:1.25', 'crackle', { gain: 0 });   // a 16th after the hit, so the two-at-once rule keeps boom + impact on the downbeat
    DM.ev('51:4', 'pop', 'confetti twinkles', { sfx: 'sparkle', gain: -12 });
    DM.ev('52:4', 'pop', 'stars twinkle', { sfx: 'sparkle', gain: -12 });
    DM.ev('51:1', 'slam', 'PAYOFF 交换已接受', { sfx: 'boom', gain: 2 });
    DM.deco(sh, { kind: 'burstline', color: 'ink', size: 300, x: 1215, y: 150, z: 4, lw: 1.5, r: -20 }).in('pop', '51:1', { log: false }).out('pop', '51:3');
    DM.deco(sh, { kind: 'burstline', color: 'ink', size: 260, x: 1800, y: 560, z: 4, lw: 1.5, r: 15 }).in('pop', '51:1', { log: false }).out('pop', '51:3');
    // 52:1 the two of you (the build's own avatars: 阿宁 in 失真, 阿遥·示例) pop up between the words and the phone and hop on the beats
    [['avatar:you', 935, -3, '阿宁'], ['avatar:yao', 1085, 3, '阿遥·示例']].forEach(([src, x, r, nm], i) => {
      const a = DM.sticker(sh, { src, w: 132, x, y: 1046, ay: 1, r, z: 14, label: 'avatar ' + nm }).in('pop', `52:${1 + i * 0.5}`, { sfx: i ? 'none' : 'boop', gain: -8, note: i * 4 });
      a.bob('52:1.5', '53:1', 16, beat).out('pop', '53:2'); });
    DM.ev('51:3', 'punch', 'pull back: both photos', { sfx: 'whoosh', gain: -6 });
    // M6, v2 (review art #4): the payoff gets a picture of its own.  The product's own mint sticker 「交换已接受」 (CUT-06s: the same
    // element cut out of the build at the phone's DPR, with its star) lifts out of the phone ON the downbeat and lands at ~3x its size
    // on screen, while the two M1 polaroids (yours / 阿遥·示例's) fly in on either side under it; it drops back into the phone on the
    // "and" of 4, before 「同一刻，」.  (v1 set 「交换已接受」 as a display title by a phone on a starburst: the 21:1 drop's composition.)
    {
      const SW = 780, P = [585, 292], t0 = Tc('51:1'), tb = Tc('51:4.5');
      const stk = DM.sticker(sh, { src: 'CUT-06s', w: SW, x: P[0], y: P[1], r: -4, z: 22, label: 'accepted sticker lifted' });
      stk.t0 = t0; stk.t1 = tb + 0.2;
      stk.track(t => {
        const k = E.outBack(clamp((t - t0 + 0.5 * F) / 0.2), 1.5) * (1 - E.inQ(clamp((t - tb) / 0.2)));
        const [fx, fy] = ph.toWorld(t, UI.sticker[0], UI.sticker[1]); const s0 = 548 * (ph.sw0 / 1080) * ph.viewAt(t).s / SW;
        return { x: (fx - P[0]) * (1 - k), y: (fy - P[1]) * (1 - k), s: lerp(s0, 1, k), r: 4 * (1 - k) };
      });
      stk.pulse(['51:3', '51:4'], 0.05, 0.1);
      DM.ev('51:1', 'pop', 'the product sticker 交换已接受 lifts out of the phone', { sfx: 'none' });   // the boom + impact carry the hit
      DM.ev('51:4.5', 'slide', 'the sticker drops back into the phone', { sfx: 'swish', gain: -8 });
      DM.sfx('51:1', 'impact', { gain: 0 });
    }
    // the two paper polaroids from M1 fly back in on the downbeat (yours from the left, 阿遥·示例's from below); 51:2 tape across both
    // + ⇄; the product's own 「双方已明确同意」 lands as a mint stamp; all of it pops off on the 16th before 52:3 (「两面 / 都齐了。」)
    DM.polaroid(ty, { src: 'photo:sample-crowd', w: 380, hgt: 320, x: 330, y: 712, r: -7, z: 6, tape: false, label: 'yours (payoff)', pos: '50% 42%' })
      .in('slide', '51:1', { dx: -980, dy: 160, dr: -18, dur: 0.24, ease: E.outBack, log: false }).out('pop', '52:2.75');
    DM.polaroid(ty, { src: 'photo:yao-stage', w: 380, hgt: 320, x: 742, y: 728, r: 6, z: 5, tape: false, label: 'TA (payoff)', pos: '50% 60%' })
      .in('slide', '51:1', { dx: 120, dy: 760, dr: 16, dur: 0.24, ease: E.outBack, log: false }).out('pop', '52:2.75');
    DM.tape(ty, { x: 536, y: 568, r: -5, w: 240, color: 'y', z: 8 }).in('slap', '51:2', { big: 1.2, spin: 4, sfx: 'tape', gain: -2, label: 'tape across both' }).out('pop', '52:2.75');
    DM.swap(ty, { x: 538, y: 722, size: 134, z: 9 }).in('spring', '51:2', { sfx: 'zip', gain: -4 }).out('pop', '52:2.75');
    DM.stamp(ty, { text: '双方已明确同意', color: 'mint', size: 56, x: 548, y: 900, r: -6, z: 12, at: '51:2.5', until: '52:2.75', label: 'stamp 双方已明确同意 (product text)', gain: -2,
      style: { background: 'var(--card)', color: '#13806a', webkitMaskSize: '900px 450px', maskSize: '900px 450px', boxShadow: '4px 5px 0 rgba(28,27,26,.9)' } });
    say(ty, 'T084', { x: 120, y: 300, outFx: 'cut' });
    say(ty, 'T085', { x: 112, y: 612, outFx: 'cut' });
    // M7: down to the revoke button, mint circle, punch on the fine print
    DM.ev('53:1', 'slide', 'down to the revoke button', { sfx: 'swish', gain: -8 });
    DM.circle(sh, { on: ph, x: K(UI.revoke[0]), y: K(UI.revoke[1]), rx: 560, ry: 112, at: '53:2', dur: beat * 0.7, color: 'mint', width: 11, label: 'circle 撤销这次交换的在线访问' });
    DM.onLayout(() => { const [fx, fy] = ph.toWorld(Tc('53:3'), ...UI.fine); sh.punch('53:3', { x: fx, y: fy, s: 1.22, center: 0.1, until: '54:1', label: 'punch the fine print' }); });
    // v2 (review read #4): 「随时可以撤销。」 slams straight into its own place at the top of the column and stays put; the 「然后呢？」
    // card lands UNDER it on 54:1 (v1 slid the line 250 px down while it was being read, to sit under the card as if revoking came next)
    say(ty, 'T086', { x: 120, y: 205 });
    // 54:1 the phone slides out left; the paper card takes over (card + type on the static layer so they stay together)
    ph.out('slide', '54:1', { dx: -1900, dr: -10, dur: 0.3, sfx: 'whoosh', gain: -4, log: true, label: 'phone slides out left' });
    const card = DM.card(ty, { w: 1180, hgt: 400, x: 990, y: 650, r: -2, z: 35, label: 'card 然后呢' }).in('slap', '54:1', { big: 1.15, spin: -4, sfx: 'slap', gain: -2 });
    DM.tape(ty, { parent: card, x: 590, y: 0, r: 3, w: 240, color: 'y', z: 3 });
    const endPops = DM.pops(ty, [['question', 'pink', 1690, 330, 120, 12], ['star', 'yellow', 250, 610, 84, -10], ['sparkle', 'mint', 1700, 930, 70]], '54:2', beat / 2, { z: 44, gain: -9 });
    if (INS) endPops.forEach(n => n.out('pop', '54+1:1'));   // the card shrinks to the corner there: no star on its words
    const t87 = say(ty, 'T087', { x: 990, y: 650, ax: 0.5, z: 40 });
    // card and words bounce as one on 54:3 (same centre) and keep pushing in until the wipe
    for (const n of [card, t87]) n.pulse(['54:3'], 0.12, 0.1).drift('54:1.5', '54:4.5', { s: 1.04 });
    DM.ev('54:3', 'pop', '然后呢 bounces', { sfx: 'boop', gain: -4 });
    if (INS) { card.keys([['54+1:1', { x: 0, y: 0, s: 1 }], ['54+1:1.5', { x: -560, y: -240, s: 0.5 }, E.outExpo]]); t87.keys([['54+1:1', { x: 0, y: 0, s: 1 }], ['54+1:1.5', { x: -560, y: -240, s: 0.5 }, E.outExpo]]); }
  }
  // elastic +3 (maps with a bar inserted after 54): the 3D wall with both photos (阿遥's stage, yours) circled and a pink ⇄ between them
  // slaps in under the 「然后呢？」 card, which moves to the corner (D-03b-wall-after: the desktop photos view, five photos)
  if (INS) {
    const sh = DM.shot('M7-wall', '54+1:1', '55:1', { drift: { s: 1.04 }, enter: { kind: 'slap', sfx: 'slap' }, z: 12 });
    const WALL = { stage: [1623, 834], crowd: [2049, 1206] };          // D-03b master px (3840 x 2160), measured on CUT-03
    const desk = DM.desk(sh, { media: 'D-03b-wall-after', w: 1440, x: 1050, y: 505, view: [['54+1:1', { s: 1.55, x: 1836, y: 1020 }], ['55:1', { s: 1.7, x: 1836, y: 1020 }, E.ioSine]] });
    desk.show('54+1:1');
    DM.circle(sh, { on: desk, x: K(WALL.stage[0]), y: K(WALL.stage[1]), rx: 170, ry: 190, at: '54+1:1.5', dur: beat * 0.6, color: 'pink', width: 10, label: 'circle 阿遥 stage on the wall' });
    DM.circle(sh, { on: desk, x: K(WALL.crowd[0]), y: K(WALL.crowd[1]), rx: 170, ry: 190, at: '54+1:2', dur: beat * 0.6, color: 'mint', width: 10, label: 'circle yours on the wall' });
    const mid = t => { const a = desk.toWorld(t, ...WALL.stage), b = desk.toWorld(t, ...WALL.crowd); return [(a[0] + b[0]) / 2 + 60, (a[1] + b[1]) / 2 - 20]; };
    DM.swap(sh, { x: 0, y: 0, size: 120, z: 20 }).track(t => { const [x, y] = mid(t); return { x, y }; }).in('spring', '54+1:3', { sfx: 'zip', gain: -4 });
    // (v2, owner 0b: no AI-disclosure tag here any more)
  }
  DM.wipe('W-A4-A5', INS ? '54+1:4.5' : '54:4.5', '55:1', { colors: ['pink', 'yellow'], width: 340 });   // the last colour paints on top: a yellow scribble wipe
})();
