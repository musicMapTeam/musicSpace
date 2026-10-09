/* doodle-motion · objects.js — paper objects, cut-out stickers, doodles, pops, starbursts, confetti, stamps-of-shape, ⇄ sticker.
 *
 *   DM.polaroid(shot, {src, w, hgt, cap, tape:'y'|'p'|'m'|false, x, y, r})   photo in a white frame (+ optional tape strip)
 *   DM.cutout(shot, {src, w, hgt, crop:[x,y,w,h] (source px), x, y, r})     die-cut of real UI on a paper-card margin
 *   DM.sticker(shot, {src, w, x, y})                                         die-cut sticker around an alpha shape (avatar SVG/PNG)
 *   DM.tape(shot, {color:'y'|'p'|'m', w, x, y, r})                            translucent torn tape
 *   DM.card(shot, {w, hgt, html, bg})  DM.scrap(shot, {w, hgt, color})  DM.ticket(shot, {text})  DM.img / DM.div
 *   DM.deco(shot, {kind, color, size})   kinds: star heart sparkle plus squiggle arrow check note dot lock cross swaparrows clock question
 *   DM.swap(shot, {size})  ⇄ sticker     DM.burst(shot, {rOut, rIn, n, color})  starburst     DM.confetti(shot, {at, x, y, n})
 *   DM.ripple(shot, {at, x, y})  tap ring     DM.stick(shot, {poses})  stick figure     DM.pops(shot, list, at, step)  a row of doodle pops
 * Every object is a DM.Node: chain .in('slap', '9:3', {sfx:'slap'}).out('pop', '13:1').bob(...).wiggle(...)
 */
(function () {
  'use strict';
  const DM = window.DM, { h, s, esc, E, clamp, lerp } = DM;
  const T = DM._T, Tc = DM._Tc;
  const HALF = () => 0.5 / DM.cfg.fps;
  const COLORS = DM.COLORS;
  const col = c => COLORS[c] || c;

  // ---------------------------------------------------------------- assets (resolved by tools/serve.mjs)
  /** URL of a production asset by name: a capture id ('CUT-04', 'P-05', 'D-02'), an avatar ('avatar:yao'), a photo ('photo:crowd'),
   *  or any path ('/build/demo/sample-crowd.jpg').  The server finds captures under prod/capture/** and falls back to the animatic's
   *  placeholders (flagged in DM.info().assets -> the QC report lists every placeholder still in the cut). */
  DM.asset = name => {
    if (/^(\/|https?:|data:)/.test(name)) return name;
    DM.used.assets.add(name); return '/a/' + encodeURIComponent(name);
  };
  DM._preLayout = DM._preLayout || [];
  DM._preLayout.push(async () => {
    DM.assetInfo = {};
    await Promise.all([...DM.used.assets].map(async n => { try { DM.assetInfo[n] = await (await fetch('/a-info/' + encodeURIComponent(n))).json(); } catch (e) { DM.assetInfo[n] = { error: String(e) }; } }));
    for (const [n, i] of Object.entries(DM.assetInfo)) if (i.placeholder) DM.warn(`asset ${n}: placeholder ${i.path}`); else if (!i.path) DM.warn(`asset ${n}: NOT FOUND`);
  });
  const src = v => DM.asset(v);

  // ---------------------------------------------------------------- paper objects
  DM.polaroid = (shot, o) => {
    const el = h('div', 'pol'); el.style.width = o.w + 'px'; el.style.height = o.hgt + 'px';
    const fit = o.fit || 'cover', pos = o.pos || '50% 50%';
    el.innerHTML = `<div class="ph"><img decoding="sync" src="${src(o.src)}" style="object-fit:${fit};object-position:${pos};${o.imgStyle || ''}"></div>${o.cap ? `<div class="cap">${esc(o.cap)}</div>` : ''}`;
    const n = new DM.Node(shot, el, o); n.img = el.querySelector('img'); n.label = 'polaroid ' + (o.label || o.cap || '');
    /** image pixel -> polaroid-local px (object-fit cover/contain + object-position), valid after layout */
    n.imgToLocal = (ix, iy) => {
      const ph = el.querySelector('.ph'); const bw = ph.clientWidth, bh = ph.clientHeight; const W = n.img.naturalWidth || 1, H = n.img.naturalHeight || 1;
      const k = fit === 'contain' ? Math.min(bw / W, bh / H) : Math.max(bw / W, bh / H); const [px, py] = pos.split(' ').map(q => parseFloat(q) / 100);
      const ox = (bw - W * k) * px, oy = (bh - H * k) * py; return [ph.offsetLeft + ph.clientLeft + ox + ix * k, ph.offsetTop + ph.clientTop + oy + iy * k];
    };
    if (o.cap) { n.capEl = el.querySelector('.cap'); if (o.capSize) n.capEl.style.fontSize = o.capSize + 'px'; DM.registerText(Object.assign(Object.create(n), { el: n.capEl, shot, textEl: n.capEl, id: n.id + ':cap', get _vis() { return n._vis; }, parent: n, t0: -1e9, t1: 1e9 }), { text: o.cap, role: 'hand', kind: 'label', size: o.capSize || 36 }); }
    if (o.tape !== false && o.tape !== undefined) DM.tape(shot, { parent: n, color: o.tape === true ? 'y' : o.tape, x: o.w * (o.tapeX ?? 0.5), y: -6, r: o.tapeR ?? (DM.sr(n.id, 'tr') * 6), w: o.tapeW || 190 });
    return n;
  };
  /** die-cut of real UI.  crop = [x, y, w, h] in source pixels (optional; default: the whole image, object-fit cover) */
  DM.cutout = (shot, o) => {
    const el = h('div', 'die'); el.style.width = o.w + 'px'; el.style.height = (o.hgt === 'auto' || !o.hgt ? Math.round(o.w * 0.75) : o.hgt) + 'px'; if (o.pad != null) el.style.padding = o.pad + 'px';
    el.innerHTML = `<div class="cut"><img decoding="sync" src="${src(o.src)}"></div>`;
    const n = new DM.Node(shot, el, o); n.img = el.querySelector('img'); n.label = 'cutout ' + (o.label || o.src);
    if (o.hgt === 'auto' || !o.hgt) DM._preLayout.push(async () => {    // height from the image's aspect (clamped to maxH)
      const img = n.img; if (!img.naturalWidth) return; const pad = (o.pad ?? 14) * 2 + 16;
      let hh = Math.round((o.w - pad) * img.naturalHeight / img.naturalWidth + pad); if (o.maxH) hh = Math.min(hh, o.maxH); if (o.minH) hh = Math.max(hh, o.minH); el.style.height = hh + 'px'; });
    if (o.crop) DM.onLayout(() => {           // position the crop rectangle inside the die (cover-fit of the crop box)
      const [cx, cy, cw, ch] = o.crop; const box = el.querySelector('.cut'); const bw = box.clientWidth, bh = box.clientHeight;
      const k = Math.max(bw / cw, bh / ch); const img = n.img; img.style.objectFit = 'none'; img.style.width = (img.naturalWidth * k) + 'px'; img.style.height = (img.naturalHeight * k) + 'px';
      img.style.left = (-(cx * k) + (bw - cw * k) / 2) + 'px'; img.style.top = (-(cy * k) + (bh - ch * k) / 2) + 'px';
    });
    return n;
  };
  /** die-cut sticker around an alpha shape (avatar SVG/PNG): paper margin + ink line + hard shadow */
  DM.sticker = (shot, o) => {
    const el = h('div', 'svgcut' + (o.thin ? ' thin' : '')); el.innerHTML = `<img decoding="sync" src="${src(o.src)}" style="width:${o.w}px;display:block">`;
    const n = new DM.Node(shot, el, o); n.label = 'sticker ' + (o.label || o.src); return n;
  };
  DM.svgcut = DM.sticker;   // animatic name
  DM.tape = (shot, o = {}) => { const el = h('div', 'tape ' + (o.color || 'y')); el.style.width = (o.w || 190) + 'px'; el.style.height = (o.hgt || 52) + 'px'; return new DM.Node(shot, el, Object.assign({ boil: { px: 0.4, deg: 0.3 }, layer: 12 }, o)); };
  DM.img = (shot, o) => { const el = h('img'); el.decoding = 'sync'; el.src = src(o.src); if (o.w) el.style.width = o.w + 'px'; if (o.hgt) el.style.height = o.hgt + 'px'; el.style.display = 'block'; return new DM.Node(shot, el, Object.assign({ boil: false }, o)); };
  DM.div = (shot, o = {}) => { const el = h('div', o.cls2 || '', o.html || ''); if (o.w) el.style.width = o.w + 'px'; if (o.hgt) el.style.height = o.hgt + 'px'; return new DM.Node(shot, el, o); };
  /** die card (paper-card, ink border, hard shadow, irregular radius) — the backing for type over footage (L4) */
  DM.card = (shot, o = {}) => { const el = h('div', 'card', o.html || ''); el.style.width = o.w + 'px'; if (o.hgt) el.style.height = o.hgt + 'px'; if (o.pad != null) el.style.padding = o.pad; if (o.bg) el.style.background = col(o.bg); const n = new DM.Node(shot, el, Object.assign({ layer: 8 }, o)); n.host = el; return n; };
  /** hand-drawn ticket stub (W1 「演出」) */
  DM.ticket = (shot, o = {}) => {
    const el = h('div', 'ticket'); el.style.width = (o.w || 520) + 'px'; el.style.height = (o.hgt || 240) + 'px';
    el.innerHTML = `<div class="tk-l">${esc(o.text || '演出')}</div><div class="tk-r">${esc(o.sub || 'ADMIT ONE')}</div>`;
    const n = new DM.Node(shot, el, o); n.label = 'ticket';
    DM.registerText(Object.assign(Object.create(n), { el: el.querySelector('.tk-l'), textEl: el.querySelector('.tk-l'), id: n.id + ':t', get _vis() { return n._vis; } }), { text: o.text || '演出', role: 'display', kind: 'label', size: 96 });
    return n;
  };

  // ---------------------------------------------------------------- torn paper scrap (collage backing)
  class Scrap extends DM.Node {
    constructor(shot, o) {
      const W = o.w, H = o.hgt; const svg = s('svg', { width: W + 40, height: H + 40, viewBox: `-20 -20 ${W + 40} ${H + 40}` }); svg.style.overflow = 'visible';
      const shp = s('path', { fill: o.shadowColor || 'rgba(28,27,26,.9)', transform: `translate(${o.shx ?? 10} ${o.shy ?? 11})` });
      const body = s('path', { fill: col(o.color || 'mint'), stroke: o.line ? 'var(--ink)' : 'none', 'stroke-width': o.line || 0, 'stroke-linejoin': 'round' });
      svg.appendChild(shp); svg.appendChild(body); if (o.shadow === false) shp.style.display = 'none';
      super(shot, svg, Object.assign({ boil: { px: 0.5, deg: 0.2 }, layer: 1 }, o)); this.body = body; this.shp = shp; this.W = W; this.H = H; this._step = null; this.label = 'scrap';
    }
    inner(t) {
      const step = DM.boilStep(t); if (step === this._step) return; this._step = step;
      const r = DM.rng(DM.hash(this.id, step)); const W = this.W, H = this.H, j = this.o.jag ?? 7; const pts = [];
      const edge = (x0, y0, x1, y1, n) => { for (let i = 0; i < n; i++) { const k = i / n; pts.push([lerp(x0, x1, k) + (r() - .5) * j, lerp(y0, y1, k) + (r() - .5) * j]); } };
      edge(0, 0, W, 0, Math.max(4, W / 38 | 0)); edge(W, 0, W, H, Math.max(3, H / 38 | 0)); edge(W, H, 0, H, Math.max(4, W / 38 | 0)); edge(0, H, 0, 0, Math.max(3, H / 38 | 0));
      const d = 'M' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' L') + ' Z'; this.body.setAttribute('d', d); this.shp.setAttribute('d', d);
    }
  }
  DM.scrap = (shot, o) => new Scrap(shot, o);

  // ---------------------------------------------------------------- doodles (the product's kit.css shapes)
  const SHAPES = DM.shapes = {
    star: { vb: '0 0 40 40', d: 'M20.4 3.2 25.6 14.6 37.4 15.9 28.6 24.1 31.3 36.4 20.2 30.1 8.9 36.6 11.5 24.3 2.6 16.1 14.6 14.4Z', two: 1, sw: 2.8 },
    heart: { vb: '0 0 32 30', d: 'M16 27.2C9 21.8 3 17 3 10.5 3 6.3 6.2 3 10.1 3c2.8 0 4.7 1.6 5.9 4 1.2-2.4 3.3-4 6.1-4C26 3 29 6.3 29 10.3 29 16.9 22.8 21.9 16 27.2Z', two: 1, sw: 2.6 },
    sparkle: { vb: '0 0 40 40', d: 'M20 1.5C21.4 12.6 27.4 18.6 38.5 20 27.4 21.4 21.4 27.4 20 38.5 18.6 27.4 12.6 21.4 1.5 20 12.6 18.6 18.6 12.6 20 1.5Z', fill: 1 },
    plus: { vb: '0 0 30 30', d: 'M15.4 3C14.6 11 15.6 19 14.8 27M3.5 15.4C11 14.4 19 15.6 26.5 14.6', sw: 3.6 },
    squiggle: { vb: '0 0 120 24', d: 'M3 15C12 4 20 4 28 12S44 21 52 12 68 3 76 12 92 21 100 12 112 5 117 9', sw: 4.5 },
    arrow: { vb: '0 0 120 70', d: 'M6 58C30 20 62 8 104 17M87 5l19 12-15 15', sw: 4.2 },
    check: { vb: '0 0 24 24', d: 'M3.6 12.6C6 14 8 16.6 9.6 19.8 12.4 12.6 16.2 7.4 21.2 3.4', sw: 3.8 },
    note: { vb: '0 0 44 48', d: 'M15 36V9L37 4v27', sw: 3.4, extra: '<path d="M15 13.5 37 8.5" stroke="currentColor" stroke-width="6" fill="none"/><ellipse cx="9.5" cy="36.5" rx="6.6" ry="5" transform="rotate(-20 9.5 36.5)" fill="currentColor"/><ellipse cx="31.5" cy="31.5" rx="6.6" ry="5" transform="rotate(-20 31.5 31.5)" fill="currentColor"/>' },
    dot: { vb: '0 0 24 24', d: 'M12.2 4.4c4.7-.2 7.6 3.3 7.3 7.8-.3 4.6-3.7 7.5-7.9 7.3-4.4-.3-7.2-3.6-6.9-7.9.3-4.2 3.4-7 7.5-7.2Z', fill: 1 },
    lock: { vb: '0 0 40 44', d: 'M11 19V13C11 7 15 3.5 20.2 3.6 25.6 3.7 29 7.4 29 13.2V19M6.5 19.5C15 18.6 25 18.9 33.8 19.6 34.6 26 34.2 33.5 33.4 40 24.5 41 15 40.6 6.8 40 6 33 6 26 6.5 19.5ZM20 27.5V33', sw: 3.4 },
    cross: { vb: '0 0 30 30', d: 'M5 5.5C12 12 18 18.5 25.5 25M25 5C18 12 12 18.5 5.2 25.4', sw: 4.4 },
    swaparrows: { vb: '0 0 24 24', d: 'M4 9h13l-3.5-3.5M20 15H7l3.5 3.5', sw: 2.6 },
    clock: { vb: '0 0 40 40', d: 'M20.3 3.6C29.6 3.4 36.6 10.5 36.5 20.1 36.4 29.4 29.3 36.6 20 36.5 10.6 36.4 3.5 29.2 3.6 19.9 3.7 10.8 10.9 3.8 20.3 3.6ZM20 10.5V20.5L27 24', sw: 3.4 },
    question: { vb: '0 0 30 44', d: 'M6.5 12.2C7.4 6.4 11.4 3.2 16.4 3.4 22.2 3.7 25.6 7.6 25.1 12.6 24.6 17.6 19.8 19.4 17 22.2 15.4 23.8 15 26 15.2 29.4M15.4 37.2V38.8', sw: 4.4 },
    bang: { vb: '0 0 16 44', d: 'M8.2 3.5C7.8 13 8.4 21 7.8 29M8 37.6V39.4', sw: 4.6 },
    burstline: { vb: '0 0 60 60', d: 'M30 4V16M30 44V56M4 30H16M44 30H56M11.6 11.6 20 20M40 40 48.4 48.4M48.4 11.6 40 20M20 40 11.6 48.4', sw: 4 },
  };
  /** doodle: o.kind, o.color (fill for two-tone/fill shapes, stroke colour for line shapes), o.size px, o.lw line weight multiplier */
  DM.deco = (shot, o) => {
    const S = SHAPES[o.kind]; if (!S) throw new Error('DM.deco: unknown kind ' + o.kind);
    const c = col(o.color || 'ink'); const sz = o.size || 60;
    const [, , vw, vh] = S.vb.split(' ').map(Number); const w = o.w || sz, hh = o.hgt || sz * vh / vw;
    let inner;
    if (S.two) inner = `<path d="${S.d}" fill="${c}" transform="translate(${vw * 0.07} ${vh * 0.08})"/><path d="${S.d}" fill="none" stroke="var(--ink)" stroke-width="${S.sw * (o.lw || 1)}" stroke-linejoin="round"/>`;
    else if (S.fill) inner = `<path d="${S.d}" fill="${c}"/>`;
    else inner = `<path d="${S.d}" fill="none" stroke="${c}" stroke-width="${S.sw * (o.lw || 1)}" stroke-linecap="round" stroke-linejoin="round"/>` + (S.extra || '').replace(/currentColor/g, c);
    const el = h('div'); el.innerHTML = `<svg viewBox="${S.vb}" width="${w}" height="${hh}" style="display:block;overflow:visible" preserveAspectRatio="${o.par || 'xMidYMid meet'}">${inner}</svg>`;
    const n = new DM.Node(shot, el, Object.assign({ boil: { px: 1.0, deg: 1.6 }, layer: 15 }, o)); n.label = o.kind; return n;
  };
  /** a row of doodle pops: list = [[kind, color, x, y, size, rot], ...] popping from `at` every `step` seconds.  o: {z, parent, sfx, gain} */
  DM.pops = (shot, list, at, step, o = {}) => {
    const t0 = T(at); if (t0 === null) return [];
    return list.map(([k, c, x, y, z, rot], i) => DM.deco(shot, { kind: k, color: c, size: z, x, y, r: rot || 0, z: o.z ?? 30, parent: o.parent })
      .in(o.fx || 'pop', t0 + i * step, { sfx: o.sfx ?? (i % 2 === 0 ? undefined : 'none'), gain: o.gain ?? -6, note: i, label: k }));
  };
  /** the pink ⇄ swap sticker (product arrows) */
  DM.swap = (shot, o = {}) => { const el = h('div', 'swap'); el.innerHTML = `<svg viewBox="0 0 24 24"><path d="${SHAPES.swaparrows.d}" fill="none" stroke="#1c1b1a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`; if (o.size) { el.style.width = el.style.height = o.size + 'px'; } const n = new DM.Node(shot, el, Object.assign({ layer: 16 }, o)); n.label = 'swap'; return n; };
  /** tap ring (the capture rig's doodle ripple); logs a 'tap' event (click sound) */
  DM.ripple = (shot, o) => {
    const el = h('div'); el.style.cssText = `width:${o.size || 90}px;height:${o.size || 90}px;border-radius:50%;border:6px solid var(--yellow);box-shadow:0 0 0 4px var(--ink),inset 0 0 0 4px var(--ink),6px 6px 0 4px var(--pink);background:rgba(255,212,71,.25)`;
    const n = new DM.Node(shot, el, Object.assign({ boil: false, layer: 25 }, o)); const t0 = T(o.at ?? o.t); if (t0 === null) { n.t0 = Infinity; return n; }
    n.t0 = t0; n.t1 = t0 + 0.5; n.track(t => { const u = clamp((t - t0) / 0.48); return { s: lerp(0.3, 1.2, E.outC(u)), o: 1 - E.inQ(u) }; });
    DM.ev(t0, 'tap', o.label || 'tap', { sfx: o.sfx, gain: o.gain, shot: shot.id }); return n;
  };
  /** confetti burst of doodles from (x,y) at `at`: deterministic ballistic flight, then settle & twinkle (payoff only) */
  DM.confetti = (shot, o) => {
    const t0 = T(o.at ?? o.t); if (t0 === null) return [];
    const n = o.n || 14; const kinds = o.kinds || ['star', 'heart', 'sparkle', 'plus', 'star', 'sparkle']; const cols = o.colors || ['pink', 'mint', 'yellow'];
    const out = [];
    for (let i = 0; i < n; i++) {
      const r = DM.rng(DM.hash(o.id || 'cf', i)); const kind = kinds[i % kinds.length];
      const d = DM.deco(shot, { kind, color: cols[i % cols.length], size: lerp(o.min || 34, o.max || 74, r()), x: o.x, y: o.y, z: o.z, id: (o.id || 'cf') + i, parent: o.parent });
      const ang = lerp(o.a0 ?? -170, o.a1 ?? -10, (i + r() * 0.8) / n) * Math.PI / 180, sp = lerp(o.v0 ?? 900, o.v1 ?? 1700, r());
      const vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp, g = o.g ?? 2600, spin = (r() - 0.5) * 900, land = lerp(0.45, 0.75, r());
      d.t0 = t0; d.track(t => { const u = t - t0 + HALF(); if (u < 0) return null; const uu = Math.min(u, land); const slow = Math.exp(-3.2 * uu);
        const px = vx * (1 - slow) / 3.2, py = vy * (1 - slow) / 3.2 + 0.5 * g * uu * uu * 0.35;
        return { x: px, y: py, r: spin * uu * slow, s: Math.min(1, u * 60 / 4) * (u > land ? 1 + 0.08 * Math.sin((u - land) * 9 + i) : 1) }; });
      if (o.until !== undefined) d.out('pop', o.until);
      out.push(d);
    }
    DM.ev(t0, 'confetti', o.label || 'confetti', { sfx: o.sfx, gain: o.gain, shot: shot.id }); return out;
  };

  // ---------------------------------------------------------------- starburst (comic POW behind a hit)
  class Burst extends DM.Node {
    constructor(shot, o) {
      const R = o.rOut || 300; const S = 2 * R + 60;
      const svg = s('svg', { width: S, height: S, viewBox: `${-R - 30} ${-R - 30} ${S} ${S}` }); svg.style.overflow = 'visible';
      const shp = s('path', { fill: 'var(--ink)', transform: `translate(${o.shx ?? 14} ${o.shy ?? 16})` });
      const body = s('path', { fill: col(o.color || 'yellow'), stroke: 'var(--ink)', 'stroke-width': o.lw ?? 7, 'stroke-linejoin': 'round' });
      svg.appendChild(shp); svg.appendChild(body); if (o.shadow === false) shp.style.display = 'none';
      super(shot, svg, Object.assign({ boil: { px: 0.8, deg: 0.4 }, layer: 1 }, o)); this.body = body; this.shp = shp; this._step = null;
      this.n = o.n || 18; this.rIn = o.rIn || R * 0.72; this.rOut = R; this.spin = o.spin ?? 6; this.label = 'burst';
    }
    inner(t) {
      const step = DM.boilStep(t); if (step === this._step) return; this._step = step;
      const r = DM.rng(DM.hash(this.id, step)); const rot = (step / DM.cfg.boilFps * this.spin) * Math.PI / 180; let d = '';
      for (let i = 0; i < this.n * 2; i++) { const a = rot + i * Math.PI / this.n; const rr = (i % 2 ? this.rIn : this.rOut) * (1 + (r() - .5) * 0.07);
        d += (i ? ' L' : 'M') + (Math.cos(a) * rr).toFixed(1) + ',' + (Math.sin(a) * rr).toFixed(1); }
      d += ' Z'; this.body.setAttribute('d', d); this.shp.setAttribute('d', d);
    }
  }
  DM.burst = (shot, o) => new Burst(shot, o);

  // ---------------------------------------------------------------- stick figure (poses swap on beats)
  const POSES = {
    stand: { la: [-150, -110], ra: [-30, -70], ll: [-105, -95], rl: [-75, -85] }, wave: { la: [-160, -120], ra: [-50, 40], ll: [-105, -95], rl: [-75, -85] },
    cheer: { la: [-130, 150], ra: [-50, 30], ll: [-110, -100], rl: [-70, -80] }, jump: { la: [-140, 160], ra: [-40, 20], ll: [-125, -60], rl: [-55, -120] },
    walk1: { la: [-120, -80], ra: [-60, -100], ll: [-120, -100], rl: [-65, -80] }, walk2: { la: [-60, -100], ra: [-120, -80], ll: [-65, -80], rl: [-120, -100] },
    sad: { la: [-115, -100], ra: [-65, -80], ll: [-100, -92], rl: [-80, -88] },
  };
  class Stick extends DM.Node {
    constructor(shot, o) {
      const S = o.size || 140; const svg = s('svg', { width: S, height: S * 1.6, viewBox: '-50 -20 100 160' }); svg.style.overflow = 'visible';
      const p = s('path', { fill: 'none', stroke: col(o.color || 'ink'), 'stroke-width': o.lw ?? 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
      const head = s('ellipse', { fill: o.fill ? col(o.fill) : 'var(--card)', stroke: col(o.color || 'ink'), 'stroke-width': o.lw ?? 5 });
      svg.appendChild(p); svg.appendChild(head); super(shot, svg, Object.assign({ boil: { px: 0.8, deg: 1.2 } }, o));
      this.p = p; this.head = head; this.poses = (o.poses || [[0, 'stand']]).map(([at, nm]) => [Tc(at), nm]); this._key = null; this.label = 'stick';
    }
    inner(t) {
      let pose = this.poses[0][1]; for (const [pt, nm] of this.poses) if (pt <= t + HALF()) pose = nm;
      const step = DM.boilStep(t); const key = pose + step; if (key === this._key) return; this._key = key;
      const r = DM.rng(DM.hash(this.id, step)); const P0 = POSES[pose] || POSES.stand; const J = () => (r() - .5) * 3;
      const limb = (x, y, [a1, a2], l1, l2) => { const r1 = a1 * Math.PI / 180, r2 = a2 * Math.PI / 180; const x1 = x + Math.cos(r1) * l1, y1 = y - Math.sin(r1) * l1; const x2 = x1 + Math.cos(r2) * l2, y2 = y1 - Math.sin(r2) * l2;
        return `M${x + J()},${y + J()} Q${x1 + J()},${y1 + J()} ${x2 + J()},${y2 + J()}`; };
      let d = `M${J()},30 Q${J() * 2},${58 + J()} ${J()},${85 + J()}`;
      d += ' ' + limb(0, 42, P0.la, 26, 24) + ' ' + limb(0, 42, P0.ra, 26, 24) + ' ' + limb(0, 85, P0.ll, 30, 28) + ' ' + limb(0, 85, P0.rl, 30, 28);
      this.p.setAttribute('d', d); this.head.setAttribute('cx', (J() * 0.6).toFixed(1)); this.head.setAttribute('cy', (12 + J() * 0.4).toFixed(1));
      this.head.setAttribute('rx', (17 + J() * 0.3).toFixed(1)); this.head.setAttribute('ry', (18 + J() * 0.3).toFixed(1));
    }
  }
  DM.stick = (shot, o) => new Stick(shot, o);
})();
