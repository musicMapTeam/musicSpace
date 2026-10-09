/* Music Space · Doodle video — THE FILM: the master timeline that strings the five act files together, in story order, on one page.
 *
 *   out/film-v3.sh [map] [name]                                                         (render + mix + QC + contact sheets; v3 default)
 *   node out/tools/render-film.mjs --scene film --map flipping-in-b --video out/music-space-video-v3.mp4 --mix --target-mb 150-300
 *   http://127.0.0.1:<port>/dm/stage.html?map=flipping-in-b&scene=film&preview=1        (scrub / play with the music)
 *
 * Load it ALONE (`scene=film`): it installs the film-level patches, then runs every act file synchronously in order (each act is an
 * IIFE written in storyboard bar:beat, see README.md), then checks and stitches the seams.  What belongs to the film and to no act:
 *   1. FOOTAGE PROVENANCE (v3, 2026-10-08): the film is cut on the 0.22.0-rc.2 build only (the owner's 10-07 copy revision).  The acts
 *      address their captures by explicit rc.2 path; the few shared ids that still resolve outside the rc.2 captures are re-routed
 *      here before any act runs (section 1), and section 4e checks that every picture the page loads comes from the rc.2 captures,
 *      the v3 crops (prod/assets/v3), the rc.2 build itself (/tmp/space-final/dist-pages) or the film's own QR.
 *   2. THE BAR GRID: the acts must tile 1:1 -> 91:1 (the map's tail belongs to the last act).  Every act's shots must start inside its
 *      own bars; a shot may run past its act's end only as a transition (a wipe that reveals on the next act's first downbeat).
 *   3. SEAMS: one transition per boundary, owned by the outgoing act (README rule 1); no title of one act may still be readable when
 *      the next act's first title lands, no script line may be said twice at the same time, the visual-event rhythm must not stall
 *      across the cut (checked below, reported in DM.film and as DM.warn when broken).
 *   4. ON-SCREEN DUTIES NO ACT OWNS: none since v2 (the owner removed the explanatory tags; section 3 below).
 *   5. MARKS for the tools: DM.mark('act:<id>', start) so contact sheets and the QC can label acts.
 *   6. BED AUTOMATION for the mix (section 3b; out/tools/mix-film.py).
 * Nothing here changes an act's choreography; patches are listed in DM.film.patches (render-film.mjs --info stores DM.film).
 * v1/v2 history: out/work/v3/film.v2-backup.js (v2 aliased 'D-01' to the rc.1 landing still; A0-A1 v3 plays the rc.2 4K landing clip
 * by path, so that alias is gone).
 */
(() => {
  'use strict';
  const ACTS = [
    { id: 'act-A0-A1', from: '1:1', to: '21:1', name: 'A0 HOOK 钩子 + A1 PAIN 痛点' },
    { id: 'act-A2-A3', from: '21:1', to: '41:1', name: 'A2 ENTER 入场 + A3 PHOTO + AI 照片与端侧 AI' },
    { id: 'act-A4', from: '41:1', to: '55:1', name: 'A4 SAME MOMENT + EXCHANGE 同一刻与交换' },
    { id: 'act-A5', from: '55:1', to: '73:1', name: 'A5 AFTER THE SWAP 交换之后' },
    { id: 'act-A6-A7', from: '73:1', to: '91:1', name: 'A6 WHY IT MATTERS 为什么值得做 + A7 END CARD 片尾' },
  ];
  const FILM = DM.film = { acts: [], patches: [], seams: [], checks: [] };
  const already = new Set((DM.scenes || []).filter(s => s !== 'film'));
  if (already.size) DM.warn('film.js must be loaded alone (scene=film); acts already on the page: ' + [...already].join(', '));

  // ------------------------------------------------------------------ 1. film-level asset routing (before any act runs)
  // v3 (2026-10-08): ids an act still asks for that tools/serve.mjs would resolve OUTSIDE the rc.2 material (dm/assets.json aliases):
  //   photo:*   the build's demo photos -> the rc.2 build's own files (byte-identical to the dist-pages copies the aliases point at;
  //             checked with cmp 2026-10-08), so the asset log names the build being filmed
  //   avatar:*  the probe's avatar SVGs (exported 10-07 05:15 from an earlier build) -> the rc.2 build's avatar exports.  This is a real
  //             continuity fix, not only provenance: A4 (52:1) asked for 'avatar:you' = the probe's look-4 失真 front view, drawn with
  //             another skin tone (#e7b68e) than the visitor 阿宁 that A1 (P3), A5 and A6-A7 (W4, end card) take from
  //             capture/P2P3-rc2/avatars (#f6dbc0) — the same person would change colour at the payoff.  'avatar:yao' / 'man' / 'bei'
  //             are the quarter views (the probe files draw the same paths as the rc.2 quarter exports; only their metadata differ).
  const RC2_BUILD = '/tmp/space-final/dist-pages/demo/', AV = 'capture/P2P3-rc2/avatars/svg/';
  const ALIAS = {
    'photo:sample-crowd': RC2_BUILD + 'sample-crowd.jpg', 'photo:yao-stage': RC2_BUILD + 'yao-stage.jpg', 'photo:sample-stage': RC2_BUILD + 'sample-stage.jpg',
    'photo:man-crowd': RC2_BUILD + 'man-crowd.jpg', 'photo:man-near': RC2_BUILD + 'man-near.jpg', 'photo:bei-balcony': RC2_BUILD + 'bei-balcony.jpg',
    'avatar:you': AV + 'visitor-aning-shizhen-front.svg', 'avatar:you-quarter': AV + 'visitor-aning-shizhen-quarter.svg',
    'avatar:yao': AV + 'cast-yao-quarter.svg', 'avatar:man': AV + 'cast-man-quarter.svg', 'avatar:bei': AV + 'cast-bei-quarter.svg',
  };
  // DM.asset returns names that start with '/' untouched (a URL path), so absolute file paths go through the resolver (/a/<path>) here
  const viaResolver = p => { DM.used.assets.add(p); return '/a/' + encodeURIComponent(p); };
  const asset0 = DM.asset;
  const routed = new Set();
  DM.asset = name => {
    if (typeof name !== 'string' || !ALIAS[name]) return asset0(name);
    routed.add(name); const p = ALIAS[name];
    return p.startsWith('/') ? viaResolver(p) : asset0(p);
  };
  const clip0 = DM.clip;
  DM.clip = (name, o) => clip0((typeof name === 'string' && ALIAS[name]) || name, o);

  // ------------------------------------------------------------------ 2. run the acts in order (synchronously: stage.html waits only for this file)
  const fetchSync = url => { const x = new XMLHttpRequest(); x.open('GET', url, false); x.send(null); if (x.status !== 200) throw new Error(`film: ${url} -> HTTP ${x.status}`); return x.responseText; };
  for (const act of ACTS) {
    if (already.has(act.id)) continue;
    const n0 = { shots: DM.shots.length, events: DM.events.length, texts: DM.textNodes.length };
    const errors = []; const onErr = e => errors.push(String(e.message || e));
    window.addEventListener('error', onErr);
    const el = document.createElement('script');
    el.text = fetchSync('/scenes/' + act.id + '.js') + '\n//# sourceURL=/scenes/' + act.id + '.js';
    el.dataset.act = act.id;
    document.body.appendChild(el);                     // an inline script runs synchronously when inserted
    window.removeEventListener('error', onErr);
    if (errors.length) throw new Error(`film: ${act.id} failed: ${errors.join(' | ')}`);
    const shots = DM.shots.slice(n0.shots);
    for (const sh of shots) sh.act = act.id;
    for (const n of DM.textNodes.slice(n0.texts)) n.act = act.id;
    for (const e of DM.events.slice(n0.events)) e.act = act.id;
    FILM.acts.push({ id: act.id, name: act.name, from: act.from, to: act.to, t0: DM.Tc(act.from), t1: act.to === '91:1' ? DM.end() : DM.Tc(act.to),
      shots: shots.map(s => s.id), events: DM.events.length - n0.events, texts: DM.textNodes.length - n0.texts });
    DM.mark('act:' + act.id, act.from);
  }
  DM.scenes = ['film', ...ACTS.map(a => a.id)];
  for (const a of [...routed].sort()) FILM.patches.push(`asset routing ${a} -> ${ALIAS[a]}`);

  // ------------------------------------------------------------------ 3. film-level overlays
  // (v2, owner 2026-10-07: 「去掉那些说明性文字，这个产品必须是完整的」) v1 put a small 「照片为 AI 生成的示例图」 tag over the hook
  // collage here; every explanatory / disclaimer overlay is gone from the picture now, the one credits line on the end card carries
  // the disclosure (act-A6-A7.js, T146).  Nothing is drawn here any more.
  FILM.patches.push('no film-level overlays (v2: explanatory tags removed; the end card carries the one credits line)');

  // ------------------------------------------------------------------ 3b. BED AUTOMATION (v2; read by out/tools/mix-film.py)
  // Stops the picture asks for and the CC0 track does not play (review: art #5, rhythm): the bed drops out under the scribble wipes
  // into the title (4:4.5 -> 5:1, the whoosh plays alone; the SLAM and the bed's return land together on 5:1) and into the collision
  // of the two photos (40:4.5 -> 41:1, the film's key frame), and it ducks
  // ~20 dB under 「曲终，」 (79:1, a warm boom carries the downbeat), then swells back into 「人不散。」 on 79:3.  Positions are storyboard
  // bar:beat, so the automation follows every tempo map; the original score already stops there, so it is skipped for it.
  {
    const ORIGINAL = /^original/.test((DM.map() && DM.map().id) || '');
    const auto = (label, a, b, c, d, db) => { const T4 = [a, b, c, d].map(v => typeof v === 'number' ? v : DM.Tc(v)); return { label, db, a: +T4[0].toFixed(4), b: +T4[1].toFixed(4), c: +T4[2].toFixed(4), d: +T4[3].toFixed(4) }; };
    // (an item whose bars a map cuts is skipped: e.g. tea-party / love-love-love cut bar 40)
    const stop = (label, from, to, db, down, up) => (DM.has(from) && DM.has(to)) ? [auto(label, DM.T(from) - down, DM.T(from), DM.T(to) - up, DM.T(to), db)] : [];
    FILM.bed = ORIGINAL ? [] : [
      ...stop('stop under the title wipe (4:4.5 -> 5:1)', '4:4.5', '5:1', -60, 0.012, 0.004),
      ...stop('stop under the wipe into the collision (40:4.5 -> 41:1)', '40:4.5', '41:1', -60, 0.012, 0.004),
      ...(DM.has('79:1') && DM.has('79:3') ? [auto('duck under 「曲终，」 (79:1 -> swell back by 79:3)', DM.T('79:1') - 0.015, DM.T('79:1') + 0.004, DM.T('79:2.5'), DM.T('79:3'), -20)] : []),
    ];
    for (const b of FILM.bed) FILM.patches.push(`bed automation: ${b.label}, ${b.db} dB, ${b.a.toFixed(3)}-${b.d.toFixed(3)} s`);
  }

  // ------------------------------------------------------------------ 4. checks on the assembled timeline
  const F = 1 / DM.cfg.fps, beat = DM.beatS();
  const warn = (k, msg) => { FILM.checks.push({ check: k, ok: false, msg }); DM.warn('film ' + k + ': ' + msg); };
  const ok = (k, msg) => FILM.checks.push({ check: k, ok: true, msg });
  // 4a. the acts tile the bar grid, and shots start inside their own act (wipes and other transitions may run over the next downbeat)
  {
    let bad = 0;
    FILM.acts.forEach((a, i) => {
      for (const sh of DM.shots.filter(s => s.act === a.id)) {
        if (!(sh.t1 > sh.t0)) continue;
        if (sh.t0 < a.t0 - 0.02 - F) { bad++; warn('grid', `${a.id}: shot ${sh.id} starts at ${sh.t0.toFixed(3)} s, before its act (${a.t0.toFixed(3)} s)`); }
        if (sh.t0 >= a.t1 - F) { bad++; warn('grid', `${a.id}: shot ${sh.id} starts at ${sh.t0.toFixed(3)} s, after its act ends (${a.t1.toFixed(3)} s)`); }
        const over = sh.t1 - a.t1;
        if (i < FILM.acts.length - 1 && over > 0.25) { bad++; warn('grid', `${a.id}: shot ${sh.id} runs ${over.toFixed(2)} s into the next act`); }
      }
      if (i && Math.abs(FILM.acts[i - 1].t1 - a.t0) > 1e-6) { bad++; warn('grid', `gap/overlap between ${FILM.acts[i - 1].id} and ${a.id}`); }
    });
    if (Math.abs(FILM.acts[0].t0) > 1e-6 || Math.abs(FILM.acts[FILM.acts.length - 1].t1 - DM.end()) > 1e-6) { bad++; warn('grid', 'the acts do not span 0 -> DM.end()'); }
    if (!bad) ok('grid', `${FILM.acts.length} acts tile 0.000 -> ${DM.end().toFixed(3)} s; every shot starts inside its act`);
  }
  // 4b. script lines said once
  {
    const by = {};
    for (const n of DM.textNodes) if (n.textInfo && n.textInfo.script && !n.never) (by[n.textInfo.script] = by[n.textInfo.script] || []).push(n);
    const twice = Object.entries(by).filter(([id, ns]) => new Set(ns.map(n => n.act)).size > 1);
    // the same line shown again later on purpose (e.g. the AI disclosure T025 in A1 and again in A5) is fine; overlapping in time is not
    const clash = [];
    for (const [id, ns] of twice) for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) {
      const a = ns[i], b = ns[j]; if (a.act === b.act) continue;
      const a0 = Math.max(a.t0, a.shot.t0), a1 = Math.min(a.t1, a.shot.t1), b0 = Math.max(b.t0, b.shot.t0), b1 = Math.min(b.t1, b.shot.t1);
      if (Math.min(a1, b1) - Math.max(a0, b0) > F) clash.push(`${id} in ${a.act} and ${b.act}`);
    }
    if (clash.length) warn('doubled_lines', clash.join(', '));
    else ok('doubled_lines', `${Object.keys(by).length} script lines; ${twice.length} reused by two acts at different times (${twice.map(t => t[0]).join(', ') || 'none'})`);
  }
  // 4e. (v3) FOOTAGE PROVENANCE: every still and clip the page resolved must come from the rc.2 material (the owner's 2026-10-07 copy
  // revision, build 0.22.0-rc.2): the rc.2 captures, the v3 crops made from them (prod/assets/v3, each folder with its provenance),
  // the rc.2 build's own files, or the film's QR.  The old capture folders (capture/P1, P2P3, desktop, H1-host: rc.1 copy with
  // 「·示例」 and the explanatory lines) hold files with the same ids, and tools/serve.mjs breaks an id tie by file size.
  DM.onLayout(() => {
    const OK = [/\/prod\/capture\/(P1|P2P3|desktop|H1-host|map)-rc2\//, /\/prod\/assets\/v3\//, /^\/tmp\/space-final\/dist-pages\//, /\/prod\/dm\/assets\/qr\.svg$/];
    const all = [...Object.entries(DM.assetInfo || {}).map(([n, i]) => ['still', n, i]), ...Object.entries(DM.clipInfo || {}).map(([n, i]) => ['clip', n, i])];
    const bad = all.filter(([, , i]) => !i || !i.path || i.placeholder || !OK.some(re => re.test(i.path))).map(([k, n, i]) => `${k} ${n} -> ${(i && i.path) || 'NOT FOUND'}`);
    FILM.footage = all.map(([k, n, i]) => ({ kind: k, name: n, path: i && i.path })).sort((a, b) => String(a.path).localeCompare(String(b.path)));
    if (bad.length) { FILM.checks.push({ check: 'footage_rc2', ok: false, msg: bad.join(' | ') }); for (const m of bad) DM.warn('film footage_rc2: ' + m); }
    else FILM.checks.push({ check: 'footage_rc2', ok: true, msg: `${all.length} stills/clips, all from the rc.2 captures, the v3 crops, the rc.2 build or the QR` });
  });
  DM.onLayout(() => {
    // 4c. seams: what is on screen across each boundary, and the visual-event rhythm around it
    const vis = e => e.visual !== false && !['sfx', 'mark', 'out'].includes(e.kind);
    const evs = DM.events.filter(vis).map(e => e.t).sort((a, b) => a - b);
    for (let i = 1; i < FILM.acts.length; i++) {
      const A = FILM.acts[i - 1], B = FILM.acts[i], t = B.t0;
      const near = evs.filter(x => x > t - 2 * beat - 1e-6 && x < t + 2 * beat);
      const pts = [t - 2 * beat, ...near, t + 2 * beat]; let gap = 0; for (let k = 1; k < pts.length; k++) gap = Math.max(gap, pts[k] - pts[k - 1]);
      // the transition: a wipe started in the last beat, a whole-shot slap / slide-on on the downbeat, else a hard cut (with what moves
      // in the last half beat before it, e.g. S11's fly-off into the stop-time break on 73:1)
      const wipes = DM.events.filter(e => (e.kind === 'wipe' && e.t > t - beat - 1e-6 && e.t < t + 1e-6) || (/^enter-/.test(e.kind) && Math.abs(e.t - t) < F)).map(e => `${e.kind} ${e.label}`);
      const lastMoves = DM.events.filter(e => vis(e) && e.t >= t - beat / 2 - 1e-6 && e.t < t - 1e-6).map(e => `${e.pos} ${e.kind} ${String(e.label).slice(0, 24)}`);
      // titles of the outgoing act still visible after the cut (declared windows)
      const late = DM.textNodes.filter(n => n.act === A.id && !n.never && n.textInfo && ['title', 'note'].includes(n.textInfo.kind) && Math.min(n.t1, n.shot.t1) > t + F).map(n => `${n.textInfo.script || n.id}「${(n.textInfo.text || '').slice(0, 10)}」`);
      const seam = { at: B.from, t: +t.toFixed(3), from: A.id, to: B.id, transition: wipes.join(', ') || ('hard cut' + (lastMoves.length ? ' after: ' + lastMoves.join('; ') : '')), events_pm2beats: near.length, longest_gap_s: +gap.toFixed(3), outgoing_titles_after_cut: late };
      FILM.seams.push(seam);
      if (late.length) DM.warn(`film seam ${B.from}: ${A.id} titles still on after the cut: ${late.join(' ')}`);
      if (gap > 2.5 * beat + 1e-3) DM.warn(`film seam ${B.from}: ${gap.toFixed(2)} s without a visual event around the cut`);
    }
    // 4d. (v2) READING ORDER: a narration line that enters ABOVE an older line of the same type column that is still on screen makes
    // the column read out of order (v1: 「没把握的时候，」 typed in above 「照片不上传。」; review art #2, read #1 / #4 / #9).  Checked on
    // the static type layers (paper: false shots) with each line's position after its moves; reported as a film check and warned.
    {
      const posAt = (n, t) => { let x = n.x, y = n.y; for (const fn of n.tracks) { const p = fn(t); if (!p) continue; if (p.x) x += p.x; if (p.y) y += p.y; } return [x, y]; };
      const box = (n, t) => { const [x, y] = posAt(n, t); const x0 = x - n.ax * n.w, y0 = y - n.ay * n.h; return [x0, y0, x0 + n.w, y0 + n.h]; };
      const win = n => [Math.max(n.typeT ?? n.t0, n.shot.t0), Math.min(n.t1, n.shot.t1)];
      // narration titles only: handwritten notes are annotations of the UI they sit next to (T044 quotes the wardrobe's own title)
      const lines = DM.textNodes.filter(n => !n.never && !n.parent && n.textInfo && n.textInfo.script && n.textInfo.kind === 'title' && n.shot.o.paper === false);
      const bad = [];
      for (const b of lines) for (const a of lines) {
        if (a === b || a.shot !== b.shot) continue;
        const [a0, a1] = win(a), [b0, b1] = win(b);
        if (!(a0 < b0 - F) || !(a1 > b0 + 7 * F)) continue;               // a is older and still on screen > 7 frames after b enters
        const tb = Math.min(b0 + 0.25, (Math.min(a1, b1) + b0) / 2), A = box(a, tb), B = box(b, tb);
        const ov = Math.min(A[2], B[2]) - Math.max(A[0], B[0]);
        if (ov < 0.3 * Math.min(A[2] - A[0], B[2] - B[0])) continue;      // not the same column
        if ((B[1] + B[3]) / 2 < (A[1] + A[3]) / 2 - 10)
          bad.push(`${b.textInfo.script}「${b.textInfo.text.slice(0, 8)}」 enters above ${a.textInfo.script}「${a.textInfo.text.slice(0, 8)}」 at ${DM.pos(b0).label} for ${(Math.min(a1, b1) - b0).toFixed(2)} s`);
      }
      if (bad.length) { FILM.checks.push({ check: 'reading_order', ok: false, msg: bad.join(' | ') }); for (const m of bad) DM.warn('film reading_order: ' + m); }
      else FILM.checks.push({ check: 'reading_order', ok: true, msg: `${lines.length} script lines on type layers; no line enters above an older one still on screen` });
    }
  });
})();
