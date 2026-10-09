/* Music Space · Doodle video — ACT A2 ENTER (bars 21-28) + ACT A3 PHOTO + AI (bars 29-40).
 * v3 (2026-10-08): every shot re-cut on the 0.22.0-rc.2 re-captures (the owner's copy revision of 2026-10-07: no explanatory / demo
 * copy, cast without 「·示例」, 「进入现场」, onboarding 「第一次来 1/4 · 放一张今晚的照片」, 「人海那张」 / 「舞台那张」, the hint under the
 * AI chip 「配对时用它找另一面，你说了算。」 (「AI 在本机判断，照片不上传」 is now the AI chip's own tooltip), wall note 「3 分钟内拍下」, no
 * pipeline ribbon).  Every source-pixel position below was re-measured on those clips (review/act-A2-A3-v3/fr, src; die-cuts placed by
 * template match).  Words: SCRIPT.md T041-T048 (A2), T050-T067 (A3), via DM.say (text, font, size, recipe, entrance, in/out from the
 * script; the lines changed on 2026-10-08 — T050 text + out, T051 / T052 / T054 timing, T059, T065 — carry the SCRIPT.md text and
 * positions as overrides).
 * Pictures and beats: STORYBOARD.md E1 (the drop: the phone rises with the real first screen), E2 (wardrobe, a look per beat),
 * E3 (entry form: 愿意打招呼 / 安静参与, consent tick), E4 (desktop 3D room, the five circled), A1 (room -> upload form, 拍摄于 21:48 ·
 * 来自照片自带的信息), A2 (「✦ AI 判断：人海」 on the chime, 人海。, AI 在本机判断，照片不上传), A3 (the honest 「✦ 不确定，请选择」, tap 舞台),
 * A4 (save -> wall panel, desktop 3D wall 4 -> 5 photos, 上墙啦！), A5 (21:47 同一刻, the note 「3 分钟内拍下」, the badge).
 * Footage (rc.2, addressed by PATH, see RC2): TAKE-P1 P-01/02/03/05/07/08 (capture/P1-rc2), TAKE-P2 P-06 (capture/P2P3-rc2, fresh world,
 * never saved), desktop D-02 / D-03a / D-03b (capture/desktop-rc2 4K masters), die-cuts CUT-04a, CUT-04u, WALL-01, CUT-05,
 * POL-03/04/05 (capture/P2P3-rc2/cut).  All the phone taps were choreographed on the 123 BPM grid of Flipping In (the rc.2 takes keep the rc.1 frame
 * numbers): clips play at rate R = (60/123) / beat so the taps stay on the beats under any tempo map (R = 1 under flipping-in(-b)).
 * Positions on the footage are source pixels (1080 x 2340 phone, 3840 x 2160 desktop).
 * Local helpers (not in the library): `patch` (a crop of another frame of the same clip laid over the phone screen, here to hide the
 * rig's tap ring on a held frame), `z0` (see below: DM.circle/check/underline/highlight with numeric x/y are offset twice by DM.Node;
 * the library's own acts pass functions, which are not affected), `cutKey` (a hard change of a device's zoom at a cut), `fromAt` (clip
 * start so that a given source frame lands on a beat at rate R), `presetRow` (E2: the wardrobe's preset names as dashed chips that turn
 * selected on each tap beat), `tStep` (the start time of the current boil step: strokes whose path follows moving footage compute it
 * there, so chunked / shuffled renders match in-order ones).
 * Framing (v3): the phone views and punch-ins put their edges in the blank rows / columns between UI lines of the rc.2 layouts
 * (measured row by row), so no line of product text is sliced by the screen edge (shapes and icons may run off it).  Where the rc.2
 * layout leaves no clean crop (the wardrobe, the AI chip, the unsure chip, the save button) the screen stays whole and the beat gets a
 * phone bump or a lift-off; the in-phone punches left are 22:1 (the product's title 「同一刻，另一面。」), 30:1 (拍摄于 21:48) and 32:1
 * (人海 ✓).
 * Lift-offs: real UI elements (CUT-04a 「AI 判断：人海」, CUT-04u 「不确定，请选择」, WALL-01 group header + note, CUT-05 badge,
 * POL-03/04/05 wall cards: die-cuts of the same build and state) fly out of the phone from their on-screen position and size
 * (device.toWorld + view zoom), then back.
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

  // v3: the rc.2 re-captures by path.  capture/P1, capture/P2P3 and capture/desktop still hold the rc.1 files under the same ids, and
  // tools/serve.mjs breaks an id tie by file size (the rc.1 files are the larger ones), so an id would pull the OLD copy back in.
  const RC2 = {
    'P-01': 'capture/P1-rc2/clips/P-01.mp4', 'P-02': 'capture/P1-rc2/clips/P-02.mp4', 'P-03': 'capture/P1-rc2/clips/P-03.mp4',
    'P-05': 'capture/P1-rc2/clips/P-05.mp4', 'P-07': 'capture/P1-rc2/clips/P-07.mp4', 'P-08': 'capture/P1-rc2/clips/P-08.mp4',
    'P-06': 'capture/P2P3-rc2/clips/P-06.mp4',
    'D-02': 'capture/desktop-rc2/master/D-02-room-hero.mp4',
    'D-03a': 'capture/desktop-rc2/master/D-03a-wall-before.mp4', 'D-03b': 'capture/desktop-rc2/master/D-03b-wall-after.mp4',
    'CUT-04a': 'capture/P2P3-rc2/cut/CUT-04a_ai-tag-renhai.png',                          // 502 x 151, at (76, 1383) on P-05 f77+
    'CUT-04u': 'capture/P2P3-rc2/cut/CUT-04u_ai-tag-unsure.png',                          // 526 x 138, at (76, 1389) on P-06 f134+
    'WALL-01': 'capture/P2P3-rc2/cut/WALL-01_group-header-2147-rule.opaque.png',          // 577 x 306, at (76, 506) on P-08 f150
    'CUT-05': 'capture/P2P3-rc2/cut/CUT-05_badge-other-side.opaque.png',                  // 858 x 596, at (98, 891) on P-08 f150
    'POL-03': 'capture/P2P3-rc2/cut/POL-03_wall-card-man-crowd-2148.png',                 // 小满 · 拍摄于 21:48 · 作者选择
    'POL-04': 'capture/P2P3-rc2/cut/POL-04_wall-card-aning-crowd-2148-ai.png',            // 阿宁 (you) · 21:48 · AI 建议，未改动
    'POL-05': 'capture/P2P3-rc2/cut/POL-05_wall-card-bei-detail-2149.png',                // 北屿 · 21:49 · 作者选择
  };
  const clip = id => DM.clip(RC2[id]);

  // -------------------------------------------------------------------------------------------- local primitives
  /** a crop of another frame (url) of a 1080x2340 capture: source rect sx,sy,sw,sh laid over a phone screen at dst (source px), feathered */
  const patch = (sh, ph, o) => {
    const k = ph.sw0 / 1080;
    const n = DM.div(sh, { parent: ph.screen, w: o.sw * k, hgt: o.sh * k, x: o.dx * k, y: o.dy * k, ax: 0, ay: 0, boil: false, z: 5,
      html: `<img decoding="sync" src="${o.url}" style="position:absolute;left:${(-o.sx * k).toFixed(2)}px;top:${(-o.sy * k).toFixed(2)}px;width:${(1080 * k).toFixed(2)}px;height:${(2340 * k).toFixed(2)}px;max-width:none">`,
      label: 'patch ' + o.label });
    n.el.style.overflow = 'hidden';
    n.el.style.webkitMaskImage = n.el.style.maskImage = 'radial-gradient(closest-side, #000 74%, transparent 100%)';
    return n;
  };
  // DM.circle / DM.check / DM.underline read x / y as path coordinates, but DM.Node also takes numeric o.x / o.y as the element's
  // own offset (the stroke would be drawn twice as far): zero the node offset (functions are not affected; the library's own acts use those)
  const z0 = n => { n.x = 0; n.y = 0; return n; };
  const tapAt = (at, label, note = 0) => DM.ev(at, 'tap', label, { sfx: 'click', note });     // the capture shows its own tap ring; this is the click
  // (v2) a line that re-slots on a downbeat jumps there on that frame (a tween would cross the line slamming into the column)
  const jumpAt = pos => Tc(pos) - 0.5 / 60 - 0.001;
  const HALF = 0.5 / 60;
  // A stroke re-generates its path once per boil step (12 fps), so a path that follows moving footage must be computed at the step's
  // first frame, not at whichever frame of the step happens to render first (chunked / shuffled renders): same result as in order
  const tStep = () => DM.boilStep(DM._lastT) / DM.cfg.boilFps;
  /** a row of the product's dashed preset chips: chip i pops in on beats[i] already selected (yellow fill, solid ink border, hard
   *  shadow, like a pressed key) and falls back to dashed paper when the next one is tapped; the last one stays selected */
  const presetRow = (shot, names, beats, o) => names.map((nm, i) => {
    const c = DM.chip(shot, { text: nm, size: o.size || 52, x: o.x + i * o.dx, y: o.y, ax: 0.5, ay: 0.5, r: o.r ? o.r[i] : 0, z: 6,
      style: { borderStyle: 'dashed', background: 'var(--paper)', boxShadow: 'none' }, label: 'preset ' + nm });
    c.in('pop', beats[i], { sfx: 'none', label: 'preset chip ' + nm });
    if (o.until) c.out('pop', o.until);
    let sel = null;
    c.inner = t => { const a = Tc(beats[i]), b = i + 1 < beats.length ? Tc(beats[i + 1]) : Infinity, on = t + HALF >= a && t + HALF < b;
      if (on !== sel) { sel = on; Object.assign(c.el.style, on ? { borderStyle: 'solid', background: 'var(--yellow)', boxShadow: '6px 6px 0 var(--ink)' } : { borderStyle: 'dashed', background: 'var(--paper)', boxShadow: 'none' }); } };
    return c;
  });

  // ============================================================================================== A2 · E1-E3 · THE PHONE (L1) · 21:1 -> 27:1
  // One composition: the phone stays (X5 screen swaps on 23:1 and 25:1), the right column carries the type.
  {
    const sh = DM.shot('A2-E-phone', '21:1', '27:1', { drift: null });
    const ty = DM.shot('A2-E-type', '21:1', '27:1', { paper: false, z: 30, drift: null, log: false });
    sh.pulse(bars(21, 26), 0.008, 0.1);
    const P01 = clip('P-01'), P02 = clip('P-02'), P03 = clip('P-03');
    const tE2freeze = Tc('23:1') + fr(550 - 331) / R;          // P-02 f550: the save tap ring is down, the wardrobe still open
    const feed = DM.seq(
      DM.play(P01, { at: '21:1', from: fromAt(363, '22:3', '21:1'), rate: R }),   // E1: first screen; the tap on 进入现场 = 22:3
      '23:1', DM.play(P02, { at: '23:1', from: fr(331), rate: R }),               // E2: presets 23:1-23:4, angles 24:1-24:4, save 24:4.5
      tE2freeze, DM.play(P02, { at: tE2freeze, from: fr(550), rate: 0 }),
      '25:1', DM.play(P03, { at: '25:1', from: fr(121), rate: R }));              // E3: scroll 25:2, tick 26:1, enter 26:3
    const full = { s: 1, x: 540, y: 1170 };
    // view keys (source px)
    const view = [
      ['21:1', full], ['21:3', full], ['22:1', { s: 1.07, x: 540, y: 1250 }, E.ioSine],
      // E2 (v3, rc.2 wardrobe after its scroll, P-02 f331-f550, rows: MY LOOK / 今晚，我这样。 22-151 (x 38..), the × 917..1012,
      // pill + figure + angle control 213-1096, parts 1132-1436, 8 件 1474-1509, 试试现成搭配 1594-1629, 一键换装… 1682-1717, presets
      // 1752-1874 / 脉冲 1896-2018, 取消 / 保存这个我 2123-2275): the parts list and the × run edge to edge, so any punch slices a line
      // or the close button (v2's x1.35 / x1.68 cut the title, the pill and the parts).  The whole wardrobe, pushing x1.0 -> x1.03 from
      // the capture's top: the real preset chips and the angle buttons take their taps in frame.
      ...cutKey('23:1', { s: 1.08, x: 540, y: 1250 }, full),
      ['24:4.5', { s: 1.03, x: 540, y: 1136 }, E.ioSine],
      ...cutKey('25:1', { s: 1.03, x: 540, y: 1136 }, full),
      // E3 (v3, rc.2 entry form, P-03 f179 after the scroll): x1.14 with the top edge at y 180 (between the toast 「小人已保存，下次碰面也能
      // 认出你」 and the name block) and the bottom at 2233 (between the nav and the footer); held to the tap on 26:3
      ['25:3', full], ['25:4', { s: 1.14, x: 540, y: 1206 }, E.ioC], ['26:3', { s: 1.14, x: 540, y: 1206 }], ['26:3.6', full, E.outC], ['27:1', { s: 1.03, x: 540, y: 1170 }, E.ioSine],
    ];
    const ph = DM.phone(sh, { media: feed, x: 470, y: 548, r: -2, w: 500, shadow: 'mint', z: 6, view, label: 'phone E' });
    ph.drift('21:3', '27:1', { s: 1.025, y: -4 });
    ph.in('rise', '21:1', { dur: 0.42, dist: 1150, spin: 5, sfx: 'whoosh', label: 'phone rises (drop)' });
    // E1 punch onto the product's own title 「同一刻，另一面。」 (= the film's title), back out for the tap.  (v3) x2.4 in all (1:1, sharp):
    // x 95..545, y 560..1535 — from under 「这一晚，从这里开始」 (ends 512) to the gap under the title (title 1266-1507, the card's lead from
    // 1564): the lead 「同一晚，你拍了舞台，TA 拍了人海。…」 (the landing card's generic example, the reverse of the film's pair) stays small
    ph.punch('22:1', { s: 2.243, x: 320, y: 1047.5 }, { until: '22:2.5', sfx: 'thump', label: 'punch: the title 同一刻，另一面。' });
    // E2: the figure turns on the four angle beats; the phone bumps on 24:1 (no in-phone punch: see the view keys)
    DM.ev('24:1', 'punch', 'the figure turns (phone bump)', { sfx: 'thump', gain: -4 });
    // the drop: starburst behind the phone, a boom under it (the bed's own drop is soft under some maps)
    DM.burst(sh, { x: 470, y: 560, rOut: 600, rIn: 455, n: 22, color: 'yellow', spin: 12, z: 1 }).in('grow', '21:1', { dur: 0.22, log: false }).out('shrink', '22:4.5', { dur: 0.12 });
    DM.sfx('21:1', 'boom', { gain: -6 });
    // E2 / E3 colour blocks behind the phone (a new paper per section)
    DM.scrap(sh, { w: 640, hgt: 860, color: 'pink', x: 470, y: 560, r: 5, z: 1 }).in('slap', '23:1', { big: 1.12, spin: -6, sfx: 'slap', gain: -6, label: 'pink paper' }).out('cut', '25:1');
    DM.scrap(sh, { w: 660, hgt: 820, color: 'mint', x: 480, y: 580, r: -4, z: 1 }).in('slap', '25:1', { big: 1.12, spin: 6, sfx: 'slap', gain: -6, label: 'mint paper' });
    ph.pulse(['23:1', '25:1'], 0.03, 0.08);
    ph.pulse(['24:1'], 0.045, 0.1);

    // ---- E1 (21-22): type, a tap, a ding
    say(ty, 'T041', { x: 880, y: 375, outFx: 'cut' });          // v2: cut on 23:1, where 「带上你的小人，」 slams in (no double exposure)
    const t42 = say(ty, 'T042', { x: 880, y: 655, outFx: 'cut' });
    DM.underline(ty, { wavy: true, amp: 7, wl: 56, width: 9, color: 'mint', at: '22:1.5', dur: beat * 0.6, z: 25, label: 'wavy 同一间',
      x0: () => t42.keyRect().x0 - 4, x1: () => t42.keyRect().x1 + 6, y: () => t42.keyRect().y1 + 2 }).out('cut', '23:1');
    tapAt('22:3', 'tap 进入现场');
    DM.pops(sh, [['sparkle', 'pink', 790, 150, 64]], '21:2', beat, { z: 12, gain: -10 });
    DM.pops(sh, [['star', 'mint', 1760, 905, 84, 12]], '21:4', beat, { z: 12, gain: -10 }).forEach(d => d.out('pop', '23:1'));
    DM.deco(sh, { kind: 'heart', color: 'pink', size: 92, x: 790, y: 905, r: -10, z: 12 }).in('pop', '22:4', { sfx: 'ding', gain: -6, label: 'ding heart' }).out('pop', '23:1');

    // ---- E2 (23-24): the wardrobe flips on every beat; the product's preset names hop along a chip row (one tap per beat: the
    // wardrobe opens on 留白, the taps are 断拍 -> 循迹 -> 回声 -> 失真 under 「试试现成搭配」, TAKE-P1 rc2 manifest), a tiny star per tap, the note
    say(ty, 'T043', { x: 850, y: 470 });
    say(ty, 'T044', { x: 845, y: 215, r: -4, size: 96, color: '#e9396b', style: { webkitTextStroke: '1.5px var(--ink)', paintOrder: 'stroke fill' } });   // v2: 96 px, stamp pink + ink edge (read #8)
    const looks = ['断拍', '循迹', '回声', '失真'], lookAt = ['23:1', '23:2', '23:3', '23:4'], LX0 = 960, LDX = 200, LY = 705;
    presetRow(ty, looks, lookAt, { x: LX0, dx: LDX, y: LY, r: [-3, 2, -2, 3], until: '25:1' });
    lookAt.forEach((at, i) => {
      tapAt(at, 'tap preset ' + looks[i], i % 2 ? 3 : 0);
      DM.deco(ty, { kind: i % 2 ? 'sparkle' : 'star', color: ['pink', 'mint', 'pink', 'mint'][i], size: 50, x: LX0 + i * LDX + 78, y: LY - 50, r: (i - 1.5) * 9, z: 12 })
        .in('pop', at, { sfx: 'none', label: 'star on ' + looks[i] }).out('pop', i < 3 ? lookAt[i + 1] : '25:1');
    });
    ['24:1', '24:2', '24:3', '24:4'].forEach((at, i) => tapAt(at, 'tap angle ' + (i + 1), i % 2 ? 3 : 0));
    DM.pops(sh, [['sparkle', 'mint', 790, 640, 50], ['sparkle', 'pink', 815, 380, 44]], '24:2', beat, { z: 12, sfx: 'none' }).forEach(d => d.out('pop', '25:1'));
    DM.deco(sh, { kind: 'star', color: 'yellow', size: 96, x: 800, y: 905, r: 10, z: 12 }).in('pop', '24:4', { sfx: 'ding', gain: -6, label: 'ding star' }).out('pop', '25:1');
    tapAt('24:4.5', 'tap 保存这个我 (off frame; E3 opens on the toast 小人已保存，下次碰面也能认出你)');
    z0(DM.check(sh, { x: 800, y: 760, size: 90, at: '24:4.5', dur: beat * 0.4, color: 'mint', width: 11, z: 12, sfx: 'pencil', label: 'saved check' })).out('cut', '25:1');

    // ---- E3 (25-26): the participation choice; bracket from the two options to the type; the consent tick
    say(ty, 'T045', { x: 880, y: 290 });
    say(ty, 'T046', { x: 880, y: 575 });
    say(ty, 'T047', { x: 905, y: 865, r: -4 });
    // v3, rc.2 entry form after the scroll (P-03 f179): 愿意打招呼 y 854-1069, 安静参与 y 1092-1298 (x 88-979); consent box (122, 1451);
    // 进入现场 (533, 1583)
    const sp = (sx, sy) => ph.toWorld(tStep(), sx, sy);
    DM.stroke(sh, { color: 'pink', width: 9, at: '25:3', dur: beat * 0.7, z: 14, label: 'bracket around both options', erase: '26:3', sfx: 'squeak',
      gen: r => { const a = sp(1010, 860), b = sp(1010, 1295); const x = Math.max(a[0], b[0]) + 18, m = (a[1] + b[1]) / 2;
        return DM.paths.curve([[x - 14, a[1]], [x + 10, a[1] + 14], [x + 12, m - 30], [x + 38, m], [x + 12, m + 30], [x + 10, b[1] - 14], [x - 14, b[1]]], r, { jit: 3 }); } });
    // T045 points at its option (SCRIPT position: "right column, with arrow to the option"): the head lands just above the top-right
    // corner of 「愿意打招呼」 once the form has scrolled (25:3); it follows the screen (re-aimed on every boil step)
    DM.arrow(ty, { from: [866, 352], to: () => { const t = tStep(); const [x, y] = sh.toScreen(t, ...ph.toWorld(t, 925, 840)); return [x + 4, y - 6]; },
      bend: 0.22, head: 26, at: '25:2.5', dur: beat * 0.5, color: 'pink', width: 8, z: 9, erase: '26:1', label: 'arrow 愿意打招呼 -> its option', gain: -4 });
    tapAt('26:1', 'tick 我愿意向本场成员展示我的昵称和小人');
    z0(DM.check(sh, { on: ph, x: 122, y: 1451, size: 150, at: '26:1', color: 'mint', width: 11, label: 'mint check on the consent tick', sfx: 'pencil', erase: '26:3' }));
    tapAt('26:3', 'tap 进入现场');
    DM.deco(sh, { kind: 'star', color: 'mint', size: 92, x: 790, y: 1000, r: -8, z: 12 }).in('pop', '26:4', { sfx: 'ding', gain: -6, label: 'ding star' });
  }
  DM.wipe('W-A2-room', '26:4.5', '27:1', { colors: ['mint', 'yellow'] });

  // ============================================================================================== A2 · E4 · WHO IS HERE (L4) · 27:1 -> 29:1
  {
    const sh = DM.shot('A2-E4-room', '27:1', '29:1', { drift: null, cam: [['27:1', { x: 0, y: 0, s: 1.0 }], ['29:1', { x: -6, y: -4, s: 1.025 }, E.ioSine]] });
    const ty = DM.shot('A2-E4-type', '27:1', '29:1', { paper: false, z: 30, drift: null, log: false });
    sh.pulse(bars(27, 28), 0.008, 0.1);
    const D02 = clip('D-02');
    // +2 elastic bar (maps that insert a bar after 28): the product camera glides from the overview to the photo wall (D-02 8.0 s);
    // it ends framed on the 3D world only (x 497..3333, y 242..1838: no page header, nav or 「正在靠近」 chip)
    const feed = DM.seq(DM.play(D02, { at: '27:1', from: 0.4 }), '28+1:1', DM.play(D02, { at: '28+1:1', from: 8.0 }));
    const view = DM.has('28+1:1')
      ? [['27:1', { s: 1.8, x: 1700, y: 1098 }], ['28+1:1', { s: 1.88, x: 1710, y: 1070 }, E.ioSine], ['28+1:2', { s: 1.36, x: 1915, y: 1040 }, E.ioC], ['29:1', { s: 1.4, x: 1915, y: 1040 }, E.ioSine]]
      : [['27:1', { s: 1.8, x: 1700, y: 1098 }], ['29:1', { s: 1.9, x: 1712, y: 1062 }, E.ioSine]];
    const desk = DM.desk(sh, { media: feed, w: 1800, x: 960, y: 532, z: 4, srcW: 3840, srcH: 2160, label: 'desk 3D room', view });
    desk.show('27:1');
    // the five, circled on the beats (figure boxes measured on D-02 rc.2, master px: identical to rc.1; the name tags now read
    // 「阿遥 · 可招呼」 「小满 · 可招呼」 「北屿 · 可招呼」 「阿宁 · 我」 「林间 · 安静」)
    const K = 1800 / 3840;
    const who = [['27:2', '阿遥', 1320, 1162, 'pink', -5], ['27:3', '小满', 1507, 1156, 'yellow', 4], ['27:4', '北屿', 1716, 1166, 'mint', -3], ['28:1', '林间', 2145, 1168, 'pink', 5]];
    who.forEach(([at, nm, x, y, c, tilt], i) => {
      z0(DM.circle(sh, { on: desk, x, y, rx: 118, ry: 262, tilt, at, dur: beat * 0.55, color: c, width: 9, erase: '28+1:1', label: 'circle ' + nm, gain: -8, note: i,
        origin: [x * K, y * K] })).wiggle('28:3', '28:4.2', 4, 6);
    });
    // 阿宁 · 我: a yellow loop + a pink heart on 28:2
    z0(DM.circle(sh, { on: desk, x: 1945, y: 1152, rx: 118, ry: 262, tilt: 3, at: '28:2', dur: beat * 0.5, color: 'yellow', width: 10, erase: '28+1:1', label: 'circle 阿宁 · 我', sfx: 'none',
      origin: [1945 * K, 1152 * K] })).wiggle('28:3', '28:4.2', 4, 6);
    // (the heart and the sparkles are glued to source pixels of the overview: they leave when the camera starts gliding, '28+1:1';
    // without the inserted bar that clamps to the shot's end)
    const heart = DM.deco(sh, { kind: 'heart', color: 'pink', size: 64, x: 0, y: 0, z: 12 }).in('pop', '28:2', { sfx: 'boop', gain: -4, label: 'heart on 阿宁 · 我' }).out('pop', '28+1:1');
    heart.track(t => { const [x, y] = desk.toWorld(t, 1937, 868); return { x, y }; });
    DM.pops(sh, [['sparkle', 'yellow', 0, 0, 52], ['sparkle', 'mint', 0, 0, 44]], '28:3', beat / 2, { z: 12, gain: -10 }).forEach((d, i) =>
      d.out('pop', '28+1:1').track(t => { const [x, y] = desk.toWorld(t, i ? 2330 : 1150, i ? 990 : 1010); return { x, y }; }));
    // inserted bar (maps +28+1 only): the product's camera glides to the photo wall (the cast hides on the way, product behaviour)
    DM.ev('28+1:1', 'slide', 'camera glides to the photo wall', { sfx: 'whoosh', gain: -6 });
    DM.pops(sh, [['star', 'yellow', 1660, 250, 80, 8], ['sparkle', 'pink', 1700, 520, 56]], '28+1:3', beat / 2, { z: 12, gain: -9 });   // right of the wall (x 357..1563)
    // type on a die card (bottom left)
    DM.card(ty, { w: 820, hgt: 196, x: 520, y: 912, r: -2, z: 5 }).in('slap', '27:1', { big: 1.15, spin: -4, sfx: 'none', log: false });
    say(ty, 'T048', { x: 152, y: 905, r: -2, z: 8 });
    // (v2, owner 2026-10-07 「去掉那些说明性文字，这个产品必须是完整的」: v1's 「示例角色 · 自动回复」 stamp (T049) over the cast and
    // the 「照片为 AI 生成的示例图」 card are gone; the end card's one credits line carries the disclosure)
    DM.deco(ty, { kind: 'star', color: 'yellow', size: 88, x: 1745, y: 700, r: 12, z: 9 }).in('pop', '28:4', { sfx: 'ding', gain: -6, label: 'ding star' });
  }

  // ============================================================================================== A3 · A1-A4 · THE PHONE (L2) · 29:1 -> 36:1
  // P-05 (room + 「第一次来 1/4」 card -> upload form, 21:48, the AI chip), P-06 (the honest case, a fresh world), P-07 (save -> the wall
  // panel); X5 swaps.  (v2, owner 0b: v1's fixed 「照片为 AI 生成的示例图」 line over A3 is gone; the end card's credits line carries it)
  {
    const sh = DM.shot('A3-A-phone', '29:1', '36:1', { drift: null, enter: { kind: 'slap', dur: 0.14, big: 1.08, spin: -2, sfx: 'slap' } });
    const ty = DM.shot('A3-A-type', '29:1', '36:1', { paper: false, z: 30, drift: null, log: false });
    sh.pulse(bars(29, 35), 0.008, 0.1);
    const P05 = clip('P-05'), P06 = clip('P-06'), P07 = clip('P-07');
    // P-05 (rc.2): tap on 人海那张 = f63 on 29:3; the sheet settles by f76; the product jumps to the photo + AI chip at f77 = 31:3 (chime).
    // f76 is held 29:3.45 -> 31:3 (a real frame of the settled form; the AI's pre-selection 人海 ✓ is already visible, it is not staged
    // as "thinking"); after the jump the rig's tap ring finishes fading (f77-f89), then the static form f100 is held.
    const tF76 = Tc('29:3') + fr(76 - 63) / R, tF100 = Tc('31:3') + fr(100 - 77) / R;
    const feed = DM.seq(
      DM.play(P05, { at: '29:1', from: fromAt(63, '29:3', '29:1'), rate: R }),
      tF76, DM.play(P05, { at: tF76, from: fr(76), rate: 0 }),
      '31:3', DM.play(P05, { at: '31:3', from: fr(77), rate: R }),
      tF100, DM.play(P05, { at: tF100, from: fr(100), rate: 0 }),
      '33:3', DM.play(P06, { at: '33:3', from: fromAt(134, '33:4', '33:3'), rate: R }),     // P-06: 不确定 on 33:4, tap 舞台 on 34:3
      '35:1', DM.play(P07, { at: '35:1', from: fromAt(63, '35:2', '35:1'), rate: R }));     // P-07: tap 保存这张照片 on 35:2 -> the wall
    const full = { s: 1, x: 540, y: 1170 };
    // Measured rows (rc.2).  f76 (settled form, held): buttons 人海那张 / 舞台那张 y 651-793, polaroid x 84-519 y 853-1359, 拍摄于 21:48
    // x 550-883 y 980-1038, 来自照片自带的信息 x 540-882 y 1078-1113, 修改时间 y 1178-1214, 我拍的这一面 y 1457-1511, chips y 1553-1979.
    // f77+ (after the jump, = P-06 f134+): 拍摄于 y 374-432, X button y <= 350, chips 舞台 | 人海 ✓ y 947-1155 (x 89-517 | 550-985),
    // 身边 | 细节 y 1174-1373, AI chip x 76-578 y 1395-1520 (die-cut box 1383-1534), hint 「配对时用它找另一面，你说了算。」 y 1551-1587,
    // 可见范围 1686-1724, select 1759-1896, fine print 1934-1969, nav from 2034.
    // The lower form at x1.179 on f76: top edge y 355, between the eyebrow 「留一个现场瞬间」 (280-350) and 「这一张，由你决定给谁看。」 (from
    // 363); after the jump x1.18 puts the top edge at y 357, between the X button and 「拍摄于 21:48」, and keeps it there to 33:3 (x 79..995:
    // the whole form width — any closer crop would slice the second column of cards or the hint, so the beats get phone bumps and
    // lift-offs instead of in-phone punches, except 32:1 whose crop ends in the gap between the two columns)
    const form = { s: 1.1788, x: 540, y: 1347.5 }, after = { s: 1.18, x: 537, y: 1500 };
    const view = [
      ['29:1', full], ['30:1', full], ['30:4.5', { s: 1.06, x: 560, y: 1100 }, E.ioSine], ['30:4.75', full, E.outC],
      ['31:1', full], ['31:2', form, E.outC], ['31:3', after, E.ioSine], ['33:3', after],
      ...cutKey('33:3', after, full),
      // P-06 after its jump (f134+: the same layout as P-05 f77+): the whole form at x1.18, top edge y 357
      ['33:3.9', full], ['33:4', after, E.outC], ['34:4', after], ['34:4.5', full, E.outC],
      // P-07 (the form scrolled to 「保存这张照片」: 修改时间 + wavy line to 401, 我拍的这一面 610-664, chips 706-1132, AI chip 1154-1279,
      // hint 1310-1346 (x 91..643), select 1518-1655, fine print 1693-1728, save 1803-1962, nav 2034-2216): whole screen (a closer crop
      // would slice the hint or the second column); after the tap the wall panel at x1.16 (top 0, bottom 2017 in the stage photo,
      // x 75..1005: the title, 21:47, the note and the badge whole)
      ['35:2', full], ['35:2.5', { s: 1.16, x: 540, y: 1008 }, E.outC], ['36:1', { s: 1.18, x: 540, y: 991 }, E.ioSine],
    ];
    const ph = DM.phone(sh, { media: feed, x: 1452, y: 548, r: 2, w: 500, shadow: 'yellow', z: 6, view, label: 'phone A' });
    ph.show('29:1').drift('29:1', '36:1', { s: 1.025, y: -4 });
    DM.scrap(sh, { w: 700, hgt: 900, color: 'yellow', x: 1440, y: 560, r: -5, z: 1 }).show('29:1').out('cut', '33:3');
    DM.scrap(sh, { w: 680, hgt: 880, color: 'pink-soft', x: 1460, y: 560, r: 4, z: 1 }).in('slap', '33:3', { big: 1.1, spin: 6, sfx: 'slap', gain: -8, label: 'pink paper' }).out('cut', '35:1');
    DM.scrap(sh, { w: 690, hgt: 880, color: 'mint', x: 1450, y: 560, r: -3, z: 1 }).in('slap', '35:1', { big: 1.1, spin: -6, sfx: 'slap', gain: -8, label: 'mint paper' });
    // hide the rig's half-faded tap ring on the held frame f76 (centred on the finger, source (540, 1570), r ~90) with the same pixels
    // from P-05 f239 (the settled form after the jump, scrolled 606 px further: matched to 0.6 grey levels), decoded by the same server
    // path as the footage: dst (400..680, 1440..1710) <- src y - 606
    patch(sh, ph, { url: P05.url(239), sx: 400, sy: 1440 - 606, sw: 280, sh: 270, dx: 400, dy: 1440, label: 'tap ring on the held f76' }).show(tF76, '31:3');
    // (v3) after the jump (f77-f89) the same ring keeps fading in the same place, now over 「你说了算。」 under the AI chip (inside the 31:3
    // punch): f77-f99 have the layout of f100 (mean difference 0.04 grey levels outside the ring), so f100 covers it until the hold
    patch(sh, ph, { url: P05.url(100), sx: 400, sy: 1440, sw: 280, sh: 270, dx: 400, dy: 1440, label: 'fading tap ring f77-f89' }).show('31:3', tF100);
    // the same for P-06: the ring of the tap on 「舞台那张」 fades f134-f146 over 「可见范围」 (centre ~(340, 1730)) after the product's
    // jump on 33:4; f160 has the same layout
    patch(sh, ph, { url: P06.url(160), sx: 205, sy: 1595, sw: 280, sh: 270, dx: 205, dy: 1595, label: 'fading tap ring P-06 f134-f146' }).show('33:4', Tc('33:4') + fr(13) / R);
    ph.pulse(['31:3', '34:1'], 0.035, 0.09);          // the AI's two answers land with a bump of the phone

    // ---- A1 (29-30): room -> upload form -> 拍摄于 21:48 · 来自照片自带的信息
    // 29:1.5 the onboarding card on the phone (「第一次来 1/4」, title 「放一张今晚的照片」 x 125-545, y 1380-1452) says the title's own words
    z0(DM.underline(sh, { on: ph, x0: 118, x1: 548, y: 1470, at: '29:1.5', dur: beat * 0.4, color: 'mint', width: 11, erase: '29:3', label: 'underline 放一张今晚的照片 on the onboarding card', gain: -8 }));
    z0(DM.circle(sh, { on: ph, x: 532, y: 1570, rx: 470, ry: 92, at: '29:2', dur: beat * 0.6, color: 'pink', width: 9, erase: '29:3', label: 'circle 人海那张' }));
    tapAt('29:3', 'tap 人海那张');
    DM.ev('29:4', 'slide', 'upload form slides up', { sfx: 'shutter', gain: -6 });
    {   // the build's own photo 「人海那张」 (demo/sample-crowd.jpg, byte-identical in rc.2) slaps onto the paper on the tap and flies into
        // the form's polaroid (f76: frame x 84..519, y 853..1359 -> 181 px wide on screen at x1)
      const P0 = [615, 760], t294 = Tc('29:4'), dur = beat * 0.75;
      const pol = DM.polaroid(sh, { src: 'photo:sample-crowd', w: 340, hgt: 425, x: P0[0], y: P0[1], r: -6, z: 9, tape: 'y', tapeW: 150, label: 'the photo flies in' })
        .in('slap', '29:3', { big: 1.3, spin: -8, sfx: 'slap', gain: -4 });
      pol.t1 = t294 + dur;
      pol.track(t => { const k = E.ioC(DM.clamp((t - t294) / dur)); if (k <= 0) return null;
        const [tx, ty] = ph.toWorld(t, 301, 1106);
        return { x: (tx - P0[0]) * k, y: (ty - P0[1]) * k, s: DM.lerp(1, 0.533, k), r: 8 * k, o: 1 - E.inQ(DM.clamp((k - 0.7) / 0.3)) }; });
      DM.ev('29:4', 'slide', 'the photo flies into the form', { sfx: 'swish', gain: -8 });
    }
    // 30:1 punch onto 「拍摄于 21:48 · 来自照片自带的信息」 (x2.4: x 535..985, y 800..1775 — the time row, 来自照片自带的信息, 修改时间 and the
    // 人海 ✓ card the AI already picked; edges in the blank rows/columns clear of the polaroid, the photo buttons and the 舞台 card)
    ph.punch('30:1', { s: 2.4, x: 760, y: 1288 }, { until: '30:4.5', sfx: 'thump', label: 'punch: 拍摄于 21:48 · 来自照片自带的信息' });
    z0(DM.underline(sh, { on: ph, x0: 548, x1: 885, y: 1052, at: '30:1.5', dur: beat * 0.5, color: 'pink', width: 8, erase: '30:4.5', label: 'underline 21:48' }));
    // (v3) 30:3 the product's own words for 「照片自己记得」: a mint line under 「来自照片自带的信息」
    z0(DM.underline(sh, { on: ph, x0: 538, x1: 886, y: 1128, at: '30:3', dur: beat * 0.5, color: 'mint', width: 8, erase: '30:4.5', label: 'underline 来自照片自带的信息', gain: -6 }));
    // (v3) 「放一张今晚的照片。」 is 8 units (needs 2.0 s, a bar is 1.95 s): it stays to 30:1.5 and 「21:48」 + 「拍摄时间，照片自己记得。」
    // answer the 30:1 punch on the "and"; the column keeps that 8th to the end of the section: 「21:48」 leaves on 31:1.5, where
    // 「拍的是哪一面？」 enters under 「拍摄时间，…」 as it steps up (SCRIPT.md 2026-10-08).  The column is clear of the flying photo (P0 y 760)
    say(ty, 'T050', { x: 120, y: 330, text: '放一张\n今晚的照片。', until: '30:1.5', outFx: 'cut' });
    say(ty, 'T051', { x: 120, y: 300, at: '30:1.5', until: '31:1.5', outFx: 'cut' });
    say(ty, 'T052', { x: 120, y: 620, at: '30:1.5' }).move(jumpAt('31:1.5'), jumpAt('31:1.5') + 0.0005, { y: -282 }, E.lin);   // jumps up when 21:48 leaves: 「拍的是哪一面？」 enters under it
    // (v2, owner 0b: v1's chip 「示例照片 · 拍摄时间为虚构」 (T053) is gone; rc.2 has no sample note on the form any more)
    // ---- A2 (31-33): 拍的是哪一面？ -> the AI chip on the chime -> 人海。 -> AI 在本机判断，照片不上传
    say(ty, 'T054', { x: 120, y: 650, at: '31:1.5' });
    // v2: the chime's bell sits on 31:3 (its glock run starts 0.18 s before it; rhythm #5: v1's bell landed at 31:3.39)
    DM.sfx(Tc('31:3') - 0.18, 'chime', { gain: 0 });
    DM.ev('31:3', 'cut', 'AI chip on screen (product jump)', { sfx: 'none' });
    // 31:3 the chime: the product's own jump brings the chip on screen (a phone bump, no crop: see `form`); 31:3.5 a pink loop round
    // it; 31:4 it lifts off onto the paper
    z0(DM.circle(sh, { on: ph, x: 327, y: 1458, rx: 285, ry: 82, at: '31:3.5', dur: beat * 0.5, color: 'pink', width: 10, label: 'circle AI 判断：人海', erase: '32:1' }));
    DM.pops(sh, [['sparkle', 'yellow', 1185, 600, 66], ['sparkle', 'pink', 1240, 420, 48], ['star', 'yellow', 1215, 790, 58, -10]], '31:3', beat / 4, { z: 12, gain: -9 });
    // 32:1 「人海。」 + the phone punches onto the card the AI pre-selected (人海 ✓, x 550..985, y 947..1155): x2.46 = x 538..977,
    // y 441..1392 — from 「来自照片自带的信息」 (under the yellow band of 拍摄于) down to 细节, the bottom edge just above the chip (which is up
    // on the paper as a sticker; the card runs off the right edge rather than a glyph being cut on the left)
    ph.punch('32:1', { s: 2.085, x: 757.5, y: 916.6 }, { until: '33:1', sfx: 'none', label: 'punch on the pre-selected 人海 ✓ card (the XXL slam carries the hit)' });
    DM.pops(sh, [['sparkle', 'mint', 1690, 455, 54], ['star', 'pink', 1225, 300, 50, 12]], '32:1.5', beat / 2, { z: 12, gain: -10 });
    {   // 31:4 the product's own chip 「✦ AI 判断：人海」 (CUT-04a: the same element, cut out of the build at the phone's DPR) lifts off the
        // screen as a big sticker; 32:1 it moves up to make room for 「人海。」; 33:1 it pops out
      const W = 500, P1 = [450, 470], P2 = [380, 175], t314 = Tc('31:4'), t321 = Tc('32:1');
      const chip = DM.sticker(sh, { src: RC2['CUT-04a'], w: W, x: P1[0], y: P1[1], r: -4, z: 22, label: 'AI chip sticker' })
        .in('pop', '31:4', { sfx: 'pop', note: 5, label: 'AI chip lifts off the phone' }).out('pop', '33:1');
      chip.track(t => {
        const k = E.outBack(DM.clamp((t - t314) / 0.22), 1.4), m = E.outC(DM.clamp((t - t321) / 0.2));
        const [fx, fy] = ph.toWorld(t, 327, 1458); const s0 = 502 * (ph.sw0 / 1080) * ph.viewAt(t).s / W;
        return { x: (fx - P1[0]) * (1 - k) + (P2[0] - P1[0]) * m, y: (fy - P1[1]) * (1 - k) + (P2[1] - P1[1]) * m, s: DM.lerp(s0, 1, k) * (1 - 0.18 * m), r: 4 * (1 - k) + 2 * m };
      });
      DM.deco(sh, { kind: 'burstline', color: 'yellow', size: 170, x: P1[0] + 250, y: P1[1] - 70, r: 10, z: 21, lw: 1.3 }).in('pop', '31:4', { sfx: 'none', label: 'burst lines' }).out('pop', '32:1');
    }
    // v2: a yellow marker ring around 「人海。」 instead of a starburst (the burst is kept for 5:1 / 21:1 / 51:1; review art #4)
    z0(DM.circle(ty, { x: 455, y: 448, rx: 400, ry: 150, tilt: -3, at: '32:1.25', dur: beat * 0.55, color: 'yellow', width: 18, z: 4, erase: '32:4.25', edur: 0.08, sfx: 'squeak', gain: -6, label: 'ring 人海' }));
    // v2 privacy staging (review art #2, read #1, truth #2 — must-fix): 「人海。」 leaves on 32:4.5; 「AI 在本机判断，」 types on 32nds
    // (done by 32:4.1) and steps up on 32:4.5 so 「照片不上传。」 lands on clear paper under it (33:1); the two halves stay together and
    // leave together on 34:1; the padlock sits by 「AI 在本机判断」; 「没把握的时候，」 types in UNDER the pair on 33:3 and moves up to the
    // top of the column when they leave, where 「AI 就说不确定。」 continues it — the column never reads 「没把握的时候，照片不上传。」
    say(ty, 'T055', { x: 125, y: 440, z: 6, until: '32:4.25' });
    say(ty, 'T056', { x: 125, y: 750, step: beat / 8, until: '34:1', outFx: 'cut' }).move('32:4.5', Tc('32:4.5') + 0.2, { y: -235 }, E.outBack);
    say(ty, 'T057', { x: 120, y: 650, outFx: 'cut' });
    DM.deco(ty, { kind: 'lock', color: 'ink', size: 84, x: 735, y: 512, r: 8, z: 7, lw: 1.2 }).in('pop', '33:2', { sfx: 'click', gain: -4, label: 'padlock (AI 在本机判断)' }).out('pop', '34:1');
    // (v3) the product says 「AI 在本机判断，照片不上传」 on the AI chip itself now (its tooltip; the hint under it reads 「配对时用它找另一面，
    // 你说了算。」), so the line points at the chip: a mint loop round 「✦ AI 判断：人海」 while 「照片不上传。」 is up (v2 highlighted the old hint)
    z0(DM.circle(sh, { on: ph, x: 327, y: 1458, rx: 290, ry: 84, tilt: 2, at: '33:1.5', dur: beat * 0.5, color: 'mint', width: 10, erase: '33:3', edur: 0.08, label: 'mint loop AI 判断：人海 (AI 在本机判断)', gain: -6 }));
    // ---- A3 (33:3-35): the honest case
    say(ty, 'T058', { x: 120, y: 862 }).move(jumpAt('34:1'), jumpAt('34:1') + 0.0005, { y: -662 }, E.lin);   // jumps to the top on the downbeat (no crossing)
    // the onboarding card's 「舞台那张」 (P-06 f105: x 122..519, y 1676..1796); gone before the product's jump on 33:4
    z0(DM.circle(sh, { on: ph, x: 320, y: 1736, rx: 230, ry: 80, at: '33:3', dur: beat * 0.4, color: 'pink', width: 9, erase: '33:3.875', edur: 0.06, label: 'circle 舞台那张' }));
    tapAt('33:3.5', 'tap 舞台那张');
    DM.sfx('33:4', 'hmm', { gain: -2 });
    DM.ev('33:4', 'cut', '不确定，请选择 on screen (product jump)', { sfx: 'none' });
    // 「✦ 不确定，请选择」 (P-06 f150: x 89..588, y 1402..1513)
    z0(DM.circle(sh, { on: ph, x: 338, y: 1457, rx: 300, ry: 80, at: '34:1', dur: beat * 0.7, color: 'pink', width: 9, dash: [16, 13], erase: '34:3', label: 'dashed circle 不确定' }));
    // (v3) no in-phone punch on 34:1 (v2's x1.59 sliced the dashed 人海 card — the AI's second suggestion — in half): the phone bumps,
    // the dashed loop draws, and on 34:2 the product's own unsure chip (CUT-04u: the same element cut out of the build, 526 x 138, at
    // (76, 1389) on P-06 f134+) lifts off onto the paper under 「AI 就说不确定。」 — the same lift-off as 「AI 判断：人海」 on 31:4
    DM.ev('34:1', 'punch', 'phone bump: 不确定，请选择', { sfx: 'thump', gain: -4 });
    {
      const W = 470, P1 = [440, 578], t342 = Tc('34:2');
      const un = DM.sticker(sh, { src: RC2['CUT-04u'], w: W, x: P1[0], y: P1[1], r: 3, z: 22, label: 'unsure chip sticker' })
        .in('pop', '34:2', { sfx: 'pop', note: -3, label: 'unsure chip lifts off the phone' }).out('cut', '35:1');
      un.track(t => { const k = E.outBack(DM.clamp((t - t342) / 0.22), 1.4);
        const [fx, fy] = ph.toWorld(t, 339, 1458); const s0 = 526 * (ph.sw0 / 1080) * ph.viewAt(t).s / W;
        return { x: (fx - P1[0]) * (1 - k), y: (fy - P1[1]) * (1 - k), s: DM.lerp(s0, 1, k), r: -1 * (1 - k) }; });
    }
    // (v3, review art #7: the Display face draws 它 like 已/巳 — the subject is named: 「AI 就说不确定。」, SCRIPT.md 2026-10-08)
    say(ty, 'T059', { x: 120, y: 425, text: 'AI 就说⟦不确定⟧。' });
    tapAt('34:3', 'tap 舞台');
    say(ty, 'T060', { x: 150, y: 765, r: -4, outFx: 'cut' });   // v2: cut on 35:3; v3: under the lifted chip
    // your choice: a mint loop around the product's own 「舞台 ✓」 (P-06 after the tap: x 130..295, y 995..1045)
    z0(DM.circle(sh, { on: ph, x: 212, y: 1020, rx: 132, ry: 56, tilt: -3, at: '34:3.5', dur: beat * 0.45, color: 'mint', width: 10, label: 'loop 舞台 ✓ (your choice)', gain: -6, erase: '35:1' }));
    // ---- A4 (35): save -> the wall panel.  (v3, review read #9: 「保存，上墙。」 enters under 「你来选。」 and stays there — v2 moved it
    // 300 px up mid-read on 35:3)
    say(ty, 'T061', { x: 120, y: 925 });
    tapAt('35:2', 'tap 保存这张照片');
    DM.ev('35:2', 'slide', 'wall panel', { sfx: 'whoosh', gain: -6 });
    // the wall panel's title 「这一晚，大家看到了什么？」 (P-07 f64+ = P-08 f150: x 93..750, y 363..433)
    z0(DM.underline(sh, { on: ph, x0: 90, x1: 755, y: 452, wavy: true, amp: 6, wl: 50, at: '35:3', dur: beat * 0.6, color: 'pink', width: 8, label: 'wavy 这一晚，大家看到了什么？' }));
    DM.pops(sh, [['star', 'pink', 1180, 260, 70, -12], ['sparkle', 'mint', 1735, 120, 52]], '35:4', beat / 2, { z: 12, gain: -9 });
  }

  // ============================================================================================== A3 · A4 · THE 3D WALL (L4) · 36:1 -> 37:1
  {
    const sh = DM.shot('A3-A4-wall', '36:1', '37:1', { drift: null, cam: [['36:1', { x: 0, y: 0, s: 1.0 }], ['37:1', { x: 0, y: -6, s: 1.03 }, E.ioSine]] });
    const ty = DM.shot('A3-A4-type', '36:1', '37:1', { paper: false, z: 30, drift: null, log: false });
    sh.pulse(['36:1', '36:3'], 0.012, 0.1);
    const Da = clip('D-03a'), Db = clip('D-03b');
    const feed = DM.seq(DM.play(Da, { at: '36:1', from: 0.5 }), '36:3', DM.play(Db, { at: '36:3', from: 0.5 }));
    // The product frames five photos wider than four (D-03a: one row under the sign 「同一晚，另一面。」, polaroids ~440 master px, the four
    // at x 1023..2823, y 846..1405; D-03b: 3 + 2, ~240 px, cluster x 1479..2343, y 483..1383).  (v3, review art #12: the wall is no
    // longer shown whole) 36:1 punches in x1.55 on the four (sign + polaroids, the context bar 「同一场，不同视角 · 看照片 · 4 · 放一张」 out
    // of frame); the after-view at x2.25 of the 4K master (~1:1) keeps the room's guitar (x <= 1110) out: "the wall made room for one more".
    const desk = DM.desk(sh, { media: feed, w: 1800, x: 960, y: 532, z: 4, srcW: 3840, srcH: 2160, label: 'desk 3D wall',
      view: [['36:1', { s: 1.55, x: 1915, y: 925 }], ...cutKey('36:3', { s: 1.6, x: 1915, y: 925 }, { s: 2.25, x: 1995, y: 930 }), ['37:1', { s: 2.3, x: 1998, y: 932 }, E.ioSine]] });
    desk.show('36:1');
    // your polaroid (人海那张, bottom right of the five; D-03b master px 1929-2171 x 1046-1383)
    z0(DM.circle(sh, { on: desk, x: 2050, y: 1203, rx: 166, ry: 196, tilt: -4, at: '36:3', dur: beat * 0.45, color: 'pink', width: 9, sfx: 'none', label: 'circle your polaroid' }));
    const star = DM.deco(sh, { kind: 'star', color: 'yellow', size: 110, x: 0, y: 0, z: 12 }).in('pop', '36:3', { sfx: 'pop', label: 'star: your polaroid' });
    star.track(t => { const [x, y] = desk.toWorld(t, 2190, 1040); return { x, y }; });
    DM.sfx('36:3', 'tape', { gain: -6 });
    // the note on a die card in the empty wall to the upper right of the cluster, its arrow down to your polaroid
    DM.card(ty, { w: 430, hgt: 150, x: 1625, y: 455, r: 3, z: 5 }).in('slap', '36:3', { big: 1.15, spin: 5, sfx: 'none', log: false });
    say(ty, 'T062', { x: 1376, y: 452, r: -4, z: 8, fx: 'POP', size: 96, color: '#e9396b', style: { webkitTextStroke: '1.5px var(--ink)', paintOrder: 'stroke fill' } });   // v2 (read #8)
    DM.arrow(ty, { from: [1470, 548], to: () => { const t = tStep(); const [x, y] = sh.toScreen(t, ...desk.toWorld(t, 2185, 1150)); return [x + 14, y - 4]; }, bend: -0.25, at: '36:4', dur: beat * 0.6, color: 'pink', width: 8, z: 9, label: 'arrow to the new polaroid' });
  }

  // ============================================================================================== A3 · A5 · THE RULE (L2) · 37:1 -> 41:1
  {
    const sh = DM.shot('A3-A5-phone', '37:1', '41:1', { drift: null, enter: { kind: 'slap', dur: 0.14, big: 1.08, spin: 2, sfx: 'slap' } });
    const ty = DM.shot('A3-A5-type', '37:1', '41:1', { paper: false, z: 30, drift: null, log: false });
    sh.pulse(bars(37, 40), 0.008, 0.1);
    const P08 = clip('P-08');
    // the first wall screen (rc.2: no pipeline ribbon, 107 px higher than rc.1): rows 「这一晚，大家看到了什么？」 363-433 (x 93-750),
    // 21:47 519-627 (x 88-334) + chip 同一刻, 「3 个视角：舞台 · 人海 · 细节」 666-713, 「↗ 3 分钟内拍下」 763-798 (x 174-396), badge card
    // 890-1487 (x 98-956 with its tape), stage photo from 1500, nav 2034-2216, footer 2254-2306
    const feed = DM.play(P08, { at: '37:1', from: fr(150), rate: 0 });
    // 37:1-39:3 the group, pushing x1.34 -> x1.40 with the left edge held at x 82 (21:47 from 88, the title from 93) and the top at 0
    // (bottom 1746 -> 1671, in the stage photo); the right edge (888 -> 854) cuts only shapes (the badge card's border, the ··· icon),
    // every line ends left of it (the reason 「同一刻 · 21:47，相差不到 1 分钟；」 at 781).  39:3-40:1 down to the badge: x1.41 with the
    // top at 345 (between the eyebrow and the title) and the bottom at 2000 (in the photo, above the nav, whose buttons run edge to edge)
    const view = [
      ['37:1', { s: 1.34, x: 485, y: 830 }], ['38:1', { s: 1.37, x: 476, y: 830 }, E.ioSine], ['39:3', { s: 1.40, x: 468, y: 830 }, E.ioSine],
      ['40:1', { s: 1.4139, x: 467, y: 1172.5 }, E.ioC], ['41:1', { s: 1.42, x: 467, y: 1173 }, E.ioSine],
    ];
    const ph = DM.phone(sh, { media: feed, x: 1452, y: 548, r: 2, w: 500, shadow: 'mint', z: 6, view, label: 'phone A5' });
    ph.show('37:1').drift('37:1', '41:1', { s: 1.025, y: -4 });
    DM.scrap(sh, { w: 690, hgt: 880, color: 'yellow', x: 1455, y: 560, r: 4, z: 1 }).show('37:1');
    // 37:3 21:47 underlined · 38:1 the group header + note lift off · 38:3 highlighter over 3 分钟内拍下 · 39:3 back · 40:1 the badge lifts
    z0(DM.underline(sh, { on: ph, x0: 84, x1: 340, y: 645, at: '37:3', dur: beat * 0.5, color: 'yellow', width: 11, label: 'underline 21:47' }));
    // the real group header + note (WALL-01: the same UI cut out at the phone's DPR, 577 x 306, centre on P-08 f150 = (364.5, 659))
    const LW = 740, LS = (LW - 44) / 577, LX = 1385, LY = 650, t381 = Tc('38:1'), t393 = Tc('39:3');
    // 37:2-37:3 three real cards of that group (the build's own wall cards: 小满 21:48, yours 21:48 「AI 建议，未改动」, 北屿 21:49)
    // slap onto the paper; 37:3.5-37:4 their shooting times get a highlighter; on the "and" of 4 they fly back into the phone (the group),
    // and on 38:1 the header + note that grouped them lift out of it
    const CW = 270, CH = Math.round(CW * 936 / 483), CK = CW / 483, t3745 = Tc('37:4.5');
    [['POL-03', 285, 650, -7], ['POL-04', 535, 628, 2], ['POL-05', 785, 655, 8]].forEach(([id, x, y, r], i) => {
      const c = DM.div(sh, { w: CW, hgt: CH, x, y, r, z: 14 + i, label: 'wall card ' + id,
        html: `<img decoding="sync" src="${DM.asset(RC2[id])}" style="width:${CW}px;height:${CH}px;display:block">` });
      c.in('slap', `37:${2 + i * 0.5}`, { big: 1.25, spin: i % 2 ? 8 : -8, sfx: 'slap', gain: -6, note: i * 2, label: 'wall card ' + id });
      z0(DM.highlight(sh, { parent: c, x: 46 * CK, y: 584 * CK, w: 228 * CK, hgt: 48 * CK, at: `37:${3.5 + i * 0.25}`, dur: beat * 0.3, color: 'yellow', opacity: 0.75, z: 3, label: 'hl time ' + id, gain: -6 }));
      const t0 = t3745 + i * 0.02, d = 0.2; c.t1 = t0 + d;
      c.track(t => { const k = E.inC(DM.clamp((t - t0) / d)); if (k <= 0) return null; const [tx, ty] = ph.toWorld(t, 420, 640);
        return { x: (tx - x) * k, y: (ty - y) * k, s: 1 - 0.8 * k, r: -r * k, o: 1 - k * k }; });
    });
    DM.ev('37:4.5', 'slide', 'the three cards fly into the phone', { sfx: 'swish', gain: -8 });
    const lift = DM.cutout(sh, { src: RC2['WALL-01'], w: LW, hgt: 'auto', x: LX, y: LY, r: -3, z: 20, label: 'WALL-01 lifted' });
    lift.t0 = t381; lift.t1 = t393 + 0.12;
    lift.track(t => {
      const k = E.outBack(DM.clamp((t - t381) / 0.2), 1.5), back = E.inQ(DM.clamp((t - t393) / 0.12));
      const [fx, fy] = ph.toWorld(t, 364.5, 659); const kk = k * (1 - back);
      const s0 = 577 * (ph.sw0 / 1080) * ph.viewAt(t).s / (LW - 44);
      return { x: (fx - LX) * (1 - kk), y: (fy - LY) * (1 - kk), s: DM.lerp(s0, 1, kk), r: 3 * (1 - kk) };
    });
    DM.ev('38:1', 'slap', 'the group header + note lift off the phone', { sfx: 'slap', gain: -2 });
    DM.ev('39:3', 'slide', 'the group header drops back', { sfx: 'swish', gain: -8 });
    // 「3 分钟内拍下」 on WALL-01: x 98..320, y 256..292 (die-cut px)
    z0(DM.highlight(sh, { parent: lift, x: 22 + 90 * LS, y: 22 + 249 * LS, w: 238 * LS, hgt: 50 * LS, at: '38:3', dur: beat * 0.6, color: 'yellow', opacity: 0.8, z: 3, label: 'hl 3 分钟内拍下' }));
    // 40:1 the badge card lifts out of the phone as a callout (CUT-05: the same element cut out at the phone's DPR; source box on
    // P-08 f150 = x 98..956, y 891..1487, centre (527, 1189)); 40:2 its pill gets a pink circle; 40:3 the note's arrow points at it
    const BW = 740, BK = (BW - 44) / 858, BX = 585, BY = 650, t401 = Tc('40:1');
    const badge = DM.cutout(sh, { src: RC2['CUT-05'], w: BW, hgt: 'auto', x: BX, y: BY, r: -3, z: 20, label: 'badge callout' });
    badge.t0 = t401;
    badge.track(t => { const k = E.outBack(DM.clamp((t - t401) / 0.22), 1.4); const [fx, fy] = ph.toWorld(t, 527, 1189);
      const s0 = 858 * (ph.sw0 / 1080) * ph.viewAt(t).s / (BW - 44);
      return { x: (fx - BX) * (1 - k), y: (fy - BY) * (1 - k), s: DM.lerp(s0, 1, k), r: 5 * (1 - k) }; });
    DM.ev('40:1', 'slap', 'the badge lifts out of the phone', { sfx: 'slap', gain: -2 });
    DM.ev('40:1', 'punch', 'badge callout', { sfx: 'thump', gain: -6 });
    z0(DM.circle(sh, { parent: badge, x: 22 + 224 * BK, y: 22 + 110 * BK, rx: 250 * BK, ry: 92 * BK, at: '40:2', dur: beat * 0.6, color: 'pink', width: 10, z: 5, label: 'circle 同一刻的另一面' }));
    say(ty, 'T063', { x: 120, y: 215 });
    // (v3) 「3 分钟内拍下，」: the product's own words (the wall's group note, highlighted on the lifted card on 38:3; SCRIPT.md 2026-10-08)
    say(ty, 'T065', { x: 120, y: 450, outFx: 'cut', text: '⟦3 分钟⟧内拍下，' });          // v2: cut on 39:1
    say(ty, 'T064', { x: 120, y: 690 });
    // v2: the stamp lands under 「就是同一刻。」 (39:1; v1 put it above, where 「3 分钟以内，」 had been: the column read out of order) and
    // carries the column until 40:1; an opaque label like the hook's stamps
    say(ty, 'T066', { x: 592, y: 872, ax: 0.5, r: 6, style: { background: 'var(--card)', color: '#13806a', webkitMaskSize: '900px 450px', maskSize: '900px 450px', boxShadow: '4px 5px 0 rgba(28,27,26,.9)' } });
    say(ty, 'T067', { x: 150, y: 235, r: -4, size: 96, color: '#e9396b', style: { webkitTextStroke: '1.5px var(--ink)', paintOrder: 'stroke fill' } });
    DM.arrow(ty, { from: [430, 250], to: [598, 375], bend: -0.35, at: '40:3', dur: beat * 0.5, color: 'pink', width: 8, z: 9, label: 'arrow to the badge' });
    DM.pops(sh, [['sparkle', 'pink', 990, 330, 60], ['star', 'yellow', 1000, 880, 70, 10], ['sparkle', 'yellow', 170, 820, 52]], '40:2.5', beat / 2, { z: 22, gain: -9 });
  }
  DM.wipe('W-A3-A4', '40:4.5', '41:1', { colors: ['pink', 'yellow'] });
})();
