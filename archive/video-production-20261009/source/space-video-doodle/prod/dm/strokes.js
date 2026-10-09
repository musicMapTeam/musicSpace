/* doodle-motion · strokes.js — marker strokes drawn on with stroke-dashoffset (re-drawn = "boiled" at 12 fps), annotation helpers
 * and the transitions.
 *
 *   DM.stroke(shot, {gen: r => pathD, color, width, at, dur, erase, edur, dash:[on,off], label, sfx})   any marker path
 *   DM.circle(shot, {x, y, rx, ry, at, color})                 open hand-drawn loop that overshoots its start (marker circle)
 *   DM.underline(shot, {x0, x1, y, at, wavy, color})           marker underline (straight or wavy)
 *   DM.arrow(shot, {from:[x,y], to:[x,y], bend, at, color})    hand-drawn arrow with a head
 *   DM.bracket(shot, {x0, x1, y, h, at, color})                square bracket (the 「不到 1 分钟」 bracket)
 *   DM.highlight(shot, {x, y, w, hgt, at, color})              highlighter swipe over any rectangle (UI in footage, a time ...)
 *   DM.check(shot, {x, y, size, at, color})                    check mark drawn on
 *   DM.scribble(shot, {x, y, w, hgt, at})                      pencil scribble fill (cross-out / shading)
 * Coordinates are in the parent's space: world px of the shot, or source px of a device screen with {on: phone} (see devices.js).
 * Transitions (each lives on its own top shot, above everything):
 *   DM.wipe(id, coverAt, revealAt, {colors})    X1 scribble wipe: fat zigzag covers in 4 frames (start on the "and" of 4), holds,
 *                                               erases off from the downbeat in 6 frames
 *   DM.markerWipe(id, coverAt, revealAt, {color, dir})   horizontal marker bands paint the frame, then lift off
 *   shot option {enter: {kind: 'slap'|'slide'}}  slap-on / slide-on of the next composition (core.js)
 *   shot.punch(at, {x, y, s})                    punch-in zoom on the beat (core.js)
 */
(function () {
  'use strict';
  const DM = window.DM, { h, s, E, clamp, lerp } = DM;
  const T = DM._T, Tc = DM._Tc;
  const HALF = () => 0.5 / DM.cfg.fps;
  const col = c => DM.COLORS[c] || c;
  let MASKID = 0;

  // ---------------------------------------------------------------- path generators (r = seeded random)
  const P = DM.paths = {
    /** open hand-drawn loop around an ellipse, overshooting its start */
    loop(cx, cy, rx, ry, r, o = {}) {
      const turns = o.turns ?? 1.12, n = 44, a0 = (o.a0 ?? -100) * Math.PI / 180, wob = o.wob ?? 0.045, tilt = (o.tilt ?? -4) * Math.PI / 180;
      const ph = r() * 6.28, ph2 = r() * 6.28; let d = '';
      for (let i = 0; i <= n; i++) {
        const k = i / n, a = a0 + k * turns * 2 * Math.PI; const grow = 1 + (k - 0.5) * (o.spiral ?? 0.08);
        const rr = 1 + wob * Math.sin(a * 2 + ph) + wob * 0.6 * Math.sin(a * 3 + ph2) + (r() - 0.5) * 0.012;
        const x = Math.cos(a) * rx * rr * grow, y = Math.sin(a) * ry * rr * grow;
        const xt = x * Math.cos(tilt) - y * Math.sin(tilt), yt = x * Math.sin(tilt) + y * Math.cos(tilt);
        d += (i ? ' L' : 'M') + (cx + xt).toFixed(1) + ',' + (cy + yt).toFixed(1);
      }
      return d;
    },
    /** wobbly polyline through points */
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
    /** wavy line from x0 to x1 at y */
    wave(x0, x1, y, r, o = {}) { const n = Math.max(4, Math.round((x1 - x0) / (o.wl ?? 90))); const pts = []; for (let i = 0; i <= n * 2; i++) pts.push([lerp(x0, x1, i / (n * 2)), y + (i % 2 ? -1 : 1) * (o.amp ?? 9) * (i === 0 || i === n * 2 ? 0.4 : 1)]); return P.curve(pts, r, { jit: o.jit ?? 3 }); },
    /** zigzag scribble covering a box (wipes / pencil shading) */
    zigzag(x0, y0, x1, y1, n, r, o = {}) { const pts = []; for (let i = 0; i <= n; i++) { const k = i / n; const x = lerp(x0, x1, k) + (r() - .5) * (o.jx ?? 40); pts.push([x + (i % 2 ? o.lean ?? 140 : -(o.lean ?? 140)) * 0.5, i % 2 ? y1 + (r() - .5) * 30 : y0 + (r() - .5) * 30]); } return P.curve(pts, r, { jit: 8 }); },
    /** wobbly rounded rectangle */
    rrect(x, y, w, hh, rad, r, o = {}) {
      const j = o.jit ?? 1.6; const J = () => (r() - .5) * j; const k = 0.55; const rx = rad, ry = rad;
      return `M${x + rx + J()},${y + J()} L${x + w - rx + J()},${y + J()} C${x + w - rx + rx * k},${y} ${x + w},${y + ry - ry * k} ${x + w + J()},${y + ry + J()} L${x + w + J()},${y + hh - ry + J()} C${x + w},${y + hh - ry + ry * k} ${x + w - rx + rx * k},${y + hh} ${x + w - rx + J()},${y + hh + J()} L${x + rx + J()},${y + hh + J()} C${x + rx - rx * k},${y + hh} ${x},${y + hh - ry + ry * k} ${x + J()},${y + hh - ry + J()} L${x + J()},${y + ry + J()} C${x},${y + ry - ry * k} ${x + rx - rx * k},${y} ${x + rx + J()},${y + J()} Z`;
    },
    /** arrow from a to b, bent by `bend` (fraction of the length, sign = side), head of size hs */
    arrow(a, b, r, o = {}) {
      const bend = o.bend ?? 0.2, hs = o.head ?? 30; const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
      const c = [mx - dy / L * L * bend, my + dx / L * L * bend];
      const body = P.curve([a, [lerp(a[0], c[0], 0.6), lerp(a[1], c[1], 0.6)], c, [lerp(c[0], b[0], 0.55), lerp(c[1], b[1], 0.55)], b], r, { jit: o.jit ?? 3 });
      const ang = Math.atan2(b[1] - lerp(c[1], b[1], 0.55), b[0] - lerp(c[0], b[0], 0.55)), sp = 0.5;
      const h1 = [b[0] - hs * Math.cos(ang - sp), b[1] - hs * Math.sin(ang - sp)], h2 = [b[0] - hs * Math.cos(ang + sp), b[1] - hs * Math.sin(ang + sp)];
      return body + ' ' + P.line([h1, b, h2], r, { jit: 2 });
    },
    /** horizontal marker bands covering the frame (marker wipe) */
    bands(W, H, n, r, o = {}) { let d = ''; const bh = H / n; for (let i = 0; i < n; i++) { const y = bh * (i + 0.5) + (r() - .5) * 20; const dir = (o.alt && i % 2) ? -1 : 1; const xa = dir > 0 ? -200 : W + 200, xb = dir > 0 ? W + 200 : -200; d += ' ' + P.line([[xa, y], [lerp(xa, xb, 0.33), y + (r() - .5) * 26], [lerp(xa, xb, 0.66), y + (r() - .5) * 26], [xb, y]], r, { jit: 8 }); } return d.trim(); },
  };

  // ---------------------------------------------------------------- Stroke
  class Stroke extends DM.Node {
    /** o.gen(r) -> path d (re-generated per boil step), o.color, o.width, o.at (draw start), o.dur (default 1 beat), o.erase, o.edur,
     *  o.dash [on, off] (dashes revealed through a mask), o.opacity, o.ease, o.sfx (default: marker squeak), o.space: 'world'|'screen' */
    constructor(shot, o) {
      const W = o.vw || DM.cfg.W, H = o.vh || DM.cfg.H;
      const svg = s('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, class: 'ov' });
      const p = s('path', { class: 'mk', stroke: col(o.color || 'pink'), 'stroke-width': o.width || 9, opacity: o.opacity ?? 1 });
      if (o.linecap) p.style.strokeLinecap = o.linecap;
      let mp = null;
      if (o.dash) {
        const mid = 'dmmask' + (++MASKID); const mask = s('mask', { id: mid, maskUnits: 'userSpaceOnUse', x: -4000, y: -4000, width: 12000, height: 10000 });
        mp = s('path', { fill: 'none', stroke: '#fff', 'stroke-width': (o.width || 9) * 2.5, 'stroke-linecap': 'round' }); mask.appendChild(mp); svg.appendChild(mask);
        p.setAttribute('stroke-dasharray', o.dash.join(' ')); p.setAttribute('mask', `url(#${mid})`);
      }
      svg.appendChild(p);
      super(shot, svg, Object.assign({ boil: false, ax: 0, ay: 0, layer: 16 }, o, { at: undefined }));
      this.p = p; this.mp = mp;
      const at = o.at !== undefined ? o.at : o.t;
      this.drawT = at !== undefined ? T(at) : null; this.dur = o.dur ?? DM.beatS(); this.eraseT = o.erase !== undefined ? Tc(o.erase) : null; this.edur = o.edur ?? 0.12;
      if (at !== undefined && this.drawT === null) { this.t0 = Infinity; this.never = true; }
      else this.t0 = this.drawT ?? -1e9;
      if (this.eraseT !== null) this.t1 = this.eraseT + this.edur + 0.02;
      if (o.until !== undefined) this.t1 = Tc(o.until);
      this.gen = o.gen; this.ease = o.ease || E.ioQ; this.label = o.label || 'stroke'; this.widthFn = o.widthFn || null; this.baseW = o.width || 9;
      if (this.drawT !== null && o.log !== false) DM.ev(this.drawT, o.kind || 'draw', this.label, { sfx: o.sfx, gain: o.gain, shot: shot.id, id: this.id, dur: this.dur });
      this._step = null;
    }
    inner(t) {
      const step = DM.boilStep(t);
      if (step !== this._step) { this._step = step; const d = this.gen(DM.rng(DM.hash(this.id, this.o.still ? 0 : step))); this.p.setAttribute('d', d); if (this.mp) this.mp.setAttribute('d', d); this.len = this.p.getTotalLength(); }
      if (this.widthFn) { const w = this.baseW * this.widthFn(t); this.p.setAttribute('stroke-width', w.toFixed(2)); if (this.mp) this.mp.setAttribute('stroke-width', (w * 2.5).toFixed(2)); }
      const L = this.len; let a = 0, b = 1;
      if (this.drawT !== null) b = this.ease(clamp((t - this.drawT + HALF()) / this.dur));
      if (this.eraseT !== null) a = E.inQ(clamp((t - this.eraseT + HALF()) / this.edur));
      const da = `0 ${(a * L).toFixed(1)} ${(Math.max(0, b - a) * L).toFixed(1)} ${L + 10}`;
      if (this.mp) this.mp.setAttribute('stroke-dasharray', da); else this.p.setAttribute('stroke-dasharray', da);
    }
  }
  DM.Stroke = Stroke;
  DM.stroke = (shot, o) => new Stroke(shot, o);

  // ---------------------------------------------------------------- annotation helpers (all return a Stroke)
  const v = q => (typeof q === 'function' ? q() : q);   // coordinates may be functions (evaluated at draw time, after layout)
  const wrap = (shot, o, gen, label) => {
    if (o.on) return o.on.annotate(Object.assign({ label }, o, { gen }));       // on a device screen (source px)
    return new Stroke(shot, Object.assign({ label }, o, { gen }));
  };
  DM.circle = (shot, o) => wrap(shot, Object.assign({ color: 'pink', width: 9 }, o), r => P.loop(v(o.x), v(o.y), v(o.rx) ?? 120, v(o.ry) ?? (v(o.rx) ?? 120) * 0.6, r, o), o.label || 'circle');
  DM.underline = (shot, o) => wrap(shot, Object.assign({ color: 'pink', width: 10 }, o), r => { const x0 = v(o.x0), x1 = v(o.x1), y = v(o.y); return o.wavy ? P.wave(x0, x1, y, r, o) : P.curve([[x0, y], [lerp(x0, x1, 0.5), y + (o.sag ?? 4)], [x1, y - 2]], r, { jit: 4 }); }, o.label || 'underline');
  DM.arrow = (shot, o) => wrap(shot, Object.assign({ color: 'pink', width: 8 }, o), r => P.arrow(v(o.from), v(o.to), r, o), o.label || 'arrow');
  DM.bracket = (shot, o) => wrap(shot, Object.assign({ color: 'ink', width: 7 }, o), r => { const x0 = v(o.x0), x1 = v(o.x1), y = v(o.y); return P.line([[x0, y + (o.h ?? 30)], [x0, y], [x1, y], [x1, y + (o.h ?? 30)]], r, { jit: 3 }); }, o.label || 'bracket');
  DM.check = (shot, o) => { const z = o.size ?? 80; return wrap(shot, Object.assign({ color: 'mint', width: 11, dur: DM.beatS() * 0.5 }, o), r => { const x = v(o.x), y = v(o.y); return P.curve([[x - z * 0.42, y + z * 0.02], [x - z * 0.15, y + z * 0.3], [x + z * 0.45, y - z * 0.45]], r, { jit: 3 }); }, o.label || 'check'); };
  DM.scribble = (shot, o) => wrap(shot, Object.assign({ color: 'ink', width: 6, sfx: 'scribble' }, o), r => P.zigzag(v(o.x), v(o.y), v(o.x) + o.w, v(o.y) + o.hgt, o.n ?? 10, r, { lean: o.lean ?? 30, jx: 6 }), o.label || 'scribble');
  DM.dashed = (shot, o) => wrap(shot, Object.assign({ color: 'ink', width: 7, dash: [22, 18], sfx: 'pencil' }, o), r => P.curve(v(o.pts), r, { jit: 3 }), o.label || 'dashed line');
  /** highlighter swipe over a rectangle (left -> right over one beat; ragged edges; multiply so text stays readable) */
  DM.highlight = (shot, o) => {
    const x = o.x, y = o.y, w = o.w, hh = o.hgt;
    const opts = Object.assign({ color: o.color || 'yellow', width: hh, kind: 'swipe', label: o.label || 'highlight', opacity: o.opacity ?? 0.55 }, o);
    // a highlighter is a fat round-capped stroke along the band's centre line, drawn left -> right
    const genLine = r => P.line([[x, y + hh / 2 + (r() - .5) * 3], [x + w * 0.5, y + hh / 2 + (r() - .5) * 4], [x + w, y + hh / 2 + (r() - .5) * 3]], r, { jit: 2 });
    const st = wrap(shot, Object.assign(opts, { linecap: 'butt' }), genLine, opts.label);
    // the blend goes on the stroke's own <svg>: it carries a transform (a stacking context of its own), so a blend set on the path
    // inside it only mixed with the svg's transparent backdrop and the band painted over the words it marks (fixed in v2)
    st.el.style.mixBlendMode = 'multiply';
    return st;
  };

  // ---------------------------------------------------------------- transitions
  const covers = [];      // [{t0, t1}] full-frame cover windows (QC: text is not readable while covered)
  DM.coveredAt = t => covers.some(c => t >= c.t0 && t < c.t1);
  /** X1 scribble wipe: covers from `coverAt` in ~4 frames, holds, wipes off from `revealAt` in ~6 frames.  o: {colors, width, n, sfx} */
  DM.wipe = (id, coverAt, revealAt, o = {}) => {
    const tc = T(coverAt), tr = Tc(revealAt); if (tc === null) return null;
    const sh = DM.shot(id, tc - 0.01, tr + (o.edur ?? 0.05) + 0.08, { paper: false, z: o.z ?? 90, log: false, drift: null });
    const cols = o.colors || ['pink', 'yellow'];
    cols.forEach((c, i) => new Stroke(sh, { id: id + 's' + i, color: c, width: o.width ?? 330, at: tc + i * 0.025, dur: o.dur ?? 0.075, erase: tr - 1.2 / DM.cfg.fps + i * 0.008, edur: o.edur ?? 0.05, ease: E.lin, log: false,
      gen: r => P.zigzag(-260 + i * 70, -160, DM.cfg.W + 260, DM.cfg.H + 160, o.n ?? 9, r, { lean: 240, jx: 30 }) }));
    covers.push({ t0: tc + (o.dur ?? 0.075) + 0.03 * cols.length, t1: tr });
    DM.ev(tc, 'wipe', id, { sfx: o.sfx, gain: o.gain, shot: id });
    return sh;
  };
  /** marker wipe: n horizontal marker bands paint across (dir 1 = left -> right) and lift off in the same direction */
  DM.markerWipe = (id, coverAt, revealAt, o = {}) => {
    const tc = T(coverAt), tr = Tc(revealAt); if (tc === null) return null;
    const sh = DM.shot(id, tc - 0.01, tr + (o.edur ?? 0.12) + 0.06, { paper: false, z: o.z ?? 90, log: false, drift: null });
    const n = o.n ?? 4; const W = DM.cfg.W, H = DM.cfg.H; const colsA = o.colors || [o.color || 'mint'];
    for (let i = 0; i < n; i++) {
      const y = H / n * (i + 0.5); const c = colsA[i % colsA.length];
      new Stroke(sh, { id: id + 'b' + i, color: c, width: H / n * 1.25, at: tc + i * (o.stagger ?? 0.02), dur: o.dur ?? 0.1, erase: tr + i * 0.015, edur: o.edur ?? 0.1, ease: E.outQ, log: false, linecap: 'round',
        gen: r => P.line([[-150, y + (r() - .5) * 10], [W * 0.5, y + (r() - .5) * 16], [W + 150, y + (r() - .5) * 10]], r, { jit: 4 }) });
    }
    covers.push({ t0: tc + (o.dur ?? 0.1) + n * (o.stagger ?? 0.02), t1: tr });
    DM.ev(tc, 'wipe', id, { sfx: o.sfx, gain: o.gain, shot: id });
    return sh;
  };
})();
