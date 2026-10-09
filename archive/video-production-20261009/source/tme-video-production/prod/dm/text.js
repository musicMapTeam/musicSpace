/* doodle-motion · text.js — layered lettering and every type recipe of SCRIPT.md §1 / STORYBOARD §1.3.
 *
 *   DM.say(shot, 'T024', {x: 120, y: 900})          a SCRIPT line by id: text, font, size, recipe, entrance and in/out bar:beat come
 *                                                   from script/out/timeline.json (override any of them in the options)
 *   DM.title(shot, {text: '只有【自己】那一面。', recipe: 'ink-pink', size: 'L', x, y, at: '11:3', fx: 'SLAM', until: '13:1'})
 *   DM.text(...)  plain line (Marker, no colour layer)       DM.note(...)  handwritten pink note (Note font, -4 deg)
 *   DM.stamp / DM.chip / DM.logo / DM.fine / DM.pillar / DM.linkPill
 *
 * Text syntax: key words in 【】, ⟦⟧ or [] (colour override: [word|mint]); line breaks with '\n' or ' / '.
 * Sizes: numbers (px at 1080p) or tiers XXL 240 · XL 180 · L 128 · M 84 · S 56 · XS 36.  Fonts: D display, M marker, H hand,
 * N note, L logo, G digits.  Key words are set larger (1.4x for 1-2 characters, 1.25x for 3, 1.2x for 4+) in a marker colour with
 * an ink outline.  Recipes:
 *   ink-pink | ink-mint | ink-yellow   ink text + hard offset shadow in that colour (the product's .ds-title); the colour layer
 *                                      prints 2 frames after the ink (layered lettering)
 *   ink                                plain ink (no colour layer)          key-pink|mint|yellow   ink line, coloured key words only
 *   st-pink | st-mint | st-yellow      sticker word: colour fill, ink outline, ink shadow (.ds-sticker)
 *   hl-mint | hl-yellow | hl-pink      ink on a highlighter band swiped left -> right over one beat (.ds-hl)
 *   ink-dashed                         key word inside a hand-drawn dashed box that draws on (the product's 「不确定」 chip)
 *   digits                             得意黑 + yellow highlighter band + pink offset (times, numbers)
 *   note-pink                          龙藏体 handwritten note, pink, tilted -4 deg
 *   fine                               悠哉 small print, ink-2
 *   stamp-pink|mint|yellow|ink, chip(-mint|-yellow|-pink|-hot|-ink), pillar-mint|pink|yellow, link-pill, logo
 * Entrances (fx): SLAM, POP, TYPE (characters on 16ths; 32nds over 10 units), STAMP, SWIPE (highlighter), SLAM+SWIPE, DRAW,
 * DROP, FADE, NONE.  Exit at `until`: pop-out in 4 frames (default) / 'cut' / 'fade' (o.outFx).
 */
(function () {
  'use strict';
  const DM = window.DM, { h, s, esc, E, clamp, lerp } = DM;
  const T = DM._T, Tc = DM._Tc;
  const HALF = () => 0.5 / DM.cfg.fps;
  const SIZES = DM.SIZES = { XXL: 240, XL: 180, L: 128, M: 84, S: 56, XS: 36 };
  const FONTS = DM.FONTS = { D: 'display', M: 'marker', H: 'hand', N: 'note', L: 'logo', G: 'digits' };
  const COLORS = DM.COLORS = { pink: 'var(--pink)', mint: 'var(--mint)', yellow: 'var(--yellow)', ink: 'var(--ink)', white: 'var(--card)', sky: '#74b9ff',
    'pink-soft': 'var(--pink-soft)', 'mint-soft': 'var(--mint-soft)', 'yellow-soft': 'var(--yellow-soft)', paper: 'var(--paper)', card: 'var(--card)', ink2: 'var(--ink2)' };
  const size = v => typeof v === 'string' ? (SIZES[v] || parseFloat(v)) : v;
  DM.size = size;

  // ---------------------------------------------------------------- parsing
  const KEYRE = /(?:【([^】]+)】|⟦([^⟧]+)⟧|\[([^\]|]+)(?:\|([a-z]+))?\])/g;
  /** 'abc【key】def[k2|mint]' -> runs [{t}, {t, key:'pink'}...] */
  const runs = (text, keyColor) => {
    const out = []; let last = 0, m; KEYRE.lastIndex = 0;
    while ((m = KEYRE.exec(text))) { if (m.index > last) out.push({ t: text.slice(last, m.index) }); out.push({ t: m[1] || m[2] || m[3], key: m[4] || keyColor }); last = m.index + m[0].length; }
    if (last < text.length) out.push({ t: text.slice(last) });
    return out;
  };
  DM.plain = text => String(text).replace(/ \/ /g, '\n').replace(KEYRE, (a, b, c, d) => b || c || d);
  /** reading units (SCRIPT.md): one per CJK character, one per Latin/number run; punctuation does not count */
  DM.units = text => { const t = DM.plain(text).replace(/[\s，。、！？…·：；,.!?「」『』（）()《》“”"'\-—~～↗⇄]/g, ' ');
    let n = 0; for (const tok of t.split(/\s+/)) { if (!tok) continue; const cjk = tok.match(/[㐀-鿿豈-﫿]/g) || []; n += cjk.length; const rest = tok.replace(/[㐀-鿿豈-﫿]/g, ' ').trim(); if (rest) n += rest.split(/\s+/).length; } return n; };
  const keyScale = t => { const n = [...t.replace(/[，。、！？…·：；,.!?\s]/g, '')].length; return n <= 2 ? 1.4 : n === 3 ? 1.25 : 1.2; };
  const PUN = /[，。、！？…·：；,.!?\s]/g;
  const runsHTML = (rs, split, o) => { const whole = rs.filter(r => r.t.replace(PUN, '')).length === 1 && rs.some(r => r.key); return rs.map(r => {
    const body = split ? [...r.t].map(c => c === '\n' ? '\n' : `<span class="ch">${esc(c)}</span>`).join('') : esc(r.t);
    if (!r.key) return body;
    const ks = o.ks ?? (whole ? 1 : keyScale(r.t));
    return `<span class="k ${r.key}" style="font-size:${ks}em">${body}</span>`;
  }).join(''); };

  // ---------------------------------------------------------------- recipes
  const RECIPES = {
    'ink-pink': { font: 'display', shadow: 'pink', key: 'pink' }, 'ink-mint': { font: 'display', shadow: 'mint', key: 'mint' }, 'ink-yellow': { font: 'display', shadow: 'yellow', key: 'pink' },
    'ink': { font: 'marker', shadow: null, key: 'pink' }, 'key-pink': { shadow: null, key: 'pink' }, 'key-mint': { shadow: null, key: 'mint' }, 'key-yellow': { shadow: null, key: 'yellow' },
    'st-pink': { font: 'display', shadow: null, sticker: 'pink', key: 'pink' }, 'st-mint': { font: 'display', shadow: null, sticker: 'mint', key: 'mint' }, 'st-yellow': { font: 'display', shadow: null, sticker: 'yellow', key: 'yellow' },
    'hl-mint': { font: 'display', shadow: 'pink', hl: 'mint', key: 'inkk' }, 'hl-yellow': { font: 'display', shadow: 'pink', hl: 'yellow', key: 'inkk' }, 'hl-pink': { font: 'display', shadow: null, hl: 'pink', key: 'inkk' },
    'ink-dashed': { font: 'display', shadow: 'pink', key: 'inkk', dashed: true },
    'digits': { font: 'digits', shadow: 'pink', hl: 'yellow', hlPart: 'key', key: 'inkk', so: 0.05 },
    'note-pink': { font: 'note', shadow: null, color: '--pink', r: -4, kind: 'note' },
    'fine': { font: 'hand', shadow: null, color: '--ink2', kind: 'fine' },
  };
  DM.RECIPES = RECIPES;

  // ---------------------------------------------------------------- Title (layered lettering)
  class Title extends DM.Node {
    constructor(shot, o) {
      const rc = Object.assign({}, RECIPES[o.recipe] || {}, o);
      const font = FONTS[rc.font] || rc.font || 'display';
      const px = size(rc.size ?? 128);
      const el = h('div', `ttl t-${font}`);
      el.style.fontSize = px + 'px';
      const color = rc.color; if (color) el.style.color = color.startsWith('--') ? `var(${color})` : (DM.COLORS[color] || color);
      if (rc.lh) el.style.lineHeight = rc.lh;
      if (rc.align) el.style.textAlign = rc.align;
      if (rc.ls != null) el.style.letterSpacing = rc.ls;
      const text = String(rc.text).replace(/ \/ /g, '\n');
      const rs = runs(text, rc.key || 'pink');
      const fx = String(rc.fx || '').toUpperCase();
      const split = fx.includes('TYPE') || !!rc.type;
      const shadow = rc.shadow === undefined ? null : rc.shadow;
      let html = '';
      if (rc.hl) html += `<div class="hlwrap"></div>`;
      if (shadow) html += `<div class="lay sh" style="--shc:var(--${shadow})">${runsHTML(rs, split, rc)}</div>`;
      html += `<div class="lay base fg${rc.sticker ? ' stk' : ''}">${runsHTML(rs, split, rc)}</div>`;
      if (rc.dashed) html += `<div class="dashwrap"></div>`;
      el.innerHTML = html;
      if (rc.sticker) { const fg = el.querySelector('.fg'); fg.style.color = `var(--${rc.sticker})`; fg.classList.add('stkw'); }
      super(shot, el, Object.assign({ ax: 0, ay: 0.5, r: rc.r ?? 0, layer: 20 }, rc, { at: undefined, fx: undefined }));
      this.rc = rc; this.size = px; this.font = font; this.shadowName = shadow; this.so = rc.so ?? 0.055;
      this.label = DM.plain(text).replace(/\n/g, ' ').slice(0, 16);
      this.sh = el.querySelector('.sh'); this.fg = el.querySelector('.fg'); this.hlw = el.querySelector('.hlwrap'); this.dw = el.querySelector('.dashwrap');
      this.textEl = this.fg;
      if (shadow) this.sh.style.transform = `translate(${this.so}em,${this.so}em)`;
      DM.registerText(this, { text: DM.plain(text), role: font, kind: rc.kind || 'title', size: px, recipe: rc.recipe || null, script: rc.script || null, inFootage: !!rc.inFootage });
      // entrance from fx / at
      if (rc.at !== undefined) this.enter(rc.at, fx || 'SLAM', rc);
      if (rc.until !== undefined) this.out(rc.outFx || 'pop', rc.until, { dur: rc.outDur });
    }
    /** run the entrance named by fx at `at` */
    enter(at, fx = 'SLAM', o = {}) {
      const t = T(at); if (t === null) { this.t0 = Infinity; this.never = true; return this; }
      const parts = String(fx).toUpperCase().split('+');
      const ev = { sfx: o.sfx, gain: o.gain, label: o.label, size: this.size };
      const beat = DM.beatS();
      for (const p of parts) {
        if (p === 'SLAM') this.in('slam', t, Object.assign({ big: o.big, dir: o.dir, shake: this.size >= 180 ? 4 : false }, ev));
        else if (p === 'POP') this.in('pop', t, ev);
        else if (p === 'STAMP') this.in('stamp', t, ev);
        else if (p === 'DROP') this.in('drop', t, ev);
        else if (p === 'FADE') this.in('fade', t, Object.assign({ dur: o.fadeDur ?? 0.2 }, ev));
        else if (p === 'NONE') this.show(t);
        else if (p === 'TYPE') {
          if (!parts.includes('SLAM') && !parts.includes('POP')) this.show(t);
          const n = DM.units(this.rc.text); const step = o.step ?? (n > 10 ? beat / 8 : beat / 4);
          this.typeT = t; this.typeStep = step; this.chars = [[...this.fg.querySelectorAll('.ch')], this.sh ? [...this.sh.querySelectorAll('.ch')] : []];
          DM.ev(t, 'type', this.label, { sfx: o.typeSfx ?? o.sfx, gain: o.gain, shot: this.shot.id, id: this.id, dur: step * this.chars[0].length, note: this.chars[0].length });
        }
        else if (p === 'SWIPE') { if (parts.length === 1) this.show(t); this.hlT = parts.includes('SLAM') ? t + 2 / 60 : t; }
        else if (p === 'DRAW') { if (parts.length === 1) this.in('fade', t, Object.assign({ dur: beat * 0.5 }, ev)); this.drawT = t; }
      }
      if (this.rc.hl && this.hlT === undefined) this.hlT = t + (parts.includes('SLAM') ? 2 / 60 : 0);
      // the swipe / dashed box start a few frames after a SLAM lands (layered lettering) but are logged on the beat they belong to
      if (this.rc.hl) { this.hlDur = o.hlDur ?? beat; DM.ev(t, 'swipe', this.label, { sfx: o.hlSfx, shot: this.shot.id, id: this.id, dur: this.hlDur }); }
      if (this.rc.dashed) { this.dashT = (this.drawT ?? t) + (parts.includes('SLAM') ? 4 / 60 : 0); this.dashDur = o.dashDur ?? beat; DM.ev(this.drawT ?? t, 'draw', 'dashed ' + this.label, { sfx: o.dashSfx, shot: this.shot.id, id: this.id, dur: this.dashDur }); }
      return this;
    }
    afterLayout() {
      const fr = this.fg.getBoundingClientRect();
      const er = this.el.getBoundingClientRect();      // layout runs with transforms cleared: cache key-word boxes for keyRect()
      this._keys = [...this.fg.querySelectorAll('.k')].map(k => { const kr = k.getBoundingClientRect(); return [kr.left - er.left, kr.top - er.top, kr.right - er.left, kr.bottom - er.top]; });
      this._fgBox = [fr.left - er.left, fr.top - er.top, fr.right - er.left, fr.bottom - er.top];
      if (this.rc.hl) {
        let x0 = 0, x1 = this.fg.offsetWidth, top = 0, hh = this.fg.offsetHeight;
        const part = this.rc.hlPart || 'all';
        const k = this.fg.querySelector('.k');
        if (part === 'key' && k) { const kr = k.getBoundingClientRect(); x0 = kr.left - fr.left; x1 = kr.right - fr.left; top = kr.top - fr.top; hh = kr.height; }
        else {   // up to the last non-punctuation character (CJK punctuation boxes are mostly empty)
          const PUNCT = /[，。！？、…：；」』,.!?\s]/; const wk = document.createTreeWalker(this.fg, NodeFilter.SHOW_TEXT); let ln = null, li = 0;
          while (wk.nextNode()) { const nd = wk.currentNode; for (let i = 0; i < nd.data.length; i++) if (!PUNCT.test(nd.data[i])) { ln = nd; li = i; } }
          if (ln) { const rg = document.createRange(); rg.setStart(this.fg, 0); rg.setEnd(ln, li + 1); const rr = rg.getBoundingClientRect(); x0 = rr.left - fr.left; x1 = rr.right - fr.left; }
        }
        const fs = this.size;
        const bandTop = top + hh * (this.rc.hlTop ?? 0.55), bandH = hh * (this.rc.hlH ?? 0.36), pad = fs * 0.12;
        const W = x1 - x0 + pad * 2;
        const svg = s('svg', { width: W + 40, height: bandH + 40, viewBox: `0 0 ${W + 40} ${bandH + 40}` });
        svg.style.cssText = `position:absolute;left:${x0 - pad - 20}px;top:${bandTop - 20}px;overflow:visible`;
        const p = s('path', { fill: `var(--${this.rc.hl})` }); svg.appendChild(p);
        this.hlw.appendChild(svg); this.hlPath = p; this.hlW = W; this.hlH = bandH;
      }
      if (this.rc.dashed) {
        const k = this.fg.querySelector('.k'); const kr = (k || this.fg).getBoundingClientRect();
        const pad = this.size * 0.14, x = kr.left - fr.left - pad, y = kr.top - fr.top - pad * 0.5, w = kr.width + 2 * pad, hh = kr.height + pad;
        const svg = s('svg', { width: w + 60, height: hh + 60, viewBox: `${x - 30} ${y - 30} ${w + 60} ${hh + 60}` });
        svg.style.cssText = `position:absolute;left:${x - 30}px;top:${y - 30}px;overflow:visible`;
        const mid = 'dmdash' + DM.nid(); const mask = s('mask', { id: mid, maskUnits: 'userSpaceOnUse', x: x - 60, y: y - 60, width: w + 120, height: hh + 120 });
        const mp = s('path', { fill: 'none', stroke: '#fff', 'stroke-width': 26, 'stroke-linecap': 'round' }); mask.appendChild(mp); svg.appendChild(mask);
        const p = s('path', { fill: 'none', stroke: 'var(--ink)', 'stroke-width': Math.max(4, this.size * 0.035), 'stroke-dasharray': `${this.size * 0.11} ${this.size * 0.08}`, 'stroke-linecap': 'round', mask: `url(#${mid})` });
        svg.appendChild(p); this.dw.appendChild(svg); this.dashP = p; this.dashM = mp; this.dashBox = [x, y, w, hh];
      }
    }
    inner(t) {
      if (this.sh && this.shadowName) {   // the colour layer prints ~2 frames after the ink lands
        const u = (t - this.t0 + HALF()) * 60; const k = this.rc.lateShadow === false ? 1 : E.outBack(clamp((u - 1.5) / 4), 2.4);
        this.sh.style.transform = `translate(${(this.so * k).toFixed(4)}em,${(this.so * k).toFixed(4)}em)`;
      }
      if (this.chars) {
        const [fg, sh] = this.chars;
        for (let i = 0; i < fg.length; i++) {
          const u = t - (this.typeT + i * this.typeStep) + HALF();
          const sc = u >= 0 ? lerp(0.6, 1, E.outBack(clamp(u * 60 / 3), 2.6)) : 0;
          const st = `scale(${sc.toFixed(3)})`; fg[i].style.transform = st; if (sh[i]) sh[i].style.transform = st;
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
      if (this.dashP) {
        const step = DM.boilStep(t);
        if (step !== this._dstep) { this._dstep = step; const [x, y, w, hh] = this.dashBox; const d = DM.paths.rrect(x, y, w, hh, Math.min(hh / 2.2, 40), DM.rng(DM.hash(this.id, 'dash', step)), { jit: 3 }); this.dashP.setAttribute('d', d); this.dashM.setAttribute('d', d); this._dlen = this.dashP.getTotalLength(); }
        const k = E.ioQ(clamp((t - this.dashT + HALF()) / this.dashDur)); const L = this._dlen;
        this.dashM.setAttribute('stroke-dasharray', `${(k * L).toFixed(1)} ${L + 10}`);
      }
    }
  }
  /** rectangle of the n-th key word in the title's parent space (rest pose, valid after layout): {x0, y0, x1, y1} */
  Title.prototype.keyRect = function (n = 0) {
    const b = (this._keys && this._keys[n]) || this._fgBox || [0, 0, this.w, this.h];
    const ox = this.x - this.ax * this.w, oy = this.y - this.ay * this.h;
    return { x0: ox + b[0], y0: oy + b[1], x1: ox + b[2], y1: oy + b[3] };
  };
  DM.Title = Title;
  DM.title = (shot, o) => new Title(shot, Object.assign({ recipe: 'ink-pink' }, o));
  /** plain line: Marker, ink, no colour layer (SCRIPT recipe "ink") */
  DM.text = (shot, o) => new Title(shot, Object.assign({ recipe: 'ink', size: 'M' }, o));
  /** handwritten note (SCRIPT recipe note-pink): 龙藏体, pink, -4 deg */
  DM.note = (shot, o) => new Title(shot, Object.assign({ recipe: 'note-pink', size: 'M', kind: 'note' }, o));
  /** fine print: 悠哉 36 px ink-2 (SCRIPT recipe fine) */
  DM.fine = (shot, o) => new Title(shot, Object.assign({ recipe: 'fine', size: 'XS', kind: 'fine', boil: false }, o));

  // ---------------------------------------------------------------- small type objects
  /** rubber stamp: o.text, o.color pink|mint|yellow|ink, o.size (default 56), rotated -7 deg; enters with STAMP */
  DM.stamp = (shot, o) => {
    const el = h('div', `stamp ${o.color || 'pink'}`); el.textContent = o.text; const px = size(o.size ?? 56); el.style.fontSize = px + 'px';
    const n = new DM.Node(shot, el, Object.assign({ r: -7, layer: 22 }, o, { at: undefined })); n.label = 'stamp ' + o.text; n.size = px;
    DM.registerText(n, { text: o.text, role: 'marker', kind: o.kind || 'label', size: px, recipe: 'stamp-' + (o.color || 'pink'), script: o.script || null, inFootage: !!o.inFootage });
    if (o.at !== undefined) n.in('stamp', o.at, { sfx: o.sfx, gain: o.gain, label: 'stamp ' + o.text });
    if (o.until !== undefined) n.out(o.outFx || 'pop', o.until);
    return n;
  };
  /** pill label: o.text (or o.html), o.color ''|mint|yellow|pink|hot|ink, o.size (default 40) */
  DM.chip = (shot, o) => {
    const el = h('div', `chip ${o.color || ''}`, o.html || esc(o.text)); const px = size(o.size ?? 40); el.style.fontSize = px + 'px';
    if (o.font) el.style.fontFamily = `var(--f-${FONTS[o.font] || o.font})`;
    const n = new DM.Node(shot, el, Object.assign({ layer: 22 }, o, { at: undefined })); n.label = 'chip ' + (o.text || ''); n.size = px;
    DM.registerText(n, { text: o.text || el.textContent, role: o.font ? (FONTS[o.font] || o.font) : 'marker', kind: o.kind || 'label', size: px, recipe: 'chip', script: o.script || null, inFootage: !!o.inFootage });
    if (o.at !== undefined) n.in(o.inFx || 'pop', o.at, { sfx: o.sfx, gain: o.gain });
    if (o.until !== undefined) n.out(o.outFx || 'pop', o.until);
    return n;
  };
  /** the MUSIC SPACE wordmark (Luckiest Guy, yellow fill, ink outline, ink + pink offsets).  Caps only. */
  DM.logo = (shot, o = {}) => {
    const el = h('div', 'logo'); el.textContent = o.text || 'MUSIC SPACE'; const px = size(o.size ?? 128); el.style.fontSize = px + 'px';
    const n = new DM.Node(shot, el, Object.assign({ layer: 20 }, o, { at: undefined })); n.label = 'logo'; n.size = px;
    DM.registerText(n, { text: el.textContent, role: 'logo', kind: o.kind || 'label', size: px, recipe: 'logo', script: o.script || null });
    if (o.at !== undefined) n.in(o.inFx || 'pop', o.at, { sfx: o.sfx, gain: o.gain, label: 'logo' });
    if (o.until !== undefined) n.out(o.outFx || 'pop', o.until);
    return n;
  };
  /** link pill: paper pill, ink border, 得意黑 (the judged link) */
  DM.linkPill = (shot, o) => {
    const el = h('div', 'linkpill'); const px = size(o.size ?? 84); el.style.fontSize = px + 'px';
    el.innerHTML = `<span class="lt">${esc(o.text)}</span>`;
    const n = new DM.Node(shot, el, Object.assign({ layer: 20 }, o, { at: undefined })); n.label = 'link'; n.size = px; n.textEl = el.querySelector('.lt');
    DM.registerText(n, { text: o.text, role: 'digits', kind: o.kind || 'label', size: px, recipe: 'link-pill', script: o.script || null });
    if (o.at !== undefined) {
      const fx = String(o.fx || 'POP').toUpperCase();
      if (fx === 'TYPE') {   // pill pops, the characters type on (32nds)
        n.in('pop', o.at, { sfx: o.sfx, gain: o.gain, label: 'link' });
        const t = T(o.at); const chars = [...o.text]; n.textEl.innerHTML = chars.map(c => `<span class="ch">${esc(c)}</span>`).join('');
        const els = [...n.textEl.querySelectorAll('.ch')]; const step = o.step ?? DM.beatS() / 8;
        n.typeT = t + 4 / 60; n.inner = tt => { els.forEach((e, i) => { const u = tt - (n.typeT + i * step); e.style.opacity = u >= 0 ? '1' : '0'; }); };
        DM.ev(n.typeT, 'type', 'link', { shot: shot.id, dur: step * chars.length, note: chars.length });
      } else n.in('pop', o.at, { sfx: o.sfx, gain: o.gain, label: 'link' });
    }
    if (o.until !== undefined) n.out(o.outFx || 'pop', o.until);
    return n;
  };
  /** pillar sticker: a big word on a marker-coloured card (W3 隐私 / 同意 / 好玩) */
  DM.pillar = (shot, o) => {
    const el = h('div', `pillar ${o.color || 'mint'}`); const px = size(o.size ?? 180); el.style.fontSize = px + 'px';
    el.innerHTML = `<span class="pw">${esc(DM.plain(o.text))}</span>`;
    const n = new DM.Node(shot, el, Object.assign({ r: o.r ?? -2, layer: 18 }, o, { at: undefined })); n.label = 'pillar ' + o.text; n.size = px; n.textEl = el.querySelector('.pw');
    DM.registerText(n, { text: DM.plain(o.text), role: 'display', kind: o.kind || 'label', size: px, recipe: 'pillar-' + (o.color || 'mint'), script: o.script || null });
    if (o.at !== undefined) n.in(o.inFx || 'pop', o.at, { sfx: o.sfx, gain: o.gain, label: 'pillar ' + o.text });
    if (o.until !== undefined) n.out(o.outFx || 'pop', o.until);
    return n;
  };

  // ---------------------------------------------------------------- script lines
  let SCRIPT = {};
  DM.useScript = tl => { SCRIPT = {}; for (const t of tl.text || []) SCRIPT[t.id] = t; DM.scriptData = tl; };
  DM.line = id => SCRIPT[id];
  /** DM.say(shot, 'T024', overrides) — one SCRIPT.md line with its own text, font, size, recipe, entrance and in/out.
   *  Overrides: x, y, ax, ay, r, z, at, until, fx, size, recipe, text, parent, align, maxW (shrinks the size to fit) ... */
  DM.say = (shot, id, o = {}) => {
    const L = SCRIPT[id]; if (!L) throw new Error('DM.say: no SCRIPT line ' + id);
    DM.used.script.add(id);
    const style = o.recipe || L.style; const text = o.text ?? L.text_marked; const px = o.size !== undefined ? size(o.size) : L.size_px;
    const at = o.at ?? L.start, until = o.until !== undefined ? o.until : L.end; const fx = o.fx ?? L.fx;
    const kind = o.kind || L.kind; const common = Object.assign({}, o, { script: id, kind });
    if (style.startsWith('stamp-')) return DM.stamp(shot, Object.assign({ text: L.text, color: style.slice(6), size: px, at, until }, common, { recipe: undefined }));
    if (style.startsWith('chip')) return DM.chip(shot, Object.assign({ text: L.text, color: style.split('-')[1] || '', size: px, at, until }, common, { recipe: undefined }));
    if (style.startsWith('pillar-')) return DM.pillar(shot, Object.assign({ text: L.text, color: style.slice(7), size: px, at, until }, common, { recipe: undefined }));
    if (style === 'link-pill') return DM.linkPill(shot, Object.assign({ text: L.text, size: px, at, until, fx }, common, { recipe: undefined }));
    if (style === 'logo') return DM.logo(shot, Object.assign({ size: px, at, until }, common, { recipe: undefined }));
    const font = o.font || (L.font && FONTS[L.font]) || undefined;
    const rc = Object.assign({ text, recipe: style, size: px, at, until, fx }, common, font ? { font } : {});
    return new Title(shot, rc);
  };
  /** shrink a title so its widest line fits maxW px (call before layout): DM.fit(node, 960) */
  DM.fitWidth = (node, maxW) => { DM.onLayout(() => { const w = node.fg ? node.fg.offsetWidth : node.el.offsetWidth; if (w > maxW) { const k = maxW / w; node.el.style.fontSize = (node.size * k).toFixed(1) + 'px'; node.size *= k; node.textInfo.size = node.size; DM.warn(`text "${node.label}" shrunk ${(k * 100).toFixed(0)}% to fit ${maxW}px`); node.measure(); node.afterLayout(); } }); return node; };
})();
