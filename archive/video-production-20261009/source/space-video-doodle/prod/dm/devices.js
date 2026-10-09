/* doodle-motion · devices.js — hand-drawn frames around real product footage, frame-accurate playback, zoom/pan keyframes.
 *
 *   const clip = DM.clip('P-05')                          a capture by id (tools/serve.mjs finds prod/capture/**\/P-05.mp4) or a path
 *   DM.play(clip, {at: '29:1', from: 2.5, rate: 1})       feed: source second = from + (t - T(at)) * rate   (from may be 'f150' = frame)
 *   DM.ramp(clip, [['31:1', 4.0], ['31:3', 4.9], ['32:1', 5.0, DM.E.outC]])   feed with keyframed source time (speed ramps, freezes)
 *   DM.seq(clipA, '31:3', clipB)                          switch feeds at a time (hard cut on the beat, X5)
 *   const ph = DM.phone(shot, {media: feed | 'CUT-04' (still), x, y, r, w: 480, shadow: 'mint',
 *                              view: [['29:1', {s: 1}], ['30:1', {s: 1.8, x: 540, y: 1600}, DM.E.outExpo]]})   zoom keys: focus in SOURCE px
 *   ph.punch('32:1', {s: 2, x: 330, y: 1605}, {until: '33:1'})   punch-in on the beat (4 frames in, 6 frames back)
 *   DM.circle(shot, {on: ph, x: 330, y: 1605, rx: 300, ry: 90, at: '31:3.5'})   annotation glued to the footage (source px)
 *   ph.toWorld(t, sx, sy)                                 where a source pixel is in the shot (for arrows from type to the UI)
 *   DM.laptop(...)  DM.desk(...)  (L4: footage in a taped ink frame)  DM.screen(...)  (footage in a die-cut card)
 * Footage frames are JPEGs decoded by the browser; DM.render waits for each decode, so a frame can never show a stale image.
 */
(function () {
  'use strict';
  const DM = window.DM, { h, s, E, clamp, lerp } = DM;
  const T = DM._T, Tc = DM._Tc;
  const HALF = () => 0.5 / DM.cfg.fps;
  const P = DM.paths;
  DM.clipInfo = {};

  // ---------------------------------------------------------------- clips and feeds
  class Clip {
    constructor(name, o = {}) { this.name = name; this.fps = o.fps || 60; DM.used.clips.add(name); this.o = o; }
    get info() { return DM.clipInfo[this.name] || {}; }
    frameAt(sec) { const n = Math.floor(sec * (this.info.fps || this.fps) + 0.5 + 1e-6); const N = this.info.frames || 1e9; return Math.max(0, Math.min(N - 1, n)); }
    url(n) { return `/clip/${encodeURIComponent(this.name)}/${n}.jpg`; }
  }
  DM.clip = (name, o) => new Clip(name, o);
  DM._preLayout = DM._preLayout || [];
  DM._preLayout.push(async () => {
    await Promise.all([...DM.used.clips].map(async n => { try { DM.clipInfo[n] = await (await fetch('/clip-info/' + encodeURIComponent(n))).json(); } catch (e) { DM.clipInfo[n] = { error: String(e) }; } }));
    for (const [n, i] of Object.entries(DM.clipInfo)) if (!i.frames) DM.warn(`clip ${n}: NOT FOUND`); else if (i.placeholder) DM.warn(`clip ${n}: placeholder ${i.path}`);
  });
  const srcSec = v => typeof v === 'string' && /^f\d+$/.test(v) ? parseInt(v.slice(1), 10) / 60 : (v || 0);
  /** feed that plays `clip` from source second `from` starting at `at`, at `rate` (0 = freeze).  Holds the first frame before `at`. */
  DM.play = (clip, o = {}) => { const t0 = Tc(o.at ?? 0), from = srcSec(o.from), rate = o.rate ?? 1;
    const f = t => clip.url(clip.frameAt(from + Math.max(0, t - t0) * rate)); f.clip = clip; f.span = [from, null, rate, t0]; return f; };
  /** feed with keyframed source time: [[at, sourceSecond, ease], ...]; holds the ends (freeze) unless o.after = 'play' */
  DM.ramp = (clip, keys, o = {}) => { const ks = keys.map(k => [k[0], srcSec(k[1]), k[2]]); const last = ks[ks.length - 1];
    const f = t => { let sec = DM.kf(ks, t); if (o.after === 'play') { const tl = Tc(last[0]); if (t > tl) sec = last[1] + (t - tl); } return clip.url(clip.frameAt(sec)); }; f.clip = clip; return f; };
  /** switch between feeds/stills at times: DM.seq(feedA, '31:3', feedB, '33:1', 'CUT-04') */
  DM.seq = (...parts) => { const items = [], times = []; parts.forEach((p, i) => (i % 2 ? times.push(p) : items.push(p)));
    const tt = () => times.map(Tc); let cached = null;
    return t => { cached = cached || tt(); let k = 0; while (k < cached.length && t + HALF() >= cached[k]) k++; const it = items[k]; return typeof it === 'function' ? it(t) : DM.asset(it); }; };

  // ---------------------------------------------------------------- Device (screen with footage + zoom + annotation layer)
  class Device extends DM.Node {
    constructor(shot, el, o, geom) {
      super(shot, el, Object.assign({ boil: { px: 0.3, deg: 0.08 } }, o));
      Object.assign(this, geom);
      this.svg = el.querySelector('svg.body'); this.bodyPath = this.svg.querySelector('.bp'); this.shPath = this.svg.querySelector('.sp'); this.linePath = this.svg.querySelector('.lp');
      this.scrEl = el.querySelector('.scr'); this.cnt = el.querySelector('.cnt'); this.feedImg = el.querySelector('img.feed'); this._step = null; this._src = null;
      this.viewKeys = o.view || null; this.punches = [];
      this.srcW = o.srcW || geom.srcW; this.srcH = o.srcH || geom.srcH; this.autoSrc = !o.srcW;
      const m = o.media ?? o.feed ?? o.src;
      if (typeof m === 'function') this.feed = m; else if (m) { this.feedImg.src = DM.asset(m); this._src = this.feedImg.src; this.still = m; }
      this.screen = Object.create(this); this.screen.host = this.cnt;     // parent for annotations glued to the footage
      this.label = o.label || geom.kind;
    }
    afterLayout() {
      if (this.autoSrc) {        // source size from the media (clip info or the still's natural size)
        const ci = this.feed && this.feed.clip ? this.feed.clip.info : null;
        if (ci && ci.w) { this.srcW = ci.w; this.srcH = ci.h; } else if (this.feedImg.naturalWidth) { this.srcW = this.feedImg.naturalWidth; this.srcH = this.feedImg.naturalHeight; }
      }
      this.k = this.sw0 / this.srcW;
      for (const a of this._annots || []) a.p.ownerSVGElement.setAttribute('viewBox', `0 0 ${this.srcW} ${this.srcH}`);
    }
    /** zoom state at t: {s, fx, fy} with the focus in source px */
    viewAt(t) {
      const v = this.viewKeys ? DM.kf(this.viewKeys, t) : {}; let z = v.s ?? 1;
      let fx = v.u !== undefined ? v.u * this.srcW : (v.x ?? this.srcW / 2), fy = v.v !== undefined ? v.v * this.srcH : (v.y ?? this.srcH / 2);
      for (const p of this.punches) {
        const u = t - p.t + HALF(); if (u < 0) continue;
        let e = p.ease(clamp(u / p.inD)); if (p.until !== null) { const w = t - p.until + HALF(); if (w >= 0) e *= 1 - E.ioQ(clamp(w / p.outD)); }
        if (e <= 0) continue; const px = p.u !== undefined ? p.u * this.srcW : p.x, py = p.v !== undefined ? p.v * this.srcH : p.y;
        z = lerp(z, z * p.s, e); fx = lerp(fx, px, e); fy = lerp(fy, py, e);
      }
      return { s: z, fx, fy };
    }
    /** punch-in on the footage: o.s (relative zoom), o.x/o.y focus (source px); opts.until (pull back), opts.inF/outF frames */
    punch(at, o, opts = {}) {
      const t = T(at); if (t === null) return this;
      this.punches.push({ t, s: o.s ?? 1.5, x: o.x, y: o.y, u: o.u, v: o.v, inD: (opts.inF ?? 4) / 60, outD: (opts.outF ?? 6) / 60, until: opts.until !== undefined ? Tc(opts.until) : null, ease: opts.ease || E.outC });
      if (opts.log !== false) DM.ev(t, 'punch', opts.label || 'punch ' + this.label, { sfx: opts.sfx, gain: opts.gain, shot: this.shot.id });
      return this;
    }
    contentTransform(t) {
      const v = this.viewAt(t); const k = this.k || this.sw0 / this.srcW; const sc = v.s;
      let tx = this.sw0 / 2 - v.fx * k * sc, ty = this.sh0 / 2 - v.fy * k * sc;
      tx = Math.min(0, Math.max(this.sw0 - this.sw0 * sc, tx)); ty = Math.min(0, Math.max(this.sh0 - this.sh0 * sc, ty));
      return { tx, ty, sc, k };
    }
    /** source px -> device-local px at time t */
    toLocal(t, sx, sy) { const c = this.contentTransform(t); return [this.scrX + c.tx + sx * c.k * c.sc, this.scrY + c.ty + sy * c.k * c.sc]; }
    /** source px -> shot world px at time t (follows the device's own position, rotation and scale) */
    toWorld(t, sx, sy) {
      const [lx, ly] = this.toLocal(t, sx, sy); let x = this.x, y = this.y, r = this.r, sc = this.sc;
      for (const fn of this.tracks) { const p = fn(t); if (!p) continue; if (p.x) x += p.x; if (p.y) y += p.y; if (p.r) r += p.r; if (p.s != null) sc *= p.s; }
      const ox = this.ax * this.w, oy = this.ay * this.h, rr = r * Math.PI / 180, dx = (lx - ox) * sc, dy = (ly - oy) * sc;
      return [x + dx * Math.cos(rr) - dy * Math.sin(rr), y + dx * Math.sin(rr) + dy * Math.cos(rr)];
    }
    /** a marker stroke glued to the footage (coordinates in source px; width in screen px whatever the zoom) */
    annotate(o) {
      const st = new DM.Stroke(this.shot, Object.assign({}, o, { parent: this.screen, vw: this.srcW, vh: this.srcH, on: undefined, widthFn: t => 1 / ((this.k || this.sw0 / this.srcW) * this.viewAt(t).s) }));
      st.el.style.width = this.sw0 + 'px'; st.el.style.height = this.sh0 + 'px';
      (this._annots = this._annots || []).push(st); return st;
    }
    inner(t) {
      const step = DM.boilStep(t);
      if (step !== this._step) { this._step = step; this.drawBody(DM.rng(DM.hash(this.id, step))); }
      if (this.feed) {
        const src = this.feed(t);
        if (src && src !== this._src) { this._src = src; this.feedImg.src = src; DM.wait(this.feedImg.decode().catch(e => DM.warn('feed decode failed ' + src))); }
      }
      const c = this.contentTransform(t);
      this.cnt.style.transform = `translate(${c.tx.toFixed(2)}px,${c.ty.toFixed(2)}px) scale(${c.sc.toFixed(4)})`;
    }
  }
  DM.Device = Device;
  const devHTML = (W, H, sc, extra) => `<svg class="body" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><path class="sp" fill="var(--${sc})"/><path class="bp" fill="var(--ink)"/><path class="lp" fill="none" stroke="var(--ink)" stroke-width="5" stroke-linejoin="round"/>${extra || ''}</svg>`;
  const scrHTML = (x, y, w, hh, rad) => `<div class="scr" style="left:${x}px;top:${y}px;width:${w}px;height:${hh}px;border-radius:${rad}px"><div class="cnt" style="width:${w}px;height:${hh}px"><img class="feed" decoding="sync" style="width:${w}px;height:${hh}px"></div></div>`;

  /** hand-drawn phone (STORYBOARD §1.4): body 480 wide, 24 px bezel, screen 432 x 936 for a 1080 x 2340 capture, hard shadow in the act
   *  colour, outline boils.  o: {w, bez, srcW, srcH, shadow, sx, sy (shadow offset), media|feed|src, view, x, y, r} */
  DM.phone = (shot, o = {}) => {
    const W = o.w || 480, bez = o.bez ?? Math.round(W * 0.05), srcW = o.srcW || 1080, srcH = o.srcH || 2340;
    const scrW = W - 2 * bez, scrH = Math.round(scrW * srcH / srcW), H = scrH + 2 * bez + 6, sc = o.shadow || 'mint';
    const el = h('div', 'dev phone'); el.style.width = W + 'px'; el.style.height = H + 'px';
    el.innerHTML = devHTML(W, H, sc, `<path class="btn" fill="var(--ink)" d="M${W - 1},${H * 0.22} h7 v${H * 0.09} h-7 Z"/>`) + scrHTML(bez, bez + 3, scrW, scrH, o.srad || Math.round(W * 0.083))
      + `<div class="spk" style="left:50%;top:${Math.round(bez * 0.4)}px;width:${Math.round(W * 0.19)}px;margin-left:-${Math.round(W * 0.095)}px"></div>`;
    const n = new Device(shot, el, o, { kind: 'phone', W, H, sw0: scrW, sh0: scrH, srcW, srcH, scrX: bez, scrY: bez + 3 });
    const sx = o.sx ?? 16, sy = o.sy ?? 18; n.shPath.setAttribute('transform', `translate(${sx} ${sy})`);
    n.drawBody = r => { const d = P.rrect(1.5, 1.5, W - 3, H - 3, o.rad || Math.round(W * 0.13), r, { jit: 2.2 }); n.bodyPath.setAttribute('d', d); n.shPath.setAttribute('d', d); n.linePath.setAttribute('d', P.rrect(0, 0, W, H, (o.rad || Math.round(W * 0.13)) + 1, r, { jit: 3 })); };
    return n;
  };
  /** hand-drawn laptop (16:9 screen o.sw wide on a deck) */
  DM.laptop = (shot, o = {}) => {
    const srcW = o.srcW || 1920, srcH = o.srcH || 1080; const scrW = o.sw || 1280, scrH = Math.round(scrW * srcH / srcW), bez = o.bez || 26, lidW = scrW + 2 * bez, lidH = scrH + 2 * bez + 8, baseH = o.baseH || 64, ext = o.ext || 90;
    const W = lidW + 2 * ext, H = lidH + baseH + 10; const sc = o.shadow || 'pink';
    const el = h('div', 'dev laptop'); el.style.width = W + 'px'; el.style.height = H + 'px';
    el.innerHTML = devHTML(W, H, sc, `<path class="deck" fill="var(--card)" stroke="var(--ink)" stroke-width="5" stroke-linejoin="round"/><path class="deck2" fill="none" stroke="var(--ink)" stroke-width="4" stroke-linecap="round"/>`)
      + scrHTML(ext + bez, bez, scrW, scrH, 10) + `<div class="cam" style="left:50%;top:${bez * 0.36}px"></div>`;
    const n = new Device(shot, el, o, { kind: 'laptop', W, H, sw0: scrW, sh0: scrH, srcW, srcH, scrX: ext + bez, scrY: bez });
    n.shPath.setAttribute('transform', 'translate(16 18)');
    const deck = el.querySelector('.deck'), deck2 = el.querySelector('.deck2');
    n.drawBody = r => {
      const lid = P.rrect(ext + 1.5, 1.5, lidW - 3, lidH - 3, 30, r, { jit: 2 }); n.bodyPath.setAttribute('d', lid); n.linePath.setAttribute('d', P.rrect(ext, 0, lidW, lidH, 31, r, { jit: 3 }));
      const J = () => (r() - .5) * 3; const y0 = lidH - 2, y1 = H - 4;
      const dk = `M${ext - 30 + J()},${y0 + J()} L${W - ext + 30 + J()},${y0 + J()} L${W - 4 + J()},${y1 - 14 + J()} C${W - 2},${y1} ${W - 20},${y1 + 2} ${W - 40 + J()},${y1 + J()} L${40 + J()},${y1 + J()} C${20},${y1 + 2} ${2},${y1} ${4 + J()},${y1 - 14 + J()} Z`;
      deck.setAttribute('d', dk); n.shPath.setAttribute('d', lid + ' ' + dk);
      deck2.setAttribute('d', `M${W / 2 - 120 + J()},${y0 + 12 + J()} L${W / 2 + 120 + J()},${y0 + 12 + J()} M${W / 2 - 150 + J()},${y1 - 14 + J()} L${W / 2 + 150 + J()},${y1 - 14 + J()}`);
    };
    return n;
  };
  /** L4 desktop frame: footage in a paper-card mat with a 6 px ink outline, a hard ink shadow and two tape strips on the top corners.
   *  o: {w (footage width, default 1800), pad (mat, default 18), tape: true, shadow: 'ink'} */
  DM.desk = (shot, o = {}) => {
    const srcW = o.srcW || 1920, srcH = o.srcH || 1080; const scrW = o.w || 1800, scrH = Math.round(scrW * srcH / srcW), pad = o.pad ?? 18;
    const W = scrW + 2 * pad, H = scrH + 2 * pad;
    const el = h('div', 'dev desk'); el.style.width = W + 'px'; el.style.height = H + 'px';
    el.innerHTML = `<svg class="body" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><path class="sp" fill="var(--${o.shadow || 'ink'})" transform="translate(14 15)"/><path class="bp" fill="var(--card)"/><path class="lp" fill="none" stroke="var(--ink)" stroke-width="6" stroke-linejoin="round"/></svg>`
      + scrHTML(pad, pad, scrW, scrH, 6);
    const n = new Device(shot, el, Object.assign({ boil: { px: 0.25, deg: 0.03 } }, o), { kind: 'desk', W, H, sw0: scrW, sh0: scrH, srcW, srcH, scrX: pad, scrY: pad });
    n.drawBody = r => { const d = P.rrect(1, 1, W - 2, H - 2, 14, r, { jit: 2.5 }); n.bodyPath.setAttribute('d', d); n.shPath.setAttribute('d', d); n.linePath.setAttribute('d', P.rrect(0, 0, W, H, 15, r, { jit: 3.2 })); };
    if (o.tape !== false) { DM.tape(shot, { parent: n, color: 'y', x: 60, y: 8, r: -32, w: 170 }); DM.tape(shot, { parent: n, color: 'p', x: W - 60, y: 8, r: 30, w: 170 }); }
    return n;
  };
  /** footage in a die-cut card (no device) */
  DM.screen = (shot, o = {}) => {
    const srcW = o.srcW || 1080, srcH = o.srcH || 2340; const scrW = o.w || 420, scrH = o.hgt || Math.round(scrW * srcH / srcW), pad = o.pad ?? 12;
    const W = scrW + 2 * pad, H = scrH + 2 * pad;
    const el = h('div', 'dev screen'); el.style.width = W + 'px'; el.style.height = H + 'px';
    el.innerHTML = `<svg class="body" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><path class="sp" fill="var(--ink)" transform="translate(11 12)"/><path class="bp" fill="var(--card)"/><path class="lp" fill="none" stroke="var(--ink)" stroke-width="5" stroke-linejoin="round"/></svg>` + scrHTML(pad, pad, scrW, scrH, 10);
    const n = new Device(shot, el, o, { kind: 'screen', W, H, sw0: scrW, sh0: scrH, srcW, srcH, scrX: pad, scrY: pad });
    n.drawBody = r => { const d = P.rrect(1, 1, W - 2, H - 2, 18, r, { jit: 2 }); n.bodyPath.setAttribute('d', d); n.shPath.setAttribute('d', d); n.linePath.setAttribute('d', P.rrect(0, 0, W, H, 19, r, { jit: 2.6 })); };
    return n;
  };
})();
