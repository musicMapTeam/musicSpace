/* doodle-motion · core.js — deterministic, frame-stepped motion system for the Music Space Doodle video (1920x1080, 60 fps).
 *
 * Every pixel is a pure function of the frame number: no CSS animations, no timers, no Date.now(); randomness is hashed from ids.
 * The renderer (tools/render.mjs) calls `await DM.render(f)` and takes one screenshot per frame, in any order, in any worker.
 *
 * TIME is written in storyboard bars and beats (SCRIPT.md / STORYBOARD.md): DM.T('51:1'), DM.T('4:4.5'), DM.T(5, 3).
 * A tempo map (tools/tempo-maps/<id>.json, compiled by tools/tempo.py) says which bar of the chosen track plays under each
 * storyboard bar, so the same scene retimes to any music option.  Rules (identical in tools/tempo.py):
 *   - a position inside a CUT bar has no time: DM.T() -> null, and an element that enters there never appears;
 *   - ends/exits/keyframes inside a cut bar are clamped to the next kept bar (DM.Tc);
 *   - '91:1' (one after the last storyboard bar) = end of the bar grid; DM.end() = end of the film (grid + tail);
 *   - inserted bars exist only in maps that plan them: '28+1:3' = beat 3 of the first bar inserted after storyboard bar 28.
 * Plain numbers are seconds and pass through unchanged.
 *
 * EVENTS: every entrance / draw / wipe / tap logs {t, kind, label, pos, sfx...} into DM.events.  tools/sfx.py turns them into
 * synthesized sound effects (default sound per kind, override with {sfx:'pop'} or silence with {sfx:'none'}); tools/qc.py checks
 * them against the beat grid and the 2.5 s no-event limit.  Sound-only cues: DM.sfx('31:3', 'chime').
 */
(function () {
  'use strict';
  const DM = window.DM = {};
  const cfg = DM.cfg = { fps: 60, W: 1920, H: 1080, bpb: 4, boilFps: 12, safe: { x: 96, y: 54 } };
  const HALF = () => 0.5 / cfg.fps;
  DM.warnings = [];
  DM.warn = msg => { if (!DM.warnings.includes(msg)) { DM.warnings.push(msg); console.warn('[DM] ' + msg); } };

  // ======================================================================================= time (tempo map)
  let MAP = null, IDX = {}, ORDER = [], LASTPLAIN = 90;
  const keyOf = label => { const s = String(label); const i = s.indexOf('+'); return i < 0 ? [parseInt(s, 10), 0] : [parseInt(s.slice(0, i), 10), parseInt(s.slice(i + 1), 10)]; };
  const keyGt = (a, b) => a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]);
  /** install a compiled tempo map (tools/tempo-maps/compiled/<id>.json); stage.html does this before the scenes load */
  DM.useMap = C => {
    MAP = C; IDX = {}; for (const b of C.bars) IDX[b.sb] = b; ORDER = C.bars.map(b => b.sb);
    LASTPLAIN = Math.max(...ORDER.filter(x => !x.includes('+')).map(Number)); cfg.bpb = C.bpb || 4;
  };
  DM.map = () => MAP;
  const parsePos = (pos, beat) => {
    if (typeof pos === 'number' && beat !== undefined) return { bar: String(pos), beat };
    if (typeof pos === 'number') return { sec: pos };
    if (Array.isArray(pos)) return { bar: String(pos[0]), beat: pos[1] ?? 1 };
    const m = String(pos).trim().match(/^(\d+(?:\+\d+)?)(?::(-?[\d.]+))?$/);
    if (!m) throw new Error('DM: bad position "' + pos + '" (use "bar:beat", e.g. "51:1" or "4:4.5")');
    return { bar: m[1], beat: m[2] === undefined ? 1 : parseFloat(m[2]) };
  };
  const tOf = (bar, beat) => {
    if (!MAP) throw new Error('DM: no tempo map installed (open the scene through dm/stage.html?map=...)');
    let b = bar, bt = beat;
    if (!b.includes('+')) {
      let n = parseInt(b, 10);
      while (bt >= cfg.bpb + 1) { bt -= cfg.bpb; n++; }
      while (bt < 1) { bt += cfg.bpb; n--; }
      b = String(n);
      if (!(b in IDX)) return (n === LASTPLAIN + 1 && Math.abs(bt - 1) < 1e-9) ? MAP.grid_end_s : null;
    } else if (!(b in IDX)) return null;
    const r = IDX[b]; return r.t0 + (bt - 1) / cfg.bpb * r.len;
  };
  /** seconds of a storyboard position, or null if its bar is cut in this map */
  DM.T = (pos, beat) => { const p = parsePos(pos, beat); return p.sec !== undefined ? p.sec : tOf(p.bar, p.beat); };
  /** clamped: like T, but a cut bar maps to the start of the next kept bar (never null) */
  DM.Tc = (pos, beat) => {
    const p = parsePos(pos, beat); if (p.sec !== undefined) return p.sec;
    const v = tOf(p.bar, p.beat); if (v !== null) return v;
    const k = keyOf(p.bar);
    for (const lab of ORDER) if (keyGt(keyOf(lab), k)) return IDX[lab].t0;
    return MAP.grid_end_s;
  };
  DM.has = (pos, beat) => DM.T(pos, beat) !== null;
  DM.beatS = () => MAP ? MAP.beat_s : 0.5;
  DM.barS = () => MAP ? MAP.bar_s : 2;
  DM.beats = n => n * DM.beatS();
  DM.end = () => MAP.end_s;
  /** the music credit line of the current map (end card T146 must use it: CC0 tracks vs the team's original score) */
  DM.credit = () => (MAP && MAP.track && MAP.track.credit) || '';
  DM.gridEnd = () => MAP.grid_end_s;
  DM.F = t => Math.round(t * cfg.fps);
  /** output seconds -> {sb, beat, k, label:'bar:beat'} (beat is fractional, 1-based) */
  DM.pos = t => {
    const bars = MAP.bars; let lo = 0, hi = bars.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (bars[mid].t0 <= t + 1e-9) lo = mid; else hi = mid - 1; }
    const b = bars[lo]; const beat = 1 + (t - b.t0) / b.len * cfg.bpb;
    return { sb: b.sb, beat, k: b.k, label: `${b.sb}:${(Math.round(beat * 1000) / 1000)}` };
  };
  const T = v => (v === null || v === undefined) ? v : (typeof v === 'number' ? v : DM.T(v));
  const Tc = v => (typeof v === 'number' ? v : DM.Tc(v));
  DM._T = T; DM._Tc = Tc;

  // ======================================================================================= deterministic randomness
  DM.hash = (...a) => {
    let h = 2166136261 >>> 0;
    for (const x of a) { const s = String(x); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } h ^= 0x9e37; h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  };
  DM.rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  DM.rand = (...a) => DM.rng(DM.hash(...a))();
  DM.sr = (...a) => DM.rand(...a) * 2 - 1;
  DM.boilStep = t => Math.floor(t * cfg.boilFps + 1e-6);

  // ======================================================================================= easing / keyframes
  const clamp = DM.clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = DM.lerp = (a, b, x) => a + (b - a) * x;
  const E = DM.E = {
    lin: x => x, inQ: x => x * x, outQ: x => 1 - (1 - x) * (1 - x), ioQ: x => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2,
    inC: x => x * x * x, outC: x => 1 - Math.pow(1 - x, 3), ioC: x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
    outQuart: x => 1 - Math.pow(1 - x, 4), outExpo: x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x), inExpo: x => x <= 0 ? 0 : Math.pow(2, 10 * x - 10),
    ioSine: x => -(Math.cos(Math.PI * x) - 1) / 2,
    outBack: (x, k = 1.9) => 1 + (k + 1) * Math.pow(x - 1, 3) + k * Math.pow(x - 1, 2),
    /** the product's pop easing cubic-bezier(.34,1.56,.64,1) (approximation) */
    pop: x => E.outBack(x, 2.2),
    step: x => x >= 1 ? 1 : 0,
  };
  /** damped spring 0 -> 1 with overshoot; u in seconds */
  DM.spring = (u, freq = 2.6, damp = 9) => u <= 0 ? 0 : 1 - Math.exp(-damp * u) * Math.cos(2 * Math.PI * freq * u);
  /** keyframes [[at, value, ease], ...]; value = number or {k: number}; `ease` shapes the segment that ENDS at that key.
   *  Times are positions ('5:3') or seconds; positions inside cut bars are clamped (DM.Tc). */
  DM.kf = (keys, t) => {
    if (!keys || !keys.length) return 0;
    const tt = keys._t || (keys._t = keys.map(k => Tc(k[0])));
    if (t <= tt[0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t < tt[i]) {
        const a = keys[i - 1], b = keys[i];
        const x = (b[2] || E.ioC)(clamp((t - tt[i - 1]) / Math.max(1e-6, tt[i] - tt[i - 1])));
        if (typeof a[1] === 'number') return lerp(a[1], b[1], x);
        const o = {}; for (const k in b[1]) o[k] = lerp(a[1][k] ?? b[1][k], b[1][k], x); for (const k in a[1]) if (!(k in o)) o[k] = a[1][k]; return o;
      }
    }
    return keys[keys.length - 1][1];
  };

  // ======================================================================================= registries / events
  const shots = DM.shots = [];
  DM.events = [];
  DM.marks = {};
  DM.used = { assets: new Set(), clips: new Set(), script: new Set() };
  /** log an event.  kind: slam pop stamp slap drop rise slide fade grow type swipe draw wipe tap confetti punch cut sfx ...
   *  o.sfx: undefined = default sound for the kind, 'none' = silent, or a sound name (see tools/sfx.py); o.gain dB; o.pan -1..1 */
  DM.ev = (at, kind, label, o = {}) => {
    const t = T(at); if (t === null || t === undefined || !isFinite(t)) return null;
    const e = { t: +t.toFixed(5), kind, label: label || kind, pos: MAP ? DM.pos(t).label : null };
    for (const k of ['sfx', 'gain', 'pan', 'note', 'size', 'shot', 'id', 'dur', 'visual']) if (o[k] !== undefined && o[k] !== null) e[k] = o[k];
    if (o.sfx === false) e.sfx = 'none';
    DM.events.push(e); return e;
  };
  /** sound-only cue (not a visual event): DM.sfx('31:3', 'chime', {gain: -2}) */
  DM.sfx = (at, name, o = {}) => DM.ev(at, 'sfx', name, Object.assign({}, o, { sfx: name, visual: false }));
  /** named time marks for tools (e.g. DM.mark('qr', '86:1') tells the QC where to decode the QR) */
  DM.mark = (name, at) => { const t = T(at); if (t !== null) DM.marks[name] = t; };

  const SVGNS = 'http://www.w3.org/2000/svg';
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const s = (tag, attrs = {}) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  DM.h = h; DM.s = s;
  DM.esc = x => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let NID = 0;
  DM.nid = () => ++NID;

  // ======================================================================================= entrances / exits
  // frame counts follow STORYBOARD §1.6 (60 fps); u is seconds since the entrance
  const ff = u => u * 60;
  const IN = DM.IN = {
    none: () => ({}),
    /** SLAM: f0 scale 1.60 rot -3 -> f3 0.95 -> f6 1.00 rot 0 */
    slam: (u, o) => { const f = ff(u); const d = o.dir || 1; const big = o.big ?? 1.6;
      const sc = f < 3 ? lerp(big, 0.95, E.outC(f / 3)) : f < 6 ? lerp(0.95, 1, E.ioQ((f - 3) / 3)) : 1;
      return { s: sc, r: f < 6 ? lerp(-3 * d, 0, E.outC(f / 6)) : 0 }; },
    /** POP: f0 scale 0 -> f5 1.15 -> f8 1.00; wobble +-4 deg settling by f12 */
    pop: (u, o) => { const f = ff(u); const big = o.big ?? 1.15;
      const sc = f < 5 ? lerp(0, big, E.outQ(f / 5)) : f < 8 ? lerp(big, 1, E.ioQ((f - 5) / 3)) : 1;
      const w = f < 12 ? (o.wob ?? 4) * Math.sin(f / 12 * Math.PI * 2.5) * (1 - f / 12) : 0;
      return { s: sc, r: w }; },
    /** springy pop (the animatic's), for big stickers */
    spring: (u, o) => { const sc = DM.spring(u, o.freq ?? 2.6, o.damp ?? 9); const w = (o.wob ?? 6) * Math.exp(-8 * u) * Math.sin(u * 2 * Math.PI * 3.2); return { s: Math.max(0, sc), r: w }; },
    /** STAMP: f0 scale 1.30 rot -12 -> f4 1.00 (rest rotation stays the node's own r); 2-frame shake */
    stamp: (u, o) => { const f = ff(u); const sc = f < 4 ? lerp(o.big ?? 1.3, 1, E.outC(f / 4)) : 1; const sh = f < 6 ? (6 - f) / 6 * 5 : 0;
      return { s: sc, r: f < 4 ? lerp(-5, 0, E.outC(f / 4)) : 0, x: sh * DM.sr(o.id, 'sx', Math.floor(f)), y: sh * DM.sr(o.id, 'sy', Math.floor(f)), o: f < 1 ? 0.6 : 1 }; },
    /** paper slapped onto paper */
    slap: (u, o) => { const f = ff(u); const k = clamp(f / (o.frames ?? 9));
      return { s: lerp(o.big ?? 1.22, 1, E.outBack(k, 1.4)), r: lerp(o.spin ?? 7, 0, E.outC(k)), y: lerp(o.dy ?? -26, 0, E.outC(k)) }; },
    /** DROP: falls from -120 px, ease-out-back, 10 frames */
    drop: (u, o) => { const k = clamp(ff(u) / (o.frames ?? 10)); return { y: lerp(-(o.dist ?? 120), 0, E.outBack(k, 2.2)), o: k > 0 ? 1 : 0 }; },
    rise: (u, o) => { const k = clamp(u / (o.dur ?? 0.42)); return { y: lerp(o.dist ?? 1100, 0, E.outBack(k, o.k ?? 1.25)), r: lerp(o.spin ?? 4, 0, E.outC(k)) }; },
    slide: (u, o) => { const k = (o.ease || E.outC)(clamp(u / (o.dur ?? 0.36))); return { x: lerp(o.dx ?? 0, 0, k), y: lerp(o.dy ?? 0, 0, k), r: lerp(o.dr ?? 0, 0, k) }; },
    fade: (u, o) => ({ o: clamp(u / (o.dur ?? 0.2)) }),
    grow: (u, o) => { const k = (o.ease || E.outBack)(clamp(u / (o.dur ?? 0.3))); return { s: Math.max(0, k) }; },
    wipe: (u, o) => ({ clip: clamp(u / (o.dur ?? 0.25)) }),
  };
  const OUT = DM.OUT = {
    cut: () => ({}),
    /** POP-OUT: scale -> 0 in 4 frames (after a 2-frame swell) */
    pop: (u) => { const f = ff(u); return { s: f < 2 ? lerp(1, 1.08, f / 2) : Math.max(0, lerp(1.08, 0, (f - 2) / 4)) }; },
    fade: (u, o) => ({ o: 1 - clamp(u / (o.dur ?? 0.2)) }),
    slide: (u, o) => { const k = (o.ease || E.inC)(clamp(u / (o.dur ?? 0.3))); return { x: (o.dx ?? 0) * k, y: (o.dy ?? 0) * k, r: (o.dr ?? 0) * k }; },
    shrink: (u, o) => { const k = E.inC(clamp(u / (o.dur ?? 0.18))); return { s: 1 - k }; },
  };
  const OUT_DUR = { cut: 0, pop: 6 / 60, fade: null, slide: null, shrink: null };

  // ======================================================================================= Node
  class Node {
    constructor(shot, el, o = {}) {
      this.shot = shot; this.el = el; this.o = o; this.id = o.id || (shot.id + ':' + (++NID));
      this.x = o.x ?? 0; this.y = o.y ?? 0; this.r = o.r ?? 0; this.sc = o.s ?? 1; this.op = o.o ?? 1;
      this.ax = o.ax ?? 0.5; this.ay = o.ay ?? 0.5;     // anchor inside the element (0..1): (x,y) is where this point sits
      this.origin = o.origin || null;                    // [px, py] pivot for rotate/scale (default: the anchor point)
      this.tracks = []; this.t0 = -1e9; this.t1 = 1e9; this.w = 0; this.h = 0; this.label = o.label || null;
      this.boil = o.boil === false ? null : Object.assign({ px: 0.6, deg: 0.25 }, o.boil || {});
      el.classList.add('n'); el.style.zIndex = String(o.z ?? o.layer ?? 10); if (o.cls) el.classList.add(...o.cls.split(' '));
      if (o.style) Object.assign(el.style, o.style);
      this.parent = o.parent || null;
      const host = o.parent ? (o.parent.host || o.parent.el) : shot.world;
      host.appendChild(el);
      shot.nodes.push(this);
      if (o.at !== undefined && o.fx !== undefined) this.in(o.fx, o.at, o.fxo || {});
    }
    track(fn) { this.tracks.push(fn); return this; }
    /** entrance at `at` (visible from then).  o: {label, sfx, gain, pan, note, log:false} + per-kind options (big, dir, dur, dx, dy...) */
    in(kind, at, o = {}) {
      const t = T(at);
      if (t === null || t === undefined) { this.t0 = Infinity; this.never = true; return this; }   // starts in a cut bar: never shown
      this.t0 = t; const fn = IN[kind]; if (!fn) throw new Error('DM: unknown entrance ' + kind);
      const opt = Object.assign({ id: this.id }, o);
      this.track(tt => { const u = tt - t + HALF(); return u < 0 ? null : fn(u, opt); });
      if (kind === 'slam' && o.shake !== false) this.shot.shake(t, o.shake ?? 4, 3);
      if (o.log !== false) DM.ev(t, kind, o.label || this.label || this.id, { sfx: o.sfx, gain: o.gain, pan: o.pan ?? (this.x / cfg.W - 0.5) * 0.6, note: o.note, size: o.size ?? this.size, shot: this.shot.id, id: this.id });
      return this;
    }
    /** exit at `at` ('cut' | 'pop' | 'fade' | 'slide' | 'shrink'); inside a cut bar -> clamped to the next kept bar */
    out(kind, at, o = {}) {
      const t = Tc(at); const fn = OUT[kind]; const opt = Object.assign({ id: this.id }, o);
      const dur = o.dur ?? OUT_DUR[kind] ?? 0.3; this.t1 = t + dur;
      if (kind !== 'cut') this.track(tt => { const u = tt - t + HALF(); return u < 0 ? null : fn(u, opt); });
      if (o.log || o.sfx) DM.ev(t, 'out', o.label || this.label || this.id, { sfx: o.sfx || 'none', gain: o.gain, shot: this.shot.id });
      return this;
    }
    /** visible window without entrance/exit animation */
    show(from, to) { if (from !== undefined) { const t = T(from); if (t === null) { this.t0 = Infinity; this.never = true; } else this.t0 = t; } if (to !== undefined) this.t1 = Tc(to); return this; }
    /** relative move between t0 and t1: {x, y, r, s (multiplier), o} reached at t1 and held */
    move(t0, t1, to, ease = E.ioC) {
      const a = Tc(t0), b = Tc(t1);
      this.track(tt => { const k = ease(clamp((tt - a) / Math.max(1e-6, b - a))); return { x: (to.x || 0) * k, y: (to.y || 0) * k, r: (to.r || 0) * k, s: to.s ? lerp(1, to.s, k) : 1, o: to.o != null ? lerp(1, to.o, k) : 1 }; });
      return this;
    }
    /** keyframed offsets [[at, {x,y,r,s,o}], ...] (absolute offsets from the rest pose; s/o are multipliers) */
    keys(keys) { this.track(tt => { const v = DM.kf(keys, tt); return { x: v.x || 0, y: v.y || 0, r: v.r || 0, s: v.s ?? 1, o: v.o ?? 1 }; }); return this; }
    /** scale bump on each time in `times` (beat pulse / bounce) */
    pulse(times, amp = 0.06, decay = 0.12) {
      const ts = times.map(T).filter(x => x !== null).sort((a, b) => a - b);
      this.track(tt => { let last = -1e9; for (const x of ts) if (x <= tt + HALF()) last = x; const u = tt - last; return u > 1 ? null : { s: 1 + amp * Math.exp(-u / decay) }; });
      return this;
    }
    wiggle(t0, t1, deg = 3, hz = 4) { const a = Tc(t0), b = Tc(t1); this.track(tt => (tt < a || tt > b) ? null : { r: deg * Math.sin((tt - a) * hz * 2 * Math.PI) * Math.min(1, (b - tt) / 0.2) }); return this; }
    /** hop on every beat (or `period` seconds) between t0 and t1 */
    bob(t0, t1, px = 8, period = DM.beatS()) { const a = Tc(t0), b = Tc(t1); this.track(tt => (tt < a || tt > b) ? null : { y: -px * Math.abs(Math.sin((tt - a) / period * Math.PI)) }); return this; }
    float(px = 4, deg = 0.6, period = 2.4) { const ph = DM.rand(this.id, 'fl') * 6.28; this.track(tt => ({ y: px * Math.sin(tt / period * 6.283 + ph), r: deg * Math.sin(tt / period * 6.283 * 0.7 + ph) })); return this; }
    /** slow continuous drift (PUSH for single objects): scale 1 -> s and offset over [t0,t1] */
    drift(t0, t1, to = { s: 1.04 }) { return this.move(t0, t1, to, E.ioSine); }
    measure() {
      if (this.el.offsetWidth !== undefined) { this.w = this.el.offsetWidth; this.h = this.el.offsetHeight; }
      else { const w = +this.el.getAttribute('width'), hh = +this.el.getAttribute('height'); if (w && hh) { this.w = w; this.h = hh; } else { const r = this.el.getBoundingClientRect(); this.w = r.width; this.h = r.height; } }
    }
    afterLayout() {}
    visibleAt(t) { const u0 = t - this.t0 + HALF(), u1 = t - this.t1 + HALF(); return u0 >= 0 && u1 < 0; }
    update(t) {
      if (!this.visibleAt(t)) { if (!this._hidden) { this.el.style.visibility = 'hidden'; this._hidden = true; } this._vis = false; return false; }
      // visible = INHERIT (not 'visible'): a child must stay hidden while its parent node is hidden, whatever was rendered before
      if (this._hidden || this._hidden === undefined) { this.el.style.visibility = ''; this._hidden = false; }
      let x = this.x, y = this.y, r = this.r, sc = this.sc, sx = 1, sy = 1, op = this.op;
      for (const fn of this.tracks) { const p = fn(t); if (!p) continue; if (p.x) x += p.x; if (p.y) y += p.y; if (p.r) r += p.r; if (p.s != null) sc *= p.s; if (p.sx != null) sx *= p.sx; if (p.sy != null) sy *= p.sy; if (p.o != null) op *= p.o; }
      if (this.boil) { const k = DM.boilStep(t); x += this.boil.px * DM.sr(this.id, k, 'x'); y += this.boil.px * DM.sr(this.id, k, 'y'); r += this.boil.deg * DM.sr(this.id, k, 'r'); }
      const tx = x - this.ax * this.w, ty = y - this.ay * this.h;
      this.el.style.transformOrigin = this.origin ? `${this.origin[0]}px ${this.origin[1]}px` : `${this.ax * 100}% ${this.ay * 100}%`;
      this.el.style.transform = `translate(${tx.toFixed(2)}px,${ty.toFixed(2)}px) rotate(${r.toFixed(3)}deg) scale(${(sc * sx).toFixed(4)},${(sc * sy).toFixed(4)})`;
      this.el.style.opacity = clamp(op).toFixed(3);
      this._vis = op > 0.001 && sc > 0.001;
      this.inner && this.inner(t);
      return true;
    }
  }
  DM.Node = Node;
  /** a plain node around any element (escape hatch for custom HTML/SVG) */
  DM.node = (shot, el, o) => new Node(shot, el, o);
  /** an empty group: children get {parent: group} and move with it */
  DM.group = (shot, o = {}) => { const el = h('div', 'grp'); el.style.width = (o.w || 0) + 'px'; el.style.height = (o.hgt || 0) + 'px'; return new Node(shot, el, Object.assign({ ax: 0, ay: 0, boil: false }, o)); };

  // ======================================================================================= Shot (a composition on its own paper)
  class Shot {
    /** o: {paper: 'dots'|'plain'|false, bg, cam: keyframes [[at,{x,y,s,r}]], drift: {s, x, y}, focus: [x,y] (camera origin),
     *      blur: keyframes [[at, px]] (horizontal motion blur), z, enter: {kind:'slap'|'slide'|'none', dur, dx, dy}, log:false} */
    constructor(id, t0, t1, o = {}) {
      this.id = id; this.t0 = Tc(t0); this.t1 = Tc(t1); this.nodes = []; this.o = o;
      if (shots.some(x => x.id === id)) DM.warn('duplicate shot id ' + id);
      this.camKeys = o.cam || null;
      this.el = h('div', 'shot'); this.el.dataset.shot = id; this.el.style.zIndex = o.z ?? 10;
      if (o.paper !== false) { this.paper = h('div', 'dm-paper' + (o.paper === 'plain' ? ' plain' : '')); if (o.bg) this.paper.style.backgroundColor = DM.COLORS && DM.COLORS[o.bg] || o.bg; this.grain = h('div', 'dm-grain'); this.paper.appendChild(this.grain); }
      this.world = h('div', 'world'); if (this.paper) this.world.appendChild(this.paper);
      this.el.appendChild(this.world); document.getElementById('stage').appendChild(this.el);
      this.shakes = []; this.pulses = []; this.punches = []; this.drift = o.drift === undefined ? { s: 1.04 } : o.drift; shots.push(this);
      if (o.blur) {
        let defs = document.getElementById('dm-defs'); if (!defs) { defs = s('svg', { id: 'dm-defs', width: 0, height: 0 }); defs.style.position = 'absolute'; document.body.appendChild(defs); }
        const fid = 'dmblur-' + id.replace(/[^a-z0-9]/gi, '') + NID++; const f = s('filter', { id: fid, x: '-10%', y: '-10%', width: '120%', height: '120%' });
        this.blurNode = s('feGaussianBlur', { stdDeviation: '0 0' }); f.appendChild(this.blurNode); defs.appendChild(f); this.blurId = fid;
      }
      if (o.log !== false && this.t1 > this.t0) DM.ev(this.t0, 'cut', id, { sfx: o.sfx ?? 'none', shot: id });
      if (o.enter && o.enter.kind && o.enter.kind !== 'none') DM.ev(this.t0, 'enter-' + o.enter.kind, id, { sfx: o.enter.sfx, shot: id });
    }
    cam(keys) { this.camKeys = keys; return this; }
    /** frame shake (STORYBOARD: SLAM of XL/XXL shakes 4 px for 3 frames) */
    shake(at, amp = 7, frames = 5) { const t = T(at); if (t !== null) this.shakes.push({ t, amp, frames }); return this; }
    /** camera bump on beats (kick pulse) */
    pulse(times, amp = 0.012, decay = 0.09) { for (const at of times) { const t = T(at); if (t !== null) this.pulses.push({ t, amp, decay }); } return this; }
    /** PUNCH: zoom onto world point (x,y) by `s` in `inF` frames (ease-out) on the beat, hold (keeps drifting), pull back in `outF` frames
     *  at `until` (or never).  o: {x, y, s, center: 0..1 how far the point travels toward the frame centre, inF, outF, until, sfx} */
    punch(at, o = {}) {
      const t = T(at); if (t === null) return this;
      const p = { t, x: o.x ?? cfg.W / 2, y: o.y ?? cfg.H / 2, s: o.s ?? 1.3, c: o.center ?? 0.5, inD: (o.inF ?? 4) / 60, outD: (o.outF ?? 6) / 60, until: o.until !== undefined ? Tc(o.until) : null, ease: o.ease || E.outC };
      this.punches.push(p);
      if (o.log !== false) DM.ev(t, 'punch', o.label || `punch ${this.id}`, { sfx: o.sfx, gain: o.gain, shot: this.id });
      return this;
    }
    active(t) { return t - this.t0 + HALF() >= 0 && t - this.t1 + HALF() < 0; }
    camAt(t) {
      const c = this.camKeys ? DM.kf(this.camKeys, t) : {}; let cx = c.x || 0, cy = c.y || 0, cs = c.s ?? 1, cr = c.r || 0;
      for (const sh of this.shakes) { const f = (t - sh.t) * 60; if (f >= 0 && f < sh.frames) { const a = sh.amp * (1 - f / sh.frames); cx += a * DM.sr(this.id, 'shx', Math.floor(f)); cy += a * DM.sr(this.id, 'shy', Math.floor(f)); cr += a * 0.04 * DM.sr(this.id, 'shr', Math.floor(f)); } }
      let pulse = 1; for (const p of this.pulses) { const u = t - p.t + HALF(); if (u >= 0 && u < 0.6) pulse += p.amp * Math.exp(-u / p.decay); }
      cs *= pulse;
      if (this.drift && this.t1 > this.t0) { const u = E.ioSine(clamp((t - this.t0) / Math.max(0.01, this.t1 - this.t0))); cs *= lerp(1, this.drift.s ?? 1.04, u); cx += (this.drift.x || 0) * u; cy += (this.drift.y || 0) * u; cr += (this.drift.r || 0) * u; }
      const W = cfg.W, H = cfg.H, ox = this.o.focus ? this.o.focus[0] : W / 2, oy = this.o.focus ? this.o.focus[1] : H / 2;
      for (const p of this.punches) {        // compose: scale about the punch point, travel toward the centre
        const u = t - p.t + HALF(); if (u < 0) continue;
        let e = p.ease(clamp(u / p.inD)); if (p.until !== null) { const v = t - p.until + HALF(); if (v >= 0) e *= 1 - E.ioQ(clamp(v / p.outD)); }
        if (e <= 0) continue;
        const se = 1 + (p.s - 1) * e, shx = (W / 2 - p.x) * p.c * e, shy = (H / 2 - p.y) * p.c * e;
        const vx = (1 - se) * (p.x - ox) + shx, vy = (1 - se) * (p.y - oy) + shy;
        const rr = cr * Math.PI / 180; cx += cs * (vx * Math.cos(rr) - vy * Math.sin(rr)); cy += cs * (vx * Math.sin(rr) + vy * Math.cos(rr)); cs *= se;
      }
      return { cx, cy, cs, cr, ox, oy };
    }
    update(t) {
      const on = this.active(t);
      if (on !== this._on) { this.el.style.display = on ? 'block' : 'none'; this._on = on; }
      if (!on) return;
      const { cx, cy, cs, cr, ox, oy } = this.camAt(t);
      this.world.style.transform = `translate(${(ox + cx).toFixed(2)}px,${(oy + cy).toFixed(2)}px) rotate(${cr.toFixed(3)}deg) scale(${cs.toFixed(4)}) translate(${-ox}px,${-oy}px)`;
      if (this.grain) { const k = DM.boilStep(t); this.grain.style.backgroundPosition = `${Math.floor(DM.rand(this.id, 'gx', k) * 512)}px ${Math.floor(DM.rand(this.id, 'gy', k) * 512)}px`; }
      if (this.blurNode) { const b = DM.kf(this.o.blur, t); if (b > 0.3) { this.blurNode.setAttribute('stdDeviation', `${b.toFixed(1)} 0`); this.el.style.filter = `url(#${this.blurId})`; } else this.el.style.filter = 'none'; }
      const en = this.o.enter;
      if (en && en.kind && en.kind !== 'none') {           // whole-shot entrances (transitions X: slap-on / slide-on)
        const u = t - this.t0 + HALF(), d = en.dur ?? 0.16, k = clamp(u / d);
        if (en.kind === 'slap') { const sc = lerp(en.big ?? 1.12, 1, E.outBack(k, 1.3)), rot = lerp(en.spin ?? 2.5, 0, E.outC(k));
          this.el.style.transform = k < 1 ? `rotate(${rot.toFixed(3)}deg) scale(${sc.toFixed(4)})` : 'none'; this.el.classList.toggle('sheet', k < 1); }
        else if (en.kind === 'slide') { const dx = (en.dx ?? cfg.W) * (1 - (en.ease || E.outC)(k)), dy = (en.dy ?? 0) * (1 - (en.ease || E.outC)(k));
          this.el.style.transform = k < 1 ? `translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px)` : 'none'; this.el.classList.toggle('sheet', k < 1); }
      }
      for (const n of this.nodes) n.update(t);
    }
    /** world -> screen coordinates at time t (for tools / annotations that must line up on screen) */
    toScreen(t, x, y) { const { cx, cy, cs, cr, ox, oy } = this.camAt(t); const rr = cr * Math.PI / 180, dx = (x - ox) * cs, dy = (y - oy) * cs; return [ox + cx + dx * Math.cos(rr) - dy * Math.sin(rr), oy + cy + dx * Math.sin(rr) + dy * Math.cos(rr)]; }
  }
  DM.Shot = Shot;
  DM.shot = (id, t0, t1, o) => new Shot(id, t0, t1, o);

  // ======================================================================================= layout / render / info
  const pending = DM._pending = [];
  DM.wait = p => { pending.push(p); };
  const afterLayoutHooks = [];
  DM.onLayout = fn => afterLayoutHooks.push(fn);
  const textNodes = DM.textNodes = [];       // nodes carrying on-screen text (for QC: reading time, safe area, glyphs)
  DM.registerText = (node, info) => { node.textInfo = info; node.el.dataset.dmtext = info.role || 'text'; textNodes.push(node); };
  DM.layout = async () => {
    for (const sh of shots) sh.el.style.display = 'block';
    const text = [...new Set(document.getElementById('stage').textContent + 'MUSIC SPACE 0123456789:')].join('');
    const fams = ['Doodle Display', 'DM Display Raw', 'Doodle Marker', 'DM Marker Raw', 'Doodle Hand', 'DM Hand Raw', 'Doodle Note', 'DM Note Raw', 'DM Logo Raw', 'DM Digits Raw', 'Doodle Digits'];
    await Promise.all(fams.map(f => document.fonts.load(`64px "${f}"`, text).catch(() => {})));
    await document.fonts.ready;
    await Promise.all([...document.images].filter(i => i.getAttribute('src')).map(i => i.decode().catch(e => DM.warn('image failed: ' + i.src))));
    for (const hook of DM._preLayout || []) await hook();
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    for (const sh of shots) for (const n of sh.nodes) { n.el.style.transform = 'none'; n.measure(); }
    for (const sh of shots) for (const n of sh.nodes) n.afterLayout();
    for (const fn of afterLayoutHooks) await fn();
    for (const sh of shots) { sh.el.style.display = 'none'; sh._on = false; }
    DM.events.sort((a, b) => a.t - b.t);
    DM._laidOut = true;
  };
  DM.render = async f => {
    const t = f / cfg.fps; pending.length = 0; DM._lastT = t;
    for (const sh of shots) sh.update(t);
    for (const fn of DM._perFrame || []) fn(t);
    if (pending.length) await Promise.all(pending.splice(0));
    return t;
  };
  /** every text node with its declared on-screen window (tools/qc.py also measures the real one, see DM.geom) */
  DM.texts = () => textNodes.filter(n => !n.never).map(n => {
    const sh = n.shot; let t0 = Math.max(n.typeT ?? n.t0, sh.t0), t1 = Math.min(n.t1, sh.t1);
    for (let p = n.parent; p; p = p.parent) { t0 = Math.max(t0, p.t0); t1 = Math.min(t1, p.t1); }
    return Object.assign({ id: n.id, shot: sh.id, t0: +t0.toFixed(4), t1: +t1.toFixed(4) }, n.textInfo);
  }).filter(x => x.t1 > x.t0);
  /** what is on screen now (call after DM.render(f)): visible text boxes in screen px with effective opacity */
  DM.geom = () => {
    const out = [];
    for (const n of textNodes) {
      if (!n._vis || !n.shot._on) continue;
      let op = 1, el = n.el, hidden = false;
      while (el && el.id !== 'stage') { const st = el.style; if (st.opacity !== '') op *= parseFloat(st.opacity); if (st.visibility === 'hidden' || st.display === 'none') { hidden = true; break; } el = el.parentElement; }
      if (hidden || op < 0.05) continue;
      const box = (n.textEl || n.el).getBoundingClientRect();
      out.push({ id: n.id, text: n.textInfo.text, kind: n.textInfo.kind, role: n.textInfo.role, inFootage: !!n.textInfo.inFootage, op: +op.toFixed(3),
        box: [Math.round(box.left), Math.round(box.top), Math.round(box.right), Math.round(box.bottom)] });
    }
    return { covered: DM.coveredAt ? DM.coveredAt(DM._lastT) : false, texts: out };
  };
  DM.info = () => ({
    fps: cfg.fps, W: cfg.W, H: cfg.H, map: MAP ? { id: MAP.id, label: MAP.label, end_s: MAP.end_s, grid_end_s: MAP.grid_end_s, bpm: MAP.bpm, beat_s: MAP.beat_s, bar_s: MAP.bar_s } : null,
    duration: MAP ? MAP.end_s : 0, frames: MAP ? Math.round(MAP.end_s * cfg.fps) : 0,
    shots: shots.map(sh => ({ id: sh.id, t0: +sh.t0.toFixed(4), t1: +sh.t1.toFixed(4), z: +(sh.o.z ?? 10) })),
    events: DM.events, texts: DM.texts(), marks: DM.marks, warnings: DM.warnings,
    assets: DM.assetInfo || {}, clips: DM.clipInfo || {}, script: [...DM.used.script].sort(), scenes: DM.scenes || [],
  });
})();
