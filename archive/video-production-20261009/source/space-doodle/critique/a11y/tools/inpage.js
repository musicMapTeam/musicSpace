// In-page measurement for the a11y lens. Injected with page.evaluate(source); defines window.__a11y.
// scan() returns: text items (for contrast + font size), clipped/overflowing text, viewport overflow,
// small targets (effective hit area by hit-testing), horizontal scrollers, decorations over text/targets.
(() => {
  if (window.__a11y && window.__a11y.version === 11) return;
  const cvs = document.createElement('canvas'); cvs.width = cvs.height = 1;
  const cx2 = cvs.getContext('2d', { willReadFrequently: true });
  const colorCache = new Map();
  function rgba(str) {
    if (!str || str === 'transparent' || str === 'none') return { r: 0, g: 0, b: 0, a: 0 };
    if (colorCache.has(str)) return colorCache.get(str);
    let out, m = str.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
    if (m) out = { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4]) };
    else if ((m = str.match(/^color\(srgb\s+([-\d.e]+)\s+([-\d.e]+)\s+([-\d.e]+)(?:\s*\/\s*([\d.e]+%?))?\s*\)$/))) out = { r: +m[1] * 255, g: +m[2] * 255, b: +m[3] * 255, a: m[4] === undefined ? 1 : (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4]) };
    else { cx2.clearRect(0, 0, 1, 1); cx2.fillStyle = '#000'; cx2.fillStyle = str; cx2.fillRect(0, 0, 1, 1); const d = cx2.getImageData(0, 0, 1, 1).data; out = { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }; }
    colorCache.set(str, out); return out;
  }
  const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = c => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const over = (top, a, base) => ({ r: top.r * a + base.r * (1 - a), g: top.g * a + base.g * (1 - a), b: top.b * a + base.b * (1 - a) });

  function sel(el) {
    if (!el || el.nodeType !== 1) return '';
    const parts = [];
    for (let n = el, depth = 0; n && n.nodeType === 1 && depth < 4; n = n.parentElement, depth++) {
      let p = n.tagName.toLowerCase();
      if (n.id) { p += '#' + n.id; parts.unshift(p); break; }
      const cls = [...n.classList].filter(c => !/^(is-|has-)/.test(c) || depth === 0).slice(0, 2);
      if (cls.length) p += '.' + cls.join('.');
      const dataAttr = [...n.attributes].find(a => a.name.startsWith('data-') && a.name !== 'data-ds');
      if (dataAttr) p += `[${dataAttr.name}${dataAttr.value && dataAttr.value.length < 28 ? `="${dataAttr.value}"` : ''}]`;
      parts.unshift(p);
    }
    return parts.join(' > ');
  }
  const txt = el => (el.innerText || el.textContent || el.value || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 60);

  function srOnly(el, cs) {
    if (cs.clip && cs.clip !== 'auto' && /rect\(0px,? 0px,? 0px,? 0px\)|rect\(1px/.test(cs.clip)) return true;
    if (/inset\(50%/.test(cs.clipPath)) return true;
    const r = el.getBoundingClientRect();
    if (r.width <= 1.5 && r.height <= 1.5 && cs.overflow !== 'visible') return true;
    return false;
  }
  function hiddenByAncestor(el) {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.contentVisibility === 'hidden') return true;
      if (srOnly(n, cs)) return 'sr';
    }
    return false;
  }
  function effOpacity(el) { let o = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity); return o; }
  function containingBlock(el) {
    const cs = getComputedStyle(el); const pos = cs.position;
    const makesCB = (s, forFixed) => s.transform !== 'none' || s.perspective !== 'none' || s.filter !== 'none' || /paint|layout|strict|content/.test(s.contain) || /transform|filter|perspective/.test(s.willChange) || (s.backdropFilter && s.backdropFilter !== 'none') || (!forFixed && s.position !== 'static');
    if (pos === 'fixed') { for (let a = el.parentElement; a; a = a.parentElement) if (makesCB(getComputedStyle(a), true)) return a; return null; }
    if (pos === 'absolute') { for (let a = el.parentElement; a; a = a.parentElement) if (makesCB(getComputedStyle(a), false)) return a; return null; }
    return el.parentElement;
  }
  function clipsX(s) { return s.overflowX !== 'visible' || /paint|strict|content/.test(s.contain); }
  function clipsY(s) { return s.overflowY !== 'visible' || /paint|strict|content/.test(s.contain); }
  function paddingBox(a) { const r = a.getBoundingClientRect(), s = getComputedStyle(a); const bl = parseFloat(s.borderLeftWidth) || 0, br = parseFloat(s.borderRightWidth) || 0, bt = parseFloat(s.borderTopWidth) || 0, bb = parseFloat(s.borderBottomWidth) || 0; return { left: r.left + bl, right: r.right - br, top: r.top + bt, bottom: r.bottom - bb }; }
  // Clip chain: [{el, x:bool, y:bool, box, scrollX:bool, scrollY:bool}] for content of `el` (includes el itself as a clipper of its own content)
  function clipChain(el) {
    const chain = [];
    const add = a => { const s = getComputedStyle(a); const cx = clipsX(s), cy = clipsY(s); if (cx || cy) chain.push({ el: a, x: cx, y: cy, box: paddingBox(a), scrollX: /auto|scroll/.test(s.overflowX), scrollY: /auto|scroll/.test(s.overflowY) }); };
    add(el);
    for (let a = containingBlock(el); a && a !== document.documentElement; a = containingBlock(a)) add(a);
    return chain;
  }
  function textRects(node) {
    const range = document.createRange(); range.selectNodeContents(node);
    return [...range.getClientRects()].filter(r => r.width > 0.5 && r.height > 0.5);
  }
  const VW = () => document.documentElement.clientWidth, VH = () => innerHeight;
  function clipToChain(r, chain) {
    let out = { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    for (const c of chain) {
      if (c.x) { out.left = Math.max(out.left, c.box.left); out.right = Math.min(out.right, c.box.right); }
      if (c.y) { out.top = Math.max(out.top, c.box.top); out.bottom = Math.min(out.bottom, c.box.bottom); }
    }
    return out;
  }
  const area = r => Math.max(0, r.right - r.left) * Math.max(0, r.bottom - r.top);

  // Style override used while hit-testing text visibility: everything hit-testable.
  let peStyle = null;
  function pointerAll(on) {
    if (on && !peStyle) { peStyle = document.createElement('style'); peStyle.textContent = '*,*::before,*::after{pointer-events:auto!important}'; document.head.append(peStyle); }
    if (!on && peStyle) { peStyle.remove(); peStyle = null; }
  }
  // decoration = ds-deco/ds-tape, or an aria-hidden element that is not hit-testable in the real page (pointer-events:none)
  function origPE(n) { if (!peStyle) return getComputedStyle(n).pointerEvents; peStyle.disabled = true; const v = getComputedStyle(n).pointerEvents; peStyle.disabled = false; return v; }
  const DECO = el => { if (!el.closest) return null; const d = el.closest('.ds-deco,.ds-tape'); if (d) return d; const h = el.closest('[aria-hidden="true"]'); if (h && origPE(el) === 'none') return h; return null; };
  // does this element paint something opaque-ish over what is below it (own box only)?
  function paints(n) {
    if (['IMG', 'CANVAS', 'VIDEO', 'PICTURE', 'IFRAME'].includes(n.tagName)) return true;
    if (n.tagName === 'svg' || n instanceof SVGElement) return n.tagName === 'svg' && n.getBoundingClientRect().width > 24;
    const s = getComputedStyle(n);
    if (s.visibility !== 'visible') return false;
    if (parseFloat(s.opacity) < 0.2) return false;
    if (rgba(s.backgroundColor).a > 0.35) return true;
    if (s.backgroundImage && s.backgroundImage !== 'none') return true;
    if (s.maskImage && s.maskImage !== 'none' || s.webkitMaskImage && s.webkitMaskImage !== 'none') return true;
    return false;
  }

  function backgroundStack(el, x, y) {
    // composite background colours below the text at (x,y) using the hit-test stack; flags complex layers
    const stack = document.elementsFromPoint(x, y);
    let i = stack.findIndex(n => n === el || el.contains(n));
    if (i < 0) i = 0;
    const layers = []; let complex = null;
    for (let k = i; k < stack.length; k++) {
      const n = stack[k];
      if (n !== el && !n.contains(el) && el.contains(n)) continue;
      const s = getComputedStyle(n);
      if (['IMG', 'CANVAS', 'VIDEO', 'svg', 'PICTURE'].includes(n.tagName) && !(n === el)) { complex = complex || n.tagName.toLowerCase() + ' ' + sel(n); break; }
      if (s.backgroundImage && s.backgroundImage !== 'none' && !/radial-gradient\(rgba\(28, 27, 26, 0\.16\)/.test(s.backgroundImage)) complex = complex || 'bg-image ' + sel(n);
      const c = rgba(s.backgroundColor); const o = effOpacity(n);
      if (c.a > 0) { layers.push({ c, a: c.a * o, who: sel(n) }); if (c.a * o >= 0.999) break; }
    }
    let base = { r: 255, g: 255, b: 255 };
    for (let k = layers.length - 1; k >= 0; k--) base = over(layers[k].c, layers[k].a, base);
    return { bg: base, complex, layers: layers.map(l => l.who + ' a=' + l.a.toFixed(2)).slice(0, 4) };
  }

  function fontFirst(cs) { return (cs.fontFamily.split(',')[0] || '').replace(/["']/g, '').trim(); }

  function collectText(opts) {
    const items = [];
    const vw = VW(), vh = VH();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: n => n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
    const byEl = new Map();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement; if (!el || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'OPTION'].includes(el.tagName)) continue;
      if (el.closest('svg')) continue;
      if (!byEl.has(el)) byEl.set(el, []);
      byEl.get(el).push(n);
    }
    // form fields: value / placeholder text
    for (const f of document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range]):not([type=color]),textarea,select')) byEl.set(f, byEl.get(f) || []);
    pointerAll(true);
    try {
      for (const [el, nodes] of byEl) {
        const cs = getComputedStyle(el);
        if (cs.visibility !== 'visible') continue;
        const hid = hiddenByAncestor(el); if (hid) continue;
        const op = effOpacity(el); if (op < 0.05) continue;
        let rects = [];
        const isField = /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
        let fieldText = '', placeholder = false;
        if (isField) {
          fieldText = el.tagName === 'SELECT' ? (el.selectedOptions[0]?.textContent || '') : el.value;
          if (!fieldText && el.placeholder) { fieldText = el.placeholder; placeholder = true; }
          if (!fieldText.trim()) continue;
          const r = el.getBoundingClientRect(); const pl = parseFloat(cs.paddingLeft) || 0, pt = parseFloat(cs.paddingTop) || 0, pb = parseFloat(cs.paddingBottom) || 0;
          const fs = parseFloat(cs.fontSize);
          const top = el.tagName === 'TEXTAREA' ? r.top + pt + (parseFloat(cs.borderTopWidth) || 0) : r.top + (r.height - fs * 1.3) / 2;
          rects.push({ left: r.left + pl + (parseFloat(cs.borderLeftWidth) || 0), right: Math.min(r.right - 8, r.left + pl + 8 + fs * Math.min(fieldText.length, 40)), top, bottom: top + fs * 1.3 });
        } else for (const n of nodes) rects.push(...textRects(n).map(r => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom })));
        if (!rects.length) continue;
        const chain = clipChain(el);
        // clipped text: rect outside a non-scrolling clipper
        const clipped = [];
        for (const r of rects) for (const c of chain) {
          const outX = c.x && (r.left < c.box.left - 2 || r.right > c.box.right + 2);
          const outY = c.y && (r.top < c.box.top - 2 || r.bottom > c.box.bottom + 2);
          if (!outX && !outY) continue;
          if ((outX && c.scrollX) || (outY && c.scrollY)) break; // scrolled out of view inside a scroller: not clipped
          clipped.push({ by: sel(c.el), axis: outX ? 'x' : 'y', text: { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom) }, box: { l: Math.round(c.box.left), r: Math.round(c.box.right), t: Math.round(c.box.top), b: Math.round(c.box.bottom) } }); break;
        }
        const vis = rects.map(r => clipToChain(r, chain)).filter(r => area(r) > 1);
        if (!vis.length) continue;
        const inView = vis.map(r => ({ left: Math.max(0, r.left), right: Math.min(vw, r.right), top: Math.max(0, r.top), bottom: Math.min(vh, r.bottom) })).filter(r => area(r) > 1);
        const offX = vis.some(r => r.right > vw + 1 || r.left < -1);
        // occlusion: hit-test centres of visible rects (pointer-events forced on)
        let shown = 0, occluders = new Set(), decoOver = new Set();
        const samplePts = [];
        for (const r of inView.slice(0, 6)) { const cy = (r.top + r.bottom) / 2; for (const fx of [0.2, 0.5, 0.8]) samplePts.push([r.left + (r.right - r.left) * fx, cy]); }
        for (const [x, y] of samplePts) {
          const stack = document.elementsFromPoint(x, y);
          let verdict = null;
          for (const n of stack) {
            if (n === el || el.contains(n) || n.contains(el)) { verdict = 'shown'; break; }
            if (!paints(n)) continue;
            if (DECO(n) && !DECO(el)) { decoOver.add(sel(n)); verdict = 'shown'; break; }
            occluders.add(sel(n)); verdict = 'hidden'; break;
          }
          if (verdict === 'shown') shown++;
        }
        const visibleFrac = samplePts.length ? shown / samplePts.length : 0;
        const fill = cs.webkitTextFillColor && cs.webkitTextFillColor !== cs.color ? rgba(cs.webkitTextFillColor) : rgba(cs.color);
        const textColor = placeholder ? rgba(getComputedStyle(el, '::placeholder').color) : fill;
        const strokeW = parseFloat(cs.webkitTextStrokeWidth) || 0;
        const strokeC = rgba(cs.webkitTextStrokeColor);
        const r0 = inView[0] || vis[0];
        const bgInfo = inView.length ? backgroundStack(el, (r0.left + r0.right) / 2, (r0.top + r0.bottom) / 2) : null;
        const fs = parseFloat(cs.fontSize);
        const tf = cs.transform;
        let scale = 1; if (tf && tf !== 'none') { const m = new DOMMatrix(tf); scale = Math.sqrt(m.a * m.a + m.b * m.b); }
        const item = {
          sel: sel(el), tag: el.tagName.toLowerCase(), text: (isField ? fieldText : nodes.map(n => n.nodeValue).join('')).replace(/\s+/g, ' ').trim().slice(0, 50),
          fontSize: fs, effSize: +(fs * scale).toFixed(2), weight: cs.fontWeight, family: fontFirst(cs), familyFull: cs.fontFamily.slice(0, 80),
          color: textColor, alpha: textColor.a * op, opacity: +op.toFixed(3), placeholder, field: isField,
          stroke: strokeW >= 0.8 && strokeC.a > 0.5 ? { w: strokeW, c: strokeC } : null,
          shadow: cs.textShadow !== 'none' ? cs.textShadow.slice(0, 80) : null,
          disabled: !!el.closest('button:disabled,input:disabled,select:disabled,textarea:disabled,fieldset:disabled,[aria-disabled="true"]'),
          decorative: !!el.closest('[aria-hidden="true"]'),
          rects: inView.slice(0, 8).map(r => ({ l: +r.left.toFixed(1), r: +r.right.toFixed(1), t: +r.top.toFixed(1), b: +r.bottom.toFixed(1) })),
          inView: inView.length > 0, offX, clipped: clipped.slice(0, 2), visibleFrac: +visibleFrac.toFixed(2),
          occluders: [...occluders].slice(0, 3), decoOver: [...decoOver].slice(0, 3),
          domBg: bgInfo && bgInfo.bg, bgComplex: bgInfo && bgInfo.complex, bgLayers: bgInfo && bgInfo.layers,
          ellipsis: cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1,
          lineClamp: (cs.webkitLineClamp && cs.webkitLineClamp !== 'none' && el.scrollHeight > el.clientHeight + 2) ? cs.webkitLineClamp : null,
          ws: cs.whiteSpace,
        };
        if (item.domBg) { const t = over(textColor, item.alpha, item.domBg); item.domContrast = +contrast(t, item.domBg).toFixed(2); }
        items.push(item);
      }
    } finally { pointerAll(false); }
    return items;
  }

  // pseudo-element text (content strings) for the font-size check
  function pseudoText() {
    const out = [];
    for (const el of document.body.querySelectorAll('*')) {
      if (!el.getClientRects().length) continue;
      for (const p of ['::before', '::after']) {
        const s = getComputedStyle(el, p);
        const c = s.content;
        if (!c || c === 'none' || c === 'normal' || !/^".*\S.*"$/.test(c)) continue;
        if (s.display === 'none' || s.visibility !== 'visible') continue;
        if (hiddenByAncestor(el)) continue;
        out.push({ sel: sel(el) + p, text: c.slice(1, -1).slice(0, 30), fontSize: parseFloat(s.fontSize), family: fontFirst(s), color: rgba(s.color), bg: rgba(s.backgroundColor), opacity: +effOpacity(el).toFixed(2) });
      }
    }
    return out;
  }

  const INTERACTIVE = 'a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=link],[role=tab],[role=checkbox],[role=radio],[role=switch],[role=menuitem],[role=option],[tabindex]:not([tabindex="-1"])';
  function targets() {
    const out = []; const vw = VW(), vh = VH();
    for (const el of document.querySelectorAll(INTERACTIVE)) {
      if (!el.getClientRects().length) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility !== 'visible' || hiddenByAncestor(el)) continue;
      if (el.disabled || el.getAttribute('aria-disabled') === 'true' || el.closest('fieldset:disabled')) continue;
      if (el.closest('[inert]')) continue;
      const r = el.getBoundingClientRect();
      const chain = clipChain(el.parentElement || el);
      const v = clipToChain(r, chain.filter(c => c.el !== el));
      if (area(v) < 1) continue;
      if (v.right < 0 || v.left > vw || v.bottom < 0 || v.top > vh) continue;
      const labels = el.labels ? [...el.labels] : [];
      const isHit = n => n && (n === el || el.contains(n) || labels.some(l => l === n || l.contains(n)));
      const cx = (Math.max(v.left, 0) + Math.min(v.right, vw)) / 2, cy = (Math.max(v.top, 0) + Math.min(v.bottom, vh)) / 2;
      // if centre hidden, look for any hittable point inside the rect (custom controls draw on a label)
      let ox = cx, oy = cy, centreHit = isHit(document.elementFromPoint(cx, cy));
      if (!centreHit && labels.length) { const lr = labels[0].getBoundingClientRect(); ox = (lr.left + lr.right) / 2; oy = (lr.top + lr.bottom) / 2; centreHit = isHit(document.elementFromPoint(ox, oy)); }
      let covering = null;
      if (!centreHit) { const h = document.elementFromPoint(cx, cy); covering = h ? sel(h) : 'outside'; }
      const ext = (dx, dy) => { let d = 0; for (let k = 1; k <= 40; k++) { const x = ox + dx * k, y = oy + dy * k; if (x < 0 || y < 0 || x >= vw || y >= vh) return { d, cut: true }; if (!isHit(document.elementFromPoint(x, y))) return { d, cut: false }; d = k; } return { d: 40, cut: false }; };
      let ew = 0, eh = 0, cut = false;
      if (centreHit) { const L = ext(-1, 0), R = ext(1, 0), U = ext(0, -1), D = ext(0, 1); ew = L.d + R.d + 1; eh = U.d + D.d + 1; cut = L.cut || R.cut || U.cut || D.cut; }
      // union with label boxes for inputs
      let w = r.width, h = r.height;
      for (const l of labels) { const lr = l.getBoundingClientRect(); w = Math.max(w, lr.width); h = Math.max(h, lr.height); }
      out.push({ sel: sel(el), text: txt(el), role: el.getAttribute('role') || el.tagName.toLowerCase() + (el.type && el.tagName === 'INPUT' ? ':' + el.type : ''), w: +r.width.toFixed(1), h: +r.height.toFixed(1), labelW: +w.toFixed(1), labelH: +h.toFixed(1), hitW: ew, hitH: eh, cut, centreHit, covering, x: Math.round(r.left), y: Math.round(r.top), inline: cs.display === 'inline' && !!el.closest('p,li,span,small'), id: el.id || null });
    }
    return out;
  }

  function overflowBoxes() {
    const vw = VW(); const out = { page: null, hscroll: [], beyond: [] };
    const se = document.scrollingElement;
    if (se.scrollWidth > vw + 1) out.page = { scrollWidth: se.scrollWidth, vw };
    const bodyCs = getComputedStyle(document.body), htmlCs = getComputedStyle(document.documentElement);
    out.pageClip = { html: htmlCs.overflowX, body: bodyCs.overflowX, bodyScrollW: document.body.scrollWidth };
    for (const el of document.body.querySelectorAll('*')) {
      if (!el.getClientRects().length) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility !== 'visible' && !el.children.length) continue;
      if (/auto|scroll/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
        if (hiddenByAncestor(el)) continue;
        out.hscroll.push({ sel: sel(el), scrollW: el.scrollWidth, clientW: el.clientWidth, text: txt(el).slice(0, 40) });
      }
      const r = el.getBoundingClientRect();
      if ((r.right > vw + 1.5 || r.left < -1.5) && r.width > 0 && r.height > 0) {
        if (hiddenByAncestor(el)) continue;
        if (el.closest('.ds-defs')) continue;
        const chain = clipChain(el.parentElement || el).filter(c => c.el !== el);
        const v = clipToChain(r, chain);
        if (area(v) < 1) continue;
        if (v.right > vw + 1.5 || v.left < -1.5) {
          const scroller = chain.find(c => c.scrollX);
          out.beyond.push({ sel: sel(el), l: Math.round(v.left), r: Math.round(v.right), w: Math.round(r.width), text: txt(el).slice(0, 30), inScroller: scroller ? sel(scroller.el) : null, deco: !!DECO(el), pos: cs.position });
        }
      }
    }
    // scroll containers (and fixed sheets) cut by an ancestor clip or by the viewport: their end can't be reached
    out.cut = [];
    for (const el of document.body.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      const isScroller = /auto|scroll/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 2;
      const isSheet = (cs.position === 'fixed' || cs.position === 'absolute') && el.matches('#panel,.panel,.photo-exchanges,.private-chat,.community-panel,.wardrobe,#demo-tour,.room-moderation,section[class*="panel"]');
      if (!isScroller && !isSheet) continue;
      if (!el.getClientRects().length || cs.visibility !== 'visible' || hiddenByAncestor(el)) continue;
      const r = el.getBoundingClientRect(); if (r.height < 40 || r.width < 40) continue;
      const chain = clipChain(el.parentElement || el).filter(c => c.el !== el);
      const v = clipToChain(r, chain);
      const vh = innerHeight;
      const cutBottom = Math.round(r.bottom - Math.min(v.bottom, vh)), cutTop = Math.round(Math.max(v.top, 0) - r.top);
      const cutRight = Math.round(r.right - Math.min(v.right, vw)), cutLeft = Math.round(Math.max(v.left, 0) - r.left);
      if (cutBottom > 2 || cutTop > 2 || cutRight > 2 || cutLeft > 2) {
        const by = chain.find(c => (c.y && (c.box.bottom < r.bottom - 2 || c.box.top > r.top + 2)) || (c.x && (c.box.right < r.right - 2 || c.box.left > r.left + 2)));
        out.cut.push({ sel: sel(el), scroller: isScroller, rect: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)], cutTop, cutBottom, cutLeft, cutRight, by: by ? sel(by.el) : 'viewport' });
      }
    }
    // keep only outermost "beyond" entries
    out.beyond = out.beyond.filter((b, i, arr) => !arr.some((o, j) => j < i && b.sel.startsWith(o.sel) && b.sel !== o.sel)).slice(0, 40);
    return out;
  }

  function scrollers() {
    const out = [];
    document.querySelectorAll('[data-a11y-scroller]').forEach(n => n.removeAttribute('data-a11y-scroller'));
    for (const el of [document.scrollingElement, ...document.body.querySelectorAll('*')]) {
      if (!el.getClientRects || (!el.getClientRects().length && el !== document.scrollingElement)) continue;
      const cs = getComputedStyle(el);
      const canY = el === document.scrollingElement ? el.scrollHeight > innerHeight + 4 && cs.overflowY !== 'hidden' : /auto|scroll/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 24;
      if (!canY) continue;
      if (el !== document.scrollingElement) { if (hiddenByAncestor(el)) continue; if (cs.visibility !== 'visible') continue; const r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth || r.height < 60) continue; }
      out.push({ sel: el === document.scrollingElement ? ':root' : sel(el), sh: el.scrollHeight, ch: el === document.scrollingElement ? innerHeight : el.clientHeight, top: el.scrollTop });
      el.dataset && (el.dataset.a11yScroller = String(out.length - 1));
    }
    return out;
  }
  function scrollTo(index, top) {
    const el = index === -1 ? document.scrollingElement : document.querySelector(`[data-a11y-scroller="${index}"]`);
    if (!el) return null; el.scrollTop = top; return el.scrollTop;
  }

  function scan() {
    const text = collectText();
    return { vw: VW(), vh: VH(), dpr: devicePixelRatio, text, pseudo: pseudoText(), targets: targets(), overflow: overflowBoxes(), url: location.href };
  }
  window.__a11y = { version: 11, scan, scrollers, scrollTo, sel, rgba, contrast, collectText, targets, overflowBoxes, pointerAll, hiddenByAncestor, clipChain };
})();
