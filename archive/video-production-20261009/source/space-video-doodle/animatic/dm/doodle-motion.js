/* doodle-motion.js — deterministic, frame-stepped motion system for the Music Space Doodle video (1920x1080).
 *
 * Every pixel is a pure function of the frame number: no CSS animations, no timers, no Date.  The renderer
 * (tools/render.mjs) calls `await DM.render(f)` and takes one CDP screenshot per frame.
 *
 * Time is written on the music grid: DM.T('5:3') = bar 5 beat 3 (bars/beats 1-based, fractional beats allowed:
 * '4:4.5' = the "and" of 4).  DM.tempo(bpm, firstDownbeatSeconds) sets the grid, so a re-timed track only changes one line.
 *
 * Building blocks (all return a Node; nodes compose transforms from tracks):
 *   shot = DM.shot(id, t0, t1, {paper, cam})            a full-frame composition on its own paper world (camera keyframes, shake, kick pulse)
 *   DM.title(shot, {text:'只有[自己]那一面。', ...})    layered lettering: ink + offset colour shadow (+ key words bigger, sticker-outlined), optional
 *                                                        highlighter swipe and per-character type-on
 *   DM.text / DM.logo / DM.stamp / DM.chip / DM.card    plain lines, the MUSIC SPACE wordmark, rubber stamps, pills, die cards
 *   DM.polaroid / DM.cutout / DM.svgcut / DM.tape       paper objects (photos and real UI cut-outs, die-cut avatar SVGs, translucent tape)
 *   DM.phone / DM.laptop                                hand-drawn devices whose screens show real product footage (frame sequences) with punch-ins
 *   DM.deco(kind) / DM.swap / DM.ripple / DM.confetti   stickers & doodles (the product's own shapes), the ⇄ sticker, tap rings, payoff confetti
 *   DM.stroke({gen}) / DM.paths.*                        marker strokes drawn on with stroke-dashoffset and re-drawn ("boiled") at 12 fps
 *   DM.wipe(shot, t)                                     scribble-wipe transition (covers on the "and" of 4, uncovers on the downbeat)
 * Entrances: slam pop stamp slap drop rise slide fade none — exits: pop cut slide fade.  Every entrance logs a visual
 * event (DM.events) and may queue a sound cue (DM.cues) so the audio pass and the QC see the same beat map as the picture. */
(function () {
  'use strict';
  const DM = window.DM = {};
  const cfg = DM.cfg = { fps: 60, W: 1920, H: 1080, bpm: 123, offset: 0, bpb: 4, boilFps: 12, duration: 10 };
  const HALF = () => 0.5 / cfg.fps;
  DM.tempo = (bpm, offset = 0) => { cfg.bpm = bpm; cfg.offset = offset; };
  DM.beatS = () => 60 / cfg.bpm;
  DM.barS = () => cfg.bpb * 60 / cfg.bpm;
  DM.T = (bar, beat = 1) => {
    if (typeof bar === 'number' && beat === 1 && !Number.isInteger(bar)) return bar;
    if (typeof bar === 'string') { const [a, b] = bar.split(':'); bar = +a; beat = b === undefined ? 1 : +b; }
    return cfg.offset + (bar - 1) * DM.barS() + (beat - 1) * DM.beatS();
  };
  const T = v => (typeof v === 'string' ? DM.T(v) : v);
  DM.F = t => Math.round(t * cfg.fps);

  // ---------- deterministic randomness ----------
  DM.hash = (...a) => {
    let h = 2166136261 >>> 0;
    for (const x of a) { const s = String(x); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } h ^= 0x9e37; h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  };
  DM.rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  DM.rand = (...a) => DM.rng(DM.hash(...a))();
  DM.sr = (...a) => DM.rand(...a) * 2 - 1;
  DM.boilStep = t => Math.floor(t * cfg.boilFps + 1e-6);

  // ---------- easing ----------
  const clamp = DM.clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = DM.lerp = (a, b, x) => a + (b - a) * x;
  const E = DM.E = {
    lin: x => x, inQ: x => x * x, outQ: x => 1 - (1 - x) * (1 - x), ioQ: x => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2,
    inC: x => x * x * x, outC: x => 1 - Math.pow(1 - x, 3), ioC: x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
    outQuart: x => 1 - Math.pow(1 - x, 4), outExpo: x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x), inExpo: x => x <= 0 ? 0 : Math.pow(2, 10 * x - 10),
    ioSine: x => -(Math.cos(Math.PI * x) - 1) / 2,
    outBack: (x, k = 1.9) => 1 + (k + 1) * Math.pow(x - 1, 3) + k * Math.pow(x - 1, 2),
  };
  /** damped spring 0 -> 1 with overshoot; u in seconds */
  DM.spring = (u, freq = 2.6, damp = 9) => u <= 0 ? 0 : 1 - Math.exp(-damp * u) * Math.cos(2 * Math.PI * freq * u);
  /** keyframes [[t, value, ease], ...]; value = number or {k:number}; ease applies to the segment that ENDS at that key */
  DM.kf = (keys, t) => {
    if (!keys.length) return 0;
    const val = k => k[1];
    if (t <= T(keys[0][0])) return val(keys[0]);
    for (let i = 1; i < keys.length; i++) {
      const a = keys[i - 1], b = keys[i], ta = T(a[0]), tb = T(b[0]);
      if (t < tb) {
        const x = (b[2] || E.ioC)(clamp((t - ta) / Math.max(1e-6, tb - ta)));
        if (typeof a[1] === 'number') return lerp(a[1], b[1], x);
        const o = {}; for (const k in b[1]) o[k] = lerp(a[1][k] ?? b[1][k], b[1][k], x); return o;
      }
    }
    return val(keys[keys.length - 1]);
  };

  // ---------- registries ----------
  const shots = DM.shots = [];
  DM.events = [];          // visual events: {t, label}
  DM.cues = [];            // sound cues for the audio pass: {t, kind, gain, pan, note}
  DM.ev = (t, label) => { DM.events.push({ t: +T(t).toFixed(4), label }); };
  DM.cue = (t, kind, o = {}) => { DM.cues.push({ t: +T(t).toFixed(4), kind, gain: o.gain ?? 0, pan: o.pan ?? 0, note: o.note ?? 0 }); };
  let pending = [];
  let NID = 0, MASKID = 0;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const s = (tag, attrs = {}) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  DM.h = h; DM.s = s;
  const esc = x => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // ---------- entrances / exits ----------
  const ff = u => u * 60;   // motion vocabulary is specified in 60 fps frames; works at any fps
  const IN = {
    none: () => ({}),
    slam: (u, o) => { const f = ff(u); const d = o.dir || 1; const big = o.big ?? 1.6;
      const sc = f < 3 ? lerp(big, 0.94, E.outC(f / 3)) : f < 7 ? lerp(0.94, 1, E.ioQ((f - 3) / 4)) : 1;
      return { s: sc, r: f < 7 ? lerp(-3 * d, 0, E.outC(f / 7)) : 0 }; },
    pop: (u, o) => { const sc = DM.spring(u, o.freq ?? 2.6, o.damp ?? 9); const w = (o.wob ?? 6) * Math.exp(-8 * u) * Math.sin(u * 2 * Math.PI * 3.2);
      return { s: Math.max(0, sc), r: w }; },
    stamp: (u, o) => { const f = ff(u); const sc = f < 5 ? lerp(1.4, 1, E.outC(f / 5)) : 1; const sh = f < 7 ? (7 - f) / 7 * 5 : 0;
      return { s: sc, r: f < 5 ? lerp(-8, 0, E.outC(f / 5)) : 0, x: sh * DM.sr(o.id, 'sx', Math.floor(f)), y: sh * DM.sr(o.id, 'sy', Math.floor(f)), o: f < 1 ? 0.6 : 1 }; },
    slap: (u, o) => { const f = ff(u); const k = clamp(f / 9);
      return { s: lerp(o.big ?? 1.22, 1, E.outBack(k, 1.4)), r: lerp(o.spin ?? 7, 0, E.outC(k)), y: lerp(o.dy ?? -26, 0, E.outC(k)) }; },
    drop: (u, o) => { const k = clamp(ff(u) / (o.frames ?? 11)); return { y: lerp(-(o.dist ?? 150), 0, E.outBack(k, 2.2)), o: k > 0 ? 1 : 0 }; },
    rise: (u, o) => { const k = clamp(u / (o.dur ?? 0.42)); return { y: lerp(o.dist ?? 1100, 0, E.outBack(k, o.k ?? 1.25)), r: lerp(o.spin ?? 4, 0, E.outC(k)) }; },
    slide: (u, o) => { const k = (o.ease || E.outC)(clamp(u / (o.dur ?? 0.36))); return { x: lerp(o.dx ?? 0, 0, k), y: lerp(o.dy ?? 0, 0, k), r: lerp(o.dr ?? 0, 0, k) }; },
    fade: (u, o) => ({ o: clamp(u / (o.dur ?? 0.2)) }),
    grow: (u, o) => { const k = (o.ease || E.outBack)(clamp(u / (o.dur ?? 0.3))); return { s: Math.max(0, k) }; },
  };
  const OUT = {
    cut: () => ({}),
    pop: (u) => { const f = ff(u); return { s: f < 2 ? lerp(1, 1.1, f / 2) : Math.max(0, lerp(1.1, 0, (f - 2) / 4)) }; },
    fade: (u, o) => ({ o: 1 - clamp(u / (o.dur ?? 0.2)) }),
    slide: (u, o) => { const k = (o.ease || E.inC)(clamp(u / (o.dur ?? 0.3))); return { x: (o.dx ?? 0) * k, y: (o.dy ?? 0) * k, r: (o.dr ?? 0) * k }; },
    shrink: (u, o) => { const k = E.inC(clamp(u / (o.dur ?? 0.18))); return { s: 1 - k }; },
  };
  const OUT_DUR = { cut: 0, pop: 6 / 60, fade: null, slide: null, shrink: null };

  // ---------- Node ----------
  class Node {
    constructor(shot, el, o = {}) {
      this.shot = shot; this.el = el; this.o = o; this.id = o.id || (shot.id + ':' + (++NID));
      this.x = o.x ?? 0; this.y = o.y ?? 0; this.r = o.r ?? 0; this.sc = o.s ?? 1; this.op = o.o ?? 1;
      this.ax = o.ax ?? 0.5; this.ay = o.ay ?? 0.5;    // anchor inside the element (0..1): (x,y) is where this point sits
      this.tracks = []; this.t0 = -1e9; this.t1 = 1e9; this.w = 0; this.h = 0;
      this.boil = o.boil === false ? null : Object.assign({ px: 0.6, deg: 0.25 }, o.boil || {});
      el.classList.add('n'); if (o.z != null) el.style.zIndex = o.z; if (o.cls) el.classList.add(...o.cls.split(' '));
      if (o.style) Object.assign(el.style, o.style);
      (o.parent ? o.parent.el : shot.world).appendChild(el);
      shot.nodes.push(this); this.parent = o.parent || null;
    }
    track(fn) { this.tracks.push(fn); return this; }
    /** entrance at time t (visible from t); logs a visual event, optional sound cue {sfx:'pop', gain} */
    in(kind, t, o = {}) {
      t = T(t); this.t0 = t; const fn = IN[kind]; const opt = Object.assign({ id: this.id }, o);
      this.track(tt => { const u = tt - t + HALF(); return u < 0 ? null : fn(u, opt); });
      if (kind === 'slam' && o.shake !== false) this.shot.shake(t, o.shake ?? (o.big === undefined ? 7 : 5));
      if (o.log !== false) DM.ev(t, `${kind} ${o.label || this.label || this.id}`);
      if (o.sfx) DM.cue(t, o.sfx, { gain: o.gain ?? 0, pan: o.pan ?? (this.x / cfg.W - 0.5) * 0.6, note: o.note ?? 0 });
      return this;
    }
    out(kind, t, o = {}) {
      t = T(t); const fn = OUT[kind]; const opt = Object.assign({ id: this.id }, o);
      const dur = o.dur ?? OUT_DUR[kind] ?? 0.3; this.t1 = t + dur;
      if (kind !== 'cut') this.track(tt => { const u = tt - t + HALF(); return u < 0 ? null : fn(u, opt); });
      if (o.sfx) DM.cue(t, o.sfx, { gain: o.gain ?? 0 });
      if (o.log) DM.ev(t, `out ${o.label || this.id}`);
      return this;
    }
    /** relative move between t0 and t1: {x,y,r,s(multiplier)} reached at t1 and held */
    move(t0, t1, to, ease = E.ioC) {
      t0 = T(t0); t1 = T(t1);
      this.track(tt => { const k = ease(clamp((tt - t0) / Math.max(1e-6, t1 - t0))); return { x: (to.x || 0) * k, y: (to.y || 0) * k, r: (to.r || 0) * k, s: to.s ? lerp(1, to.s, k) : 1, o: to.o != null ? lerp(1, to.o, k) : 1 }; });
      return this;
    }
    /** scale bump on each time in `times` (beat pulse / "bounce") */
    pulse(times, amp = 0.06, decay = 0.12) {
      const ts = times.map(T).sort((a, b) => a - b);
      this.track(tt => { let last = -1e9; for (const x of ts) if (x <= tt + HALF()) last = x; const u = tt - last; return u > 1 ? null : { s: 1 + amp * Math.exp(-u / decay) }; });
      return this;
    }
    wiggle(t0, t1, deg = 3, hz = 4) { t0 = T(t0); t1 = T(t1); this.track(tt => (tt < t0 || tt > t1) ? null : { r: deg * Math.sin((tt - t0) * hz * 2 * Math.PI) * Math.min(1, (t1 - tt) / 0.2) }); return this; }
    bob(t0, t1, px = 8, period = DM.beatS()) { t0 = T(t0); t1 = T(t1); this.track(tt => (tt < t0 || tt > t1) ? null : { y: -px * Math.abs(Math.sin((tt - t0) / period * Math.PI)) }); return this; }
    float(px = 4, deg = 0.6, period = 2.4) { const ph = DM.rand(this.id, 'fl') * 6.28; this.track(tt => ({ y: px * Math.sin(tt / period * 6.283 + ph), r: deg * Math.sin(tt / period * 6.283 * 0.7 + ph) })); return this; }
    measure() {   // untransformed size (layout runs with every transform cleared); SVG elements have no offsetWidth
      if (this.el.offsetWidth !== undefined) { this.w = this.el.offsetWidth; this.h = this.el.offsetHeight; }
      else { const w = +this.el.getAttribute('width'), hh = +this.el.getAttribute('height'); if (w && hh) { this.w = w; this.h = hh; } else { const r = this.el.getBoundingClientRect(); this.w = r.width; this.h = r.height; } }
    }
    afterLayout() {}
    visibleAt(t) { const u0 = t - this.t0 + HALF(), u1 = t - this.t1 + HALF(); return u0 >= 0 && u1 < 0; }
    update(t) {
      if (!this.visibleAt(t)) { if (!this._hidden) { this.el.style.visibility = 'hidden'; this._hidden = true; } return false; }
      if (this._hidden || this._hidden === undefined) { this.el.style.visibility = 'visible'; this._hidden = false; }
      let x = this.x, y = this.y, r = this.r, sc = this.sc, sx = 1, sy = 1, op = this.op;
      for (const fn of this.tracks) { const p = fn(t); if (!p) continue; if (p.x) x += p.x; if (p.y) y += p.y; if (p.r) r += p.r; if (p.s != null) sc *= p.s; if (p.sx != null) sx *= p.sx; if (p.sy != null) sy *= p.sy; if (p.o != null) op *= p.o; }
      if (this.boil) { const k = DM.boilStep(t); x += this.boil.px * DM.sr(this.id, k, 'x'); y += this.boil.px * DM.sr(this.id, k, 'y'); r += this.boil.deg * DM.sr(this.id, k, 'r'); }
      const tx = x - this.ax * this.w, ty = y - this.ay * this.h;
      this.el.style.transformOrigin = `${this.ax * 100}% ${this.ay * 100}%`;
      this.el.style.transform = `translate(${tx.toFixed(2)}px,${ty.toFixed(2)}px) rotate(${r.toFixed(3)}deg) scale(${(sc * sx).toFixed(4)},${(sc * sy).toFixed(4)})`;
      this.el.style.opacity = clamp(op).toFixed(3);
      this.inner && this.inner(t);
      return true;
    }
  }
  DM.Node = Node;

  // ---------- Shot ----------
  class Shot {
    constructor(id, t0, t1, o = {}) {
      this.id = id; this.t0 = T(t0); this.t1 = T(t1); this.nodes = []; this.o = o; this.camKeys = o.cam || [[this.t0, { x: 0, y: 0, s: 1, r: 0 }]];
      this.el = h('div', 'shot'); this.el.dataset.shot = id; this.el.style.zIndex = o.z ?? 10;
      if (o.paper !== false) { this.paper = h('div', 'paper'); this.grain = h('div', 'grain'); this.paper.appendChild(this.grain); }
      this.world = h('div', 'world'); if (this.paper) this.world.appendChild(this.paper);
      this.el.appendChild(this.world); document.getElementById('stage').appendChild(this.el);
      this.shakes = []; this.pulses = []; this.drift = o.drift ?? null; shots.push(this);
      if (o.blur) {   // directional (horizontal) motion blur for whip pans, driven by keyframes [[t, px]]
        let defs = document.getElementById('dm-defs'); if (!defs) { defs = s('svg', { id: 'dm-defs', width: 0, height: 0 }); defs.style.position = 'absolute'; document.body.appendChild(defs); }
        const fid = 'dmblur-' + id.replace(/[^a-z0-9]/gi, ''); const f = s('filter', { id: fid, x: '-10%', y: '-10%', width: '120%', height: '120%' });
        this.blurNode = s('feGaussianBlur', { stdDeviation: '0 0' }); f.appendChild(this.blurNode); defs.appendChild(f); this.blurId = fid;
      }
      if (o.log !== false) DM.ev(this.t0, 'cut ' + id);
    }
    add(n) { return n; }
    cam(keys) { this.camKeys = keys; return this; }
    shake(t, amp = 7, frames = 5) { this.shakes.push({ t: T(t), amp, frames }); return this; }
    pulse(times, amp = 0.012, decay = 0.09) { for (const t of times) this.pulses.push({ t: T(t), amp, decay }); return this; }
    active(t) { return t - this.t0 + HALF() >= 0 && t - this.t1 + HALF() < 0; }
    update(t) {
      const on = this.active(t);
      if (on !== this._on) { this.el.style.display = on ? 'block' : 'none'; this._on = on; }
      if (!on) return;
      const c = DM.kf(this.camKeys, t); let cx = c.x || 0, cy = c.y || 0, cs = c.s ?? 1, cr = c.r || 0;
      for (const sh of this.shakes) { const f = (t - sh.t) * 60; if (f >= 0 && f < sh.frames) { const a = sh.amp * (1 - f / sh.frames); cx += a * DM.sr(this.id, 'shx', Math.floor(f)); cy += a * DM.sr(this.id, 'shy', Math.floor(f)); cr += a * 0.04 * DM.sr(this.id, 'shr', Math.floor(f)); } }
      let pulse = 1; for (const p of this.pulses) { const u = t - p.t + HALF(); if (u >= 0 && u < 0.6) pulse += p.amp * Math.exp(-u / p.decay); }
      cs *= pulse;
      if (this.drift) { const u = (t - this.t0) / Math.max(0.01, this.t1 - this.t0); cs *= lerp(1, this.drift.s ?? 1.04, E.ioSine(clamp(u))); cx += (this.drift.x || 0) * E.ioSine(clamp(u)); cy += (this.drift.y || 0) * E.ioSine(clamp(u)); }
      const W = cfg.W, H = cfg.H, ocx = this.o.focus ? this.o.focus[0] : W / 2, ocy = this.o.focus ? this.o.focus[1] : H / 2;
      this.world.style.transform = `translate(${(ocx + cx).toFixed(2)}px,${(ocy + cy).toFixed(2)}px) rotate(${cr.toFixed(3)}deg) scale(${cs.toFixed(4)}) translate(${-ocx}px,${-ocy}px)`;
      if (this.grain) { const k = DM.boilStep(t); this.grain.style.backgroundPosition = `${Math.floor(DM.rand(this.id, 'gx', k) * 512)}px ${Math.floor(DM.rand(this.id, 'gy', k) * 512)}px`; }
      if (this.blurNode) { const b = DM.kf(this.o.blur, t); if (b > 0.3) { this.blurNode.setAttribute('stdDeviation', `${b.toFixed(1)} 0`); this.el.style.filter = `url(#${this.blurId})`; } else this.el.style.filter = 'none'; }
      for (const n of this.nodes) n.update(t);
    }
  }
  DM.shot = (id, t0, t1, o) => new Shot(id, t0, t1, o);

  // ---------- text ----------
  /** parse 'abc[key]def[key2|mint]' -> runs */
  const runs = (text, keyColor) => {
    const out = []; const re = /\[([^\]|]+)(?:\|([a-z]+))?\]/g; let last = 0, m;
    while ((m = re.exec(text))) { if (m.index > last) out.push({ t: text.slice(last, m.index) }); out.push({ t: m[1], key: m[2] || keyColor }); last = m.index + m[0].length; }
    if (last < text.length) out.push({ t: text.slice(last) });
    return out;
  };
  const runsHTML = (rs, split) => rs.map(r => {
    const body = split ? [...r.t].map(c => c === '\n' ? '\n' : `<span class="ch">${esc(c)}</span>`).join('') : esc(r.t);
    return r.key ? `<span class="k ${r.key}">${body}</span>` : body;
  }).join('');

  /** layered title: ink + hard offset colour shadow (the product's .ds-title), key words bigger & sticker-outlined (.ds-sticker),
   *  optional highlighter band (.ds-hl) swiped on, optional type-on.  o: {text, x, y, size, font:'display', shadow:'pink'|'mint'|'yellow'|null,
   *  key:'pink', ks:1.28, color, hl:{color, part:'all'|'key', t, dur}, type:{t, step}, sticker:'yellow'|... (whole title as a sticker word)} */
  class Title extends Node {
    constructor(shot, o) {
      const el = h('div', `ttl t-${o.font || 'display'}`);
      el.style.fontSize = (o.size || 128) + 'px';
      if (o.color) el.style.color = o.color.startsWith('--') ? `var(${o.color})` : o.color;
      if (o.ks) el.style.setProperty('--ks', o.ks + 'em');
      if (o.lh) el.style.lineHeight = o.lh;
      if (o.align) el.style.textAlign = o.align;
      const rs = runs(o.text, o.key || 'pink'); const split = !!o.type;
      const shadow = o.shadow === undefined ? 'pink' : o.shadow;
      let html = '';
      if (o.hl) html += `<div class="hlwrap"></div>`;
      if (shadow) html += `<div class="lay sh" style="--shc:var(--${shadow})">${runsHTML(rs, split)}</div>`;
      html += `<div class="lay base fg${o.sticker ? ' stk' : ''}">${runsHTML(rs, split)}</div>`;
      el.innerHTML = html;
      if (o.sticker) { const fg = el.querySelector('.fg'); fg.style.color = `var(--${o.sticker})`; fg.style.webkitTextStroke = '.075em var(--ink)'; fg.style.paintOrder = 'stroke fill'; fg.style.textShadow = '.055em .065em 0 var(--ink)'; }
      super(shot, el, Object.assign({ ax: 0, ay: 0.5 }, o));
      this.label = o.text.replace(/[\[\]|a-z]/g, '').slice(0, 12); this.shadowName = shadow; this.so = o.so ?? 0.06;
      this.sh = el.querySelector('.sh'); this.fg = el.querySelector('.fg'); this.hlw = el.querySelector('.hlwrap');
      this.chars = split ? [[...this.fg.querySelectorAll('.ch')], this.sh ? [...this.sh.querySelectorAll('.ch')] : []] : null;
      if (o.type) { const t0 = T(o.type.t); this.typeT = t0; this.typeStep = o.type.step ?? DM.beatS() / 4; DM.ev(t0, 'type ' + this.label); }
      if (o.hl) { this.hlT = T(o.hl.t); this.hlDur = o.hl.dur ?? DM.beatS(); DM.ev(this.hlT, 'swipe ' + this.label); if (o.hl.sfx !== false) DM.cue(this.hlT, 'squeak', { gain: -4 }); }
      if (shadow) this.sh.style.transform = `translate(${this.so}em,${this.so}em)`;
    }
    afterLayout() {
      if (!this.o.hl) return;
      const hl = this.o.hl; let x0 = 0, x1 = this.fg.offsetWidth, top = 0, hh = this.fg.offsetHeight;
      const fr = this.fg.getBoundingClientRect();
      if (hl.part === 'key') { const k = this.fg.querySelector('.k'); if (k) { const kr = k.getBoundingClientRect(); x0 = kr.left - fr.left; x1 = kr.right - fr.left; } }
      else {   // measure up to the last non-punctuation character (CJK punctuation is full-width: its box is mostly empty)
        const PUNCT = /[，。！？、…：；」』,.!?\s]/; const wk = document.createTreeWalker(this.fg, NodeFilter.SHOW_TEXT); let ln = null, li = 0;
        while (wk.nextNode()) { const nd = wk.currentNode; for (let i = 0; i < nd.data.length; i++) if (!PUNCT.test(nd.data[i])) { ln = nd; li = i; } }
        if (ln) { const rg = document.createRange(); rg.setStart(this.fg, 0); rg.setEnd(ln, li + 1); const rr = rg.getBoundingClientRect(); x0 = rr.left - fr.left; x1 = rr.right - fr.left; }
      }
      const fs = parseFloat(this.el.style.fontSize);
      const bandTop = top + hh * (hl.top ?? 0.52), bandH = hh * (hl.h ?? 0.36), pad = fs * 0.12;
      const W = x1 - x0 + pad * 2;
      const svg = s('svg', { width: W + 40, height: bandH + 40, viewBox: `0 0 ${W + 40} ${bandH + 40}` });
      svg.style.cssText = `position:absolute;left:${x0 - pad - 20}px;top:${bandTop - 20}px;overflow:visible`;
      const p = s('path', { fill: `var(--${hl.color || 'mint'})` }); svg.appendChild(p);
      this.hlw.appendChild(svg); this.hlSvg = svg; this.hlPath = p; this.hlW = W; this.hlH = bandH;
    }
    inner(t) {
      if (this.sh && this.shadowName) {   // the colour layer prints 2 frames after the ink lands (layered lettering)
        const u = (t - this.t0 + HALF()) * 60; const k = this.o.lateShadow === false ? 1 : E.outBack(clamp((u - 1.5) / 4), 2.4);
        this.sh.style.transform = `translate(${(this.so * k).toFixed(4)}em,${(this.so * k).toFixed(4)}em)`;
      }
      if (this.chars) {
        const [fg, sh] = this.chars;
        for (let i = 0; i < fg.length; i++) {
          const u = t - (this.typeT + i * this.typeStep) + HALF();
          const vis = u >= 0; const sc = vis ? lerp(0.55, 1, E.outBack(clamp(u * 60 / 4), 2.6)) : 0;
          const st = vis ? `scale(${sc.toFixed(3)})` : 'scale(0)';
          fg[i].style.transform = st; if (sh[i]) sh[i].style.transform = st;
        }
      }
      if (this.hlPath) {
        const k = E.outC(clamp((t - this.hlT + HALF()) / this.hlDur)); const step = DM.boilStep(t);
        const r = DM.rng(DM.hash(this.id, 'hl', step)); const W = this.hlW, H = this.hlH, ox = 20, oy = 20;
        const xe = ox + W * k; let d = `M${ox + 2 + r() * 6},${oy + r() * 5}`;
        const n = 8; for (let i = 1; i <= n; i++) d += ` L${ox + (xe - ox) * i / n},${oy + (r() - 0.5) * 6 - i * 0.3}`;
        d += ` L${xe + 8 * r()},${oy + H * 0.33} L${xe - 6 * r()},${oy + H * 0.66} L${xe + 4 * r()},${oy + H}`;
        for (let i = n - 1; i >= 0; i--) d += ` L${ox + (xe - ox) * i / n},${oy + H + (r() - 0.5) * 7 + i * 0.25}`;
        d += ` L${ox - 4 * r()},${oy + H * 0.5} Z`;
        this.hlPath.setAttribute('d', k <= 0 ? '' : d);
      }
    }
  }
  DM.title = (shot, o) => new Title(shot, o);
  /** plain line (Marker/Hand/Note/Digits) — same machinery, no colour shadow unless asked */
  DM.text = (shot, o) => new Title(shot, Object.assign({ font: 'marker', shadow: null, size: 64 }, o));
  DM.logo = (shot, o) => { const el = h('div', 'logo'); el.textContent = o.text || 'MUSIC SPACE'; el.style.fontSize = (o.size || 120) + 'px'; return new Node(shot, el, o); };
  DM.stamp = (shot, o) => { const el = h('div', `stamp ${o.color || 'pink'}`); el.textContent = o.text; el.style.fontSize = (o.size || 56) + 'px'; const n = new Node(shot, el, Object.assign({ r: -7 }, o)); n.label = 'stamp ' + o.text; return n; };
  DM.chip = (shot, o) => { const el = h('div', `chip ${o.color || ''}`, o.html || esc(o.text)); el.style.fontSize = (o.size || 40) + 'px'; const n = new Node(shot, el, o); n.label = 'chip ' + (o.text || ''); return n; };
  DM.card = (shot, o) => { const el = h('div', 'card', o.html || ''); el.style.width = o.w + 'px'; if (o.hgt) el.style.height = o.hgt + 'px'; if (o.pad != null) el.style.padding = o.pad; if (o.bg) el.style.background = o.bg; return new Node(shot, el, o); };
  DM.fine = (shot, o) => { const el = h('div', 'fine'); el.textContent = o.text; if (o.size) el.style.fontSize = o.size + 'px'; return new Node(shot, el, Object.assign({ boil: false }, o)); };

  // ---------- paper objects ----------
  DM.polaroid = (shot, o) => {
    const el = h('div', 'pol'); el.style.width = o.w + 'px'; el.style.height = o.hgt + 'px';
    el.innerHTML = `<div class="ph"><img decoding="sync" src="${o.src}" style="${o.imgStyle || ''}"></div>${o.cap ? `<div class="cap">${o.cap}</div>` : ''}`;
    const n = new Node(shot, el, o); n.img = el.querySelector('img'); n.label = 'polaroid ' + (o.label || ''); return n;
  };
  DM.cutout = (shot, o) => {   // rectangular die-cut of real UI (crop) on a paper-card margin
    const el = h('div', 'die'); el.style.width = o.w + 'px'; el.style.height = o.hgt + 'px'; if (o.pad != null) el.style.padding = o.pad + 'px';
    el.innerHTML = `<div class="cut"><img decoding="sync" src="${o.src}"></div>`; const n = new Node(shot, el, o); n.label = 'cutout ' + (o.label || ''); return n;
  };
  DM.svgcut = (shot, o) => {   // die-cut sticker around an alpha shape (avatar SVG/PNG): paper margin + ink line + hard shadow
    const el = h('div', 'svgcut'); el.innerHTML = `<img decoding="sync" src="${o.src}" style="width:${o.w}px;display:block">`;
    const n = new Node(shot, el, o); n.label = 'sticker ' + (o.label || ''); return n;
  };
  DM.tape = (shot, o) => { const el = h('div', 'tape ' + (o.color || '')); el.style.width = (o.w || 190) + 'px'; el.style.height = (o.hgt || 52) + 'px'; return new Node(shot, el, Object.assign({ boil: { px: 0.4, deg: 0.3 } }, o)); };
  DM.img = (shot, o) => { const el = h('img'); el.decoding = 'sync'; el.src = o.src; if (o.w) el.style.width = o.w + 'px'; if (o.hgt) el.style.height = o.hgt + 'px'; el.style.display = 'block'; return new Node(shot, el, Object.assign({ boil: false }, o)); };
  DM.div = (shot, o) => { const el = h('div', o.cls2 || '', o.html || ''); if (o.w) el.style.width = o.w + 'px'; if (o.hgt) el.style.height = o.hgt + 'px'; return new Node(shot, el, o); };

  // ---------- doodles (the product's kit.css shapes) ----------
  const SHAPES = {
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
  };
  DM.shapes = SHAPES;
  const COLORS = { pink: 'var(--pink)', mint: 'var(--mint)', yellow: 'var(--yellow)', ink: 'var(--ink)', white: 'var(--card)', sky: '#74b9ff', 'pink-soft': 'var(--pink-soft)', 'mint-soft': 'var(--mint-soft)', 'yellow-soft': 'var(--yellow-soft)', paper: 'var(--paper)', card: 'var(--card)' };
  /** doodle sticker: o.kind, o.size (px), o.color (fill for two-tone/fill shapes, stroke colour for line shapes) */
  DM.deco = (shot, o) => {
    const S = SHAPES[o.kind]; const c = COLORS[o.color || 'ink'] || o.color; const sz = o.size || 60;
    const [, , vw, vh] = S.vb.split(' ').map(Number); const w = o.w || sz, hh = o.hgt || sz * vh / vw;
    let inner;
    if (S.two) inner = `<path d="${S.d}" fill="${c}" transform="translate(${vw * 0.07} ${vh * 0.08})"/><path d="${S.d}" fill="none" stroke="var(--ink)" stroke-width="${S.sw * (o.lw || 1)}" stroke-linejoin="round"/>`;
    else if (S.fill) inner = `<path d="${S.d}" fill="${c}"/>`;
    else inner = `<path d="${S.d}" fill="none" stroke="${c}" stroke-width="${S.sw * (o.lw || 1)}" stroke-linecap="round" stroke-linejoin="round"/>` + (S.extra || '').replace(/currentColor/g, c);
    const el = h('div'); el.innerHTML = `<svg viewBox="${S.vb}" width="${w}" height="${hh}" style="display:block;overflow:visible" preserveAspectRatio="${o.par || 'xMidYMid meet'}">${inner}</svg>`;
    const n = new Node(shot, el, Object.assign({ boil: { px: 1.0, deg: 1.6 } }, o)); n.label = o.kind; return n;
  };
  /** the pink ⇄ sticker (product arrows) */
  DM.swap = (shot, o) => { const el = h('div', 'swap'); el.innerHTML = `<svg viewBox="0 0 24 24"><path d="${SHAPES.swaparrows.d}" fill="none" stroke="#1c1b1a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`; if (o.size) { el.style.width = el.style.height = o.size + 'px'; } const n = new Node(shot, el, o); n.label = 'swap'; return n; };
  /** tap ring (the capture rig's doodle ripple) */
  DM.ripple = (shot, o) => {
    const el = h('div'); el.style.cssText = `width:${o.size || 90}px;height:${o.size || 90}px;border-radius:50%;border:6px solid var(--yellow);box-shadow:0 0 0 4px var(--ink),inset 0 0 0 4px var(--ink),6px 6px 0 4px var(--pink);background:rgba(255,212,71,.25)`;
    const n = new Node(shot, el, Object.assign({ boil: false }, o)); const t0 = T(o.t);
    n.t0 = t0; n.t1 = t0 + 0.5; n.track(t => { const u = clamp((t - t0) / 0.48); return { s: lerp(0.3, 1.2, E.outC(u)), o: 1 - E.inQ(u) }; });
    DM.ev(t0, 'tap'); DM.cue(t0, 'click', { gain: -2 }); return n;
  };
  /** confetti burst of doodles from (x,y) at t: deterministic ballistic flight, then settle & twinkle */
  DM.confetti = (shot, o) => {
    const t0 = T(o.t); const n = o.n || 14; const kinds = o.kinds || ['star', 'heart', 'sparkle', 'plus', 'star', 'sparkle']; const cols = o.colors || ['pink', 'mint', 'yellow'];
    const out = [];
    for (let i = 0; i < n; i++) {
      const r = DM.rng(DM.hash(o.id || 'cf', i)); const kind = kinds[i % kinds.length];
      const d = DM.deco(shot, { kind, color: cols[i % cols.length], size: lerp(o.min || 34, o.max || 74, r()), x: o.x, y: o.y, z: o.z, id: (o.id || 'cf') + i });
      const ang = lerp(o.a0 ?? -170, o.a1 ?? -10, (i + r() * 0.8) / n) * Math.PI / 180, sp = lerp(o.v0 ?? 900, o.v1 ?? 1700, r());
      const vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp, g = o.g ?? 2600, spin = (r() - 0.5) * 900, land = lerp(0.45, 0.75, r());
      d.t0 = t0; d.track(t => { let u = t - t0 + HALF(); if (u < 0) return null; const uu = Math.min(u, land); const slow = Math.exp(-3.2 * uu);
        const px = vx * (1 - slow) / 3.2, py = vy * (1 - slow) / 3.2 + 0.5 * g * uu * uu * 0.35;
        return { x: px, y: py, r: spin * uu * slow, s: Math.min(1, u * 60 / 4) * (u > land ? 1 + 0.08 * Math.sin((u - land) * 9 + i) : 1) }; });
      out.push(d);
    }
    DM.ev(t0, 'confetti'); return out;
  };

  // ---------- marker strokes ----------
  const P = DM.paths = {
    /** open hand-drawn loop around an ellipse, overshooting its start (marker circle) */
    loop(cx, cy, rx, ry, r, o = {}) {
      const turns = o.turns ?? 1.12, n = 44, a0 = (o.a0 ?? -100) * Math.PI / 180, wob = o.wob ?? 0.045, tilt = (o.tilt ?? -4) * Math.PI / 180;
      const ph = r() * 6.28, ph2 = r() * 6.28; let d = '';
      for (let i = 0; i <= n; i++) {
        const k = i / n, a = a0 + k * turns * 2 * Math.PI; const grow = 1 + (k - 0.5) * (o.spiral ?? 0.08);
        const rr = 1 + wob * Math.sin(a * 2 + ph) + wob * 0.6 * Math.sin(a * 3 + ph2) + (r() - 0.5) * 0.012;
        let x = Math.cos(a) * rx * rr * grow, y = Math.sin(a) * ry * rr * grow;
        const xt = x * Math.cos(tilt) - y * Math.sin(tilt), yt = x * Math.sin(tilt) + y * Math.cos(tilt);
        d += (i ? ' L' : 'M') + (cx + xt).toFixed(1) + ',' + (cy + yt).toFixed(1);
      }
      return d;
    },
    /** wobbly line through points (array of [x,y]) */
    line(pts, r, o = {}) { const j = o.jit ?? 2; let d = ''; pts.forEach((p, i) => { d += (i ? ' L' : 'M') + (p[0] + (r() - .5) * j).toFixed(1) + ',' + (p[1] + (r() - .5) * j).toFixed(1); }); return d; },
    /** smooth hand-drawn curve through points (Catmull-Rom -> cubic) with jitter */
    curve(pts, r, o = {}) {
      const j = o.jit ?? 2.5; const q = pts.map(p => [p[0] + (r() - .5) * j, p[1] + (r() - .5) * j]);
      let d = `M${q[0][0].toFixed(1)},${q[0][1].toFixed(1)}`;
      for (let i = 0; i < q.length - 1; i++) { const p0 = q[i - 1] || q[i], p1 = q[i], p2 = q[i + 1], p3 = q[i + 2] || p2;
        const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
        d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`; }
      return d;
    },
    /** zigzag scribble covering a box (for wipes) */
    zigzag(x0, y0, x1, y1, n, r, o = {}) { const pts = []; for (let i = 0; i <= n; i++) { const k = i / n; const x = lerp(x0, x1, k) + (r() - .5) * (o.jx ?? 40); pts.push([x + (i % 2 ? o.lean ?? 140 : -(o.lean ?? 140)) * 0.5, i % 2 ? y1 + (r() - .5) * 30 : y0 + (r() - .5) * 30]); } return P.curve(pts, r, { jit: 8 }); },
    /** wobbly rounded rectangle (device bodies, outlines) */
    rrect(x, y, w, hh, rad, r, o = {}) {
      const j = o.jit ?? 1.6; const J = () => (r() - .5) * j; const k = 0.55;
      const rx = rad, ry = rad;
      return `M${x + rx + J()},${y + J()} L${x + w - rx + J()},${y + J()} C${x + w - rx + rx * k},${y} ${x + w},${y + ry - ry * k} ${x + w + J()},${y + ry + J()} L${x + w + J()},${y + hh - ry + J()} C${x + w},${y + hh - ry + ry * k} ${x + w - rx + rx * k},${y + hh} ${x + w - rx + J()},${y + hh + J()} L${x + rx + J()},${y + hh + J()} C${x + rx - rx * k},${y + hh} ${x},${y + hh - ry + ry * k} ${x + J()},${y + hh - ry + J()} L${x + J()},${y + ry + J()} C${x},${y + ry - ry * k} ${x + rx - rx * k},${y} ${x + rx + J()},${y + J()} Z`;
    },
  };
  /** marker stroke in world coordinates: o.gen(r) -> path d (re-generated per boil step), o.color, o.width, o.t (draw start), o.dur,
   *  o.erase (start), o.edur, o.dash ([on, off] dashes revealed through a mask), o.opacity */
  class Stroke extends Node {
    constructor(shot, o) {
      const svg = s('svg', { width: cfg.W, height: cfg.H, viewBox: `0 0 ${cfg.W} ${cfg.H}`, class: 'ov' });
      const p = s('path', { class: 'mk', stroke: COLORS[o.color] || o.color || 'var(--pink)', 'stroke-width': o.width || 9, opacity: o.opacity ?? 1 });
      if (o.filter) p.setAttribute('filter', o.filter);
      if (o.dash) {
        const mid = 'dmmask' + (++MASKID); const mask = s('mask', { id: mid, maskUnits: 'userSpaceOnUse', x: -2000, y: -2000, width: 6000, height: 5000 });
        const mp = s('path', { fill: 'none', stroke: '#fff', 'stroke-width': (o.width || 9) * 2.5, 'stroke-linecap': 'round' }); mask.appendChild(mp); svg.appendChild(mask);
        p.setAttribute('stroke-dasharray', o.dash.join(' ')); p.setAttribute('mask', `url(#${mid})`); svg.appendChild(p);
        super(shot, svg, Object.assign({ boil: false, ax: 0, ay: 0 }, o)); this.mp = mp;
      } else { svg.appendChild(p); super(shot, svg, Object.assign({ boil: false, ax: 0, ay: 0 }, o)); }
      this.p = p; this.drawT = o.t != null ? T(o.t) : null; this.dur = o.dur ?? DM.beatS(); this.eraseT = o.erase != null ? T(o.erase) : null; this.edur = o.edur ?? 0.12;
      this.t0 = this.drawT ?? -1e9; if (this.eraseT != null) this.t1 = this.eraseT + this.edur + 0.02;
      this.gen = o.gen; this.ease = o.ease || E.ioQ; this.label = o.label || 'stroke';
      if (this.drawT != null && o.log !== false) DM.ev(this.drawT, 'draw ' + this.label);
      if (this.drawT != null && o.sfx !== false) DM.cue(this.drawT, o.sfx || 'squeak', { gain: o.gain ?? -6 });
      this._step = null;
    }
    inner(t) {
      const step = DM.boilStep(t);
      if (step !== this._step) { this._step = step; const d = this.gen(DM.rng(DM.hash(this.id, step))); this.p.setAttribute('d', d); if (this.mp) this.mp.setAttribute('d', d); this.len = this.p.getTotalLength(); }
      const L = this.len; let a = 0, b = 1;
      if (this.drawT != null) b = this.ease(clamp((t - this.drawT + HALF()) / this.dur));
      if (this.eraseT != null) a = E.inQ(clamp((t - this.eraseT + HALF()) / this.edur));
      const target = this.mp || this.p;
      if (this.mp) { this.mp.setAttribute('stroke-dasharray', `0 ${(a * L).toFixed(1)} ${((b - a) * L).toFixed(1)} ${L + 10}`); }
      else target.setAttribute('stroke-dasharray', `0 ${(a * L).toFixed(1)} ${(Math.max(0, b - a) * L).toFixed(1)} ${L + 10}`);
    }
  }
  DM.stroke = (shot, o) => new Stroke(shot, o);

  /** scribble wipe: a fat marker zigzag covers the frame from tCover (4 frames), and is wiped off from tReveal (6 frames).  Lives on its own top shot. */
  DM.wipe = (id, tCover, tReveal, o = {}) => {
    tCover = T(tCover); tReveal = T(tReveal);
    const sh = DM.shot(id, tCover - 0.01, tReveal + (o.edur ?? 0.05) + 0.06, { paper: false, z: 90, log: false });
    const cols = o.colors || ['pink', 'yellow'];
    cols.forEach((c, i) => DM.stroke(sh, { id: id + 's' + i, color: c, width: o.width ?? 330, t: tCover + i * 0.025, dur: o.dur ?? 0.075, erase: tReveal - 1.2 / cfg.fps + i * 0.008, edur: o.edur ?? 0.034, ease: E.lin, log: false, sfx: false,
      gen: r => P.zigzag(-260 + i * 70, -160, cfg.W + 260, cfg.H + 160, o.n ?? 9, r, { lean: 240, jx: 30 }) }));
    DM.ev(tCover, 'wipe ' + id); DM.cue(tCover - 0.05, 'whoosh', { gain: -3 });
    return sh;
  };

  // ---------- devices ----------
  /** footage feed: frames of a pre-extracted sequence.  map(t) -> source frame number (or null to keep), pattern 'dir/f%05d.jpg' */
  const pad = (n, w) => String(n).padStart(w, '0');
  DM.seq = (pattern, map) => t => { const f = map(t); if (f == null) return null; return pattern.replace(/%0(\d)d/, (m, w) => pad(Math.max(0, Math.round(f)), +w)); };
  /** hand-drawn phone. o: {w (body width, px), sw, sh (screen size of the source in px, e.g. 1080x2340), feed: t->src, zoom: keyframes [[t,{s,fx,fy}]], shadow:'mint'} */
  class Device extends Node {
    constructor(shot, el, o, geom) {
      super(shot, el, Object.assign({ boil: { px: 0.3, deg: 0.08 } }, o));
      Object.assign(this, geom); this.feed = o.feed || null; this.zoomKeys = o.zoom || null; this._src = null;
      this.svg = el.querySelector('svg.body'); this.bodyPath = this.svg.querySelector('.bp'); this.shPath = this.svg.querySelector('.sp'); this.linePath = this.svg.querySelector('.lp');
      this.scrEl = el.querySelector('.scr'); this.cnt = el.querySelector('.cnt'); this.feedImg = el.querySelector('img.feed'); this._step = null;
      if (o.src) { this.feedImg.src = o.src; this._src = o.src; }

    }
    inner(t) {
      const step = DM.boilStep(t);
      if (step !== this._step) { this._step = step; const r = DM.rng(DM.hash(this.id, step)); this.drawBody(r); }
      if (this.feed) {   // footage frame sequence: swap the src and wait for the decode before the screenshot (tested: no stale frames)
        const src = this.feed(t);
        if (src && src !== this._src) { this._src = src; this.feedImg.src = src; pending.push(this.feedImg.decode().catch(e => console.error('feed', src, e))); }
      }
      if (this.zoomKeys) { const z = DM.kf(this.zoomKeys, t); const sc = z.s ?? 1; const fx = z.fx ?? this.cw / 2, fy = z.fy ?? this.ch / 2;
        let tx = this.sw0 / 2 - fx * sc, ty = this.sh0 / 2 - fy * sc; tx = Math.min(0, Math.max(this.sw0 - this.cw * sc, tx)); ty = Math.min(0, Math.max(this.sh0 - this.ch * sc, ty));
        this.cnt.style.transform = `translate(${tx.toFixed(2)}px,${ty.toFixed(2)}px) scale(${sc.toFixed(4)})`; }
    }
  }
  DM.phone = (shot, o) => {
    const W = o.w || 470, scrW = W - 2 * (o.bez || 22), srcW = o.srcW || 1080, srcH = o.srcH || 2340; const scrH = scrW * srcH / srcW; const H = scrH + 2 * (o.bez || 22) + 6;
    const bez = o.bez || 22; const sc = o.shadow || 'mint';
    const el = h('div', 'dev phone'); el.style.width = W + 'px'; el.style.height = H + 'px';
    el.innerHTML = `<svg class="body" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><path class="sp" fill="var(--${sc})" transform="translate(${o.sx ?? 18} ${o.sy ?? 20})"/><path class="bp" fill="var(--ink)"/><path class="lp" fill="none" stroke="var(--ink)" stroke-width="5" stroke-linejoin="round"/></svg>`
      + `<div class="scr" style="left:${bez}px;top:${bez + 3}px;width:${scrW}px;height:${scrH}px;border-radius:${o.srad || 38}px"><div class="cnt" style="width:${scrW}px;height:${scrH}px"><img class="feed" decoding="sync" style="width:${scrW}px;height:${scrH}px"></div></div>`
      + `<div style="position:absolute;left:50%;top:${bez * 0.42}px;width:86px;height:9px;margin-left:-43px;border-radius:9px;background:#4a4640"></div>`;
    const n = new Device(shot, el, o, { W, H, sw0: scrW, sh0: scrH, cw: scrW, ch: scrH });
    n.drawBody = r => { const d = P.rrect(1.5, 1.5, W - 3, H - 3, o.rad || 62, r, { jit: 2.2 }); n.bodyPath.setAttribute('d', d); n.shPath.setAttribute('d', d); n.linePath.setAttribute('d', P.rrect(0, 0, W, H, (o.rad || 62) + 1, r, { jit: 3 })); };
    n.label = 'phone'; return n;
  };
  /** hand-drawn laptop: screen of srcW x srcH (16:9) at width o.sw; base deck below */
  DM.laptop = (shot, o) => {
    const scrW = o.sw || 1280, scrH = scrW * (o.srcH || 1080) / (o.srcW || 1920), bez = o.bez || 26, lidW = scrW + 2 * bez, lidH = scrH + 2 * bez + 8, baseH = o.baseH || 64, ext = o.ext || 90;
    const W = lidW + 2 * ext, H = lidH + baseH + 10; const sc = o.shadow || 'pink';
    const el = h('div', 'dev laptop'); el.style.width = W + 'px'; el.style.height = H + 'px';
    el.innerHTML = `<svg class="body" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><path class="sp" fill="var(--${sc})" transform="translate(16 18)"/><path class="bp" fill="var(--ink)"/><path class="lp" fill="none" stroke="var(--ink)" stroke-width="5" stroke-linejoin="round"/><path class="deck" fill="var(--card)" stroke="var(--ink)" stroke-width="5" stroke-linejoin="round"/><path class="deck2" fill="none" stroke="var(--ink)" stroke-width="4" stroke-linecap="round"/></svg>`
      + `<div class="scr" style="left:${ext + bez}px;top:${bez}px;width:${scrW}px;height:${scrH}px;border-radius:10px"><div class="cnt" style="width:${scrW}px;height:${scrH}px"><img class="feed" decoding="sync" style="width:${scrW}px;height:${scrH}px"></div></div>`
      + `<div style="position:absolute;left:50%;top:${bez * 0.36}px;width:10px;height:10px;margin-left:-5px;border-radius:50%;background:#4a4640"></div>`;
    const n = new Device(shot, el, o, { W, H, sw0: scrW, sh0: scrH, cw: scrW, ch: scrH });
    const deck = el.querySelector('.deck'), deck2 = el.querySelector('.deck2');
    n.drawBody = r => {
      const lid = P.rrect(ext + 1.5, 1.5, lidW - 3, lidH - 3, 30, r, { jit: 2 }); n.bodyPath.setAttribute('d', lid); n.linePath.setAttribute('d', P.rrect(ext, 0, lidW, lidH, 31, r, { jit: 3 }));
      const J = () => (r() - .5) * 3; const y0 = lidH - 2, y1 = H - 4;
      const dk = `M${ext - 30 + J()},${y0 + J()} L${W - ext + 30 + J()},${y0 + J()} L${W - 4 + J()},${y1 - 14 + J()} C${W - 2},${y1} ${W - 20},${y1 + 2} ${W - 40 + J()},${y1 + J()} L${40 + J()},${y1 + J()} C${20},${y1 + 2} ${2},${y1} ${4 + J()},${y1 - 14 + J()} Z`;
      deck.setAttribute('d', dk); n.shPath.setAttribute('d', lid + ' ' + dk);
      deck2.setAttribute('d', `M${W / 2 - 120 + J()},${y0 + 12 + J()} L${W / 2 + 120 + J()},${y0 + 12 + J()} M${W / 2 - 150 + J()},${y1 - 14 + J()} L${W / 2 + 150 + J()},${y1 - 14 + J()}`);
    };
    n.label = 'laptop'; return n;
  };


  // ---------- pop-art shapes ----------
  /** comic starburst (two-tone jagged star: marker fill + ink line + hard ink shadow), boiled, slowly turning */
  class Burst extends Node {
    constructor(shot, o) {
      const R = o.rOut || 300; const S = 2 * R + 60;
      const svg = s('svg', { width: S, height: S, viewBox: `${-R - 30} ${-R - 30} ${S} ${S}` }); svg.style.overflow = 'visible';
      const shp = s('path', { fill: 'var(--ink)', transform: `translate(${o.shx ?? 14} ${o.shy ?? 16})` });
      const body = s('path', { fill: COLORS[o.color || 'yellow'] || o.color, stroke: 'var(--ink)', 'stroke-width': o.lw ?? 7, 'stroke-linejoin': 'round' });
      svg.appendChild(shp); svg.appendChild(body); if (o.shadow === false) shp.style.display = 'none';
      super(shot, svg, Object.assign({ boil: { px: 0.8, deg: 0.4 } }, o)); this.body = body; this.shp = shp; this._step = null;
      this.n = o.n || 18; this.rIn = o.rIn || R * 0.72; this.rOut = R; this.spin = o.spin ?? 6; this.label = 'burst';
    }
    inner(t) {
      const step = DM.boilStep(t); if (step === this._step) return; this._step = step;
      const r = DM.rng(DM.hash(this.id, step)); const rot = (step / cfg.boilFps * this.spin) * Math.PI / 180; let d = '';   // rotation on the boil clock (deterministic)
      for (let i = 0; i < this.n * 2; i++) { const a = rot + i * Math.PI / this.n; const rr = (i % 2 ? this.rIn : this.rOut) * (1 + (r() - .5) * 0.07);
        d += (i ? ' L' : 'M') + (Math.cos(a) * rr).toFixed(1) + ',' + (Math.sin(a) * rr).toFixed(1); }
      d += ' Z'; this.body.setAttribute('d', d); this.shp.setAttribute('d', d);
    }
  }
  DM.burst = (shot, o) => new Burst(shot, o);
  /** torn paper scrap: jagged-edged rectangle in a marker tint (collage backing layer) */
  class Scrap extends Node {
    constructor(shot, o) {
      const W = o.w, H = o.hgt; const svg = s('svg', { width: W + 40, height: H + 40, viewBox: `-20 -20 ${W + 40} ${H + 40}` }); svg.style.overflow = 'visible';
      const shp = s('path', { fill: o.shadowColor || 'rgba(28,27,26,.9)', transform: `translate(${o.shx ?? 10} ${o.shy ?? 11})` });
      const body = s('path', { fill: COLORS[o.color] || o.color || 'var(--mint)', stroke: o.line ? 'var(--ink)' : 'none', 'stroke-width': o.line || 0, 'stroke-linejoin': 'round' });
      svg.appendChild(shp); svg.appendChild(body); if (o.shadow === false) shp.style.display = 'none';
      super(shot, svg, Object.assign({ boil: { px: 0.5, deg: 0.2 } }, o)); this.body = body; this.shp = shp; this.W = W; this.H = H; this._step = null; this.label = 'scrap';
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
  /** doodle stick figure (the reference mockup's little people), pose keyframes swap on beats; o.poses = [[t, 'wave'|'jump'|'stand'|'cheer']] */
  const POSES = {
    stand: { la: [-150, -110], ra: [-30, -70], ll: [-105, -95], rl: [-75, -85] },
    wave: { la: [-160, -120], ra: [-50, 40], ll: [-105, -95], rl: [-75, -85] },
    cheer: { la: [-130, 150], ra: [-50, 30], ll: [-110, -100], rl: [-70, -80] },
    jump: { la: [-140, 160], ra: [-40, 20], ll: [-125, -60], rl: [-55, -120] },
    walk1: { la: [-120, -80], ra: [-60, -100], ll: [-120, -100], rl: [-65, -80] },
    walk2: { la: [-60, -100], ra: [-120, -80], ll: [-65, -80], rl: [-120, -100] },
    sad: { la: [-115, -100], ra: [-65, -80], ll: [-100, -92], rl: [-80, -88] },
  };
  class Stick extends Node {
    constructor(shot, o) {
      const S = o.size || 140; const svg = s('svg', { width: S, height: S * 1.6, viewBox: '-50 -20 100 160' }); svg.style.overflow = 'visible';
      const p = s('path', { fill: 'none', stroke: COLORS[o.color || 'ink'] || o.color, 'stroke-width': o.lw ?? 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
      const head = s('ellipse', { fill: o.fill ? COLORS[o.fill] : 'var(--card)', stroke: COLORS[o.color || 'ink'] || o.color, 'stroke-width': o.lw ?? 5 });
      svg.appendChild(p); svg.appendChild(head); super(shot, svg, Object.assign({ boil: { px: 0.8, deg: 1.2 } }, o));
      this.p = p; this.head = head; this.poses = o.poses || [[0, 'stand']]; this._key = null; this.label = 'stick';
    }
    inner(t) {
      let pose = this.poses[0][1]; for (const [pt, nm] of this.poses) if (T(pt) <= t + HALF()) pose = nm;
      const step = DM.boilStep(t); const key = pose + step; if (key === this._key) return; this._key = key;
      const r = DM.rng(DM.hash(this.id, step)); const P0 = POSES[pose] || POSES.stand; const J = () => (r() - .5) * 3;
      const limb = (x, y, [a1, a2], l1, l2) => { const r1 = a1 * Math.PI / 180, r2 = a2 * Math.PI / 180; const x1 = x + Math.cos(r1) * l1, y1 = y - Math.sin(r1) * l1; const x2 = x1 + Math.cos(r2) * l2, y2 = y1 - Math.sin(r2) * l2;
        return `M${x + J()},${y + J()} Q${x1 + J()},${y1 + J()} ${x2 + J()},${y2 + J()}`; };
      const neck = [0, 30], hip = [0, 85];
      let d = `M${neck[0] + J()},${neck[1]} Q${J() * 2},${58 + J()} ${hip[0] + J()},${hip[1] + J()}`;
      d += ' ' + limb(0, 42, P0.la, 26, 24) + ' ' + limb(0, 42, P0.ra, 26, 24) + ' ' + limb(0, 85, P0.ll, 30, 28) + ' ' + limb(0, 85, P0.rl, 30, 28);
      this.p.setAttribute('d', d); this.head.setAttribute('cx', (J() * 0.6).toFixed(1)); this.head.setAttribute('cy', (12 + J() * 0.4).toFixed(1));
      this.head.setAttribute('rx', (17 + J() * 0.3).toFixed(1)); this.head.setAttribute('ry', (18 + J() * 0.3).toFixed(1));
    }
  }
  DM.stick = (shot, o) => new Stick(shot, o);

  // ---------- run ----------
  DM.duration = d => { cfg.duration = d; };
  DM.layout = async () => {
    // Show everything first: faces used only by hidden (display:none) shots are never requested, and measuring before they load
    // would size titles with a fallback font.  Then load every face for the exact text on the stage, and only then measure.
    for (const sh of shots) sh.el.style.display = 'block';
    const text = [...new Set(document.getElementById('stage').textContent + 'MUSIC SPACE 0123456789:')].join('');
    const fams = ['Doodle Display', 'DM Display Raw', 'Doodle Marker', 'DM Marker Raw', 'Doodle Hand', 'DM Hand Raw', 'Doodle Note', 'DM Note Raw', 'DM Logo Raw', 'DM Digits Raw'];
    await Promise.all(fams.map(f => document.fonts.load(`64px "${f}"`, text).catch(() => {})));
    await document.fonts.ready;
    await Promise.all([...document.images].map(i => i.decode().catch(() => {})));
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    for (const sh of shots) for (const n of sh.nodes) { n.el.style.transform = 'none'; n.measure(); }
    for (const sh of shots) for (const n of sh.nodes) n.afterLayout();
    for (const sh of shots) { sh.el.style.display = 'none'; sh._on = false; }
    DM.events.sort((a, b) => a.t - b.t); DM.cues.sort((a, b) => a.t - b.t);
  };
  DM.render = async f => {
    const t = f / cfg.fps; pending = [];
    for (const sh of shots) sh.update(t);
    if (pending.length) await Promise.all(pending);
    return t;
  };
  /** every Title/text node with its on-screen window (for the reading-time QC) */
  DM.texts = () => { const out = []; for (const sh of shots) for (const n of sh.nodes) if (n instanceof Title) {
      const t0 = Math.max(n.typeT ?? n.t0, sh.t0), t1 = Math.min(n.t1, sh.t1); const txt = n.o.text.replace(/\[([^\]|]+)(\|[a-z]+)?\]/g, '$1');
      out.push({ text: txt, font: n.o.font || 'display', size: n.o.size, t0: +t0.toFixed(3), t1: +t1.toFixed(3), shot: sh.id }); } return out; };
  DM.info = () => ({ fps: cfg.fps, W: cfg.W, H: cfg.H, duration: cfg.duration, frames: Math.round(cfg.duration * cfg.fps), bpm: cfg.bpm, offset: cfg.offset, events: DM.events, cues: DM.cues, marks: DM.marks || {}, texts: DM.texts() });
})();
