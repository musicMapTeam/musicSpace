// In-page measurements for the panels task (read-only on the repo).
const L = require('/tmp/space-copy/panels-inv/lib.cjs');

/** A sheet scroller and its close button: scroll offset, where the × is, is it in view and on top, what text or control lies under it. */
function measure(page, { root = '#panel', close = '#panel-close', scroller = null } = {}) {
  return page.evaluate(({ root, close, scroller }) => {
    const r = document.querySelector(root);
    if (!r || r.hidden || !r.getClientRects().length) return { missing: root };
    const s = scroller ? (r.querySelector(scroller) || document.querySelector(scroller)) : r;
    const c = typeof close === 'string' ? (r.querySelector(close) || document.querySelector(close)) : null;
    if (!s || !c) return { missing: !s ? scroller : close };
    const sr = s.getBoundingClientRect(), cr = c.getBoundingClientRect();
    const box = b => [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)];
    const hit = document.elementFromPoint(cr.left + cr.width / 2, cr.top + cr.height / 2);
    const onTop = !!hit && (hit === c || c.contains(hit));
    const inView = cr.top >= Math.max(0, sr.top) - 1 && cr.bottom <= Math.min(innerHeight, sr.bottom) + 1 && cr.left >= sr.left - 1 && cr.right <= sr.right + 1;
    const inset = 4, R = { l: cr.left + inset, t: cr.top + inset, r: cr.right - inset, b: cr.bottom - inset };
    const meet = b => b.width > 0 && b.height > 0 && b.left < R.r && b.right > R.l && b.top < R.b && b.bottom > R.t;
    const covered = new Set();
    const walker = document.createTreeWalker(s, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.data.trim() || c.contains(n)) continue;
      const el = n.parentElement;
      if (!el || getComputedStyle(el).visibility === 'hidden' || !el.getClientRects().length) continue;
      const range = document.createRange(); range.selectNodeContents(n);
      for (const b of range.getClientRects()) if (meet(b)) { covered.add('text「' + n.data.trim().slice(0, 18) + '」'); break; }
    }
    for (const el of s.querySelectorAll('button,input,select,textarea,img,a,svg')) {
      if (el === c || c.contains(el) || !el.getClientRects().length || getComputedStyle(el).visibility === 'hidden') continue;
      if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
      if (meet(el.getBoundingClientRect())) covered.add(el.tagName.toLowerCase() + (el.getAttribute('class') ? '.' + el.getAttribute('class').split(' ')[0] : '') + (el.textContent.trim() ? '「' + el.textContent.trim().slice(0, 14) + '」' : ''));
    }
    return { kind: r.dataset?.kind, st: Math.round(s.scrollTop), sh: s.scrollHeight, ch: s.clientHeight, close: box(cr), sheet: box(sr), inView, onTop, covered: [...covered] };
  }, { root, close, scroller });
}

/** The body of #panel laid out with the sticky × and with the old absolute one (top/right 10px, no margins): identical when nothing moved. */
function layoutAB(page) {
  return page.evaluate(() => {
    const panel = document.querySelector('#panel');
    const nodes = [...document.querySelectorAll('#panel-body *')].slice(0, 600);
    const pos = () => nodes.map(e => { const b = e.getBoundingClientRect(); return `${Math.round(b.left * 2) / 2},${Math.round(b.top * 2) / 2},${Math.round(b.width * 2) / 2},${Math.round(b.height * 2) / 2}`; });
    const st = panel.scrollTop;
    const a = pos(), sh = panel.scrollHeight;
    const style = document.createElement('style');
    style.textContent = '.panel>#panel-close,.panel[data-kind]>#panel-close{position:absolute!important;top:10px!important;right:10px!important;margin:0!important}';
    document.head.append(style);
    const b = pos(), shB = panel.scrollHeight;
    style.remove();
    panel.scrollTop = st;
    const diffs = [];
    a.forEach((v, i) => { if (v !== b[i] && diffs.length < 4) diffs.push(`${nodes[i].tagName.toLowerCase()}.${(nodes[i].getAttribute('class') || '').split(' ')[0]} sticky ${v} / absolute ${b[i]}`); });
    return { same: diffs.length === 0 && sh === shB, nodes: nodes.length, sh, shB, diffs };
  });
}

/** The text of an element line by line (character boxes grouped by their top), to see where a caption breaks. */
function lines(page, selector, all = false) {
  return page.evaluate(({ selector, all }) => {
    const flat = document.createElement('style'); // rotation does not change where a line breaks, only where its characters are drawn
    flat.textContent = '*{transform:none!important;rotate:none!important;animation:none!important}';
    document.head.append(flat);
    try {
    const els = all ? [...document.querySelectorAll(selector)] : [document.querySelector(selector)].filter(Boolean);
    return els.map(el => {
      const rows = new Map();
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const p = n.parentElement;
        if (!p.getClientRects().length) continue;
        const cs = getComputedStyle(p);
        if (cs.position === 'absolute' && cs.clipPath && cs.clipPath !== 'none') continue; // screen-reader only separator
        for (let i = 0; i < n.data.length; i++) {
          const range = document.createRange(); range.setStart(n, i); range.setEnd(n, i + 1);
          const b = range.getBoundingClientRect();
          if (!b.width && n.data[i] !== ' ') continue;
          const key = Math.round(b.top / 6);
          const row = rows.get(key) || { top: b.top, chars: [] };
          row.chars.push({ x: b.left, ch: n.data[i] });
          rows.set(key, row);
        }
      }
      const text = [...rows.values()].sort((a, b) => a.top - b.top).map(r => r.chars.sort((a, b) => a.x - b.x).map(c => c.ch).join('').trim());
      const box = el.getBoundingClientRect();
      const host = el.closest('.photo-item') || el.parentElement;
      const hb = host.getBoundingClientRect();
      const partLines = k => { const tops = new Set(); const w = document.createTreeWalker(k, NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) for (let i = 0; i < n.data.length; i++) { if (n.data[i] === ' ') continue; const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1); const b = r.getBoundingClientRect(); if (b.width) tops.add(Math.round(b.top / 6)); } return tops.size; };
      const parts = [...el.children].filter(k => getComputedStyle(k).position !== 'absolute').map(k => ({ text: k.textContent, lines: partLines(k), right: Math.round(k.getBoundingClientRect().right - hb.right) }));
      return { lines: text, overflowX: el.scrollWidth > el.clientWidth + 1, beyondHost: Math.round(box.right - hb.right), parts, display: getComputedStyle(el).display };
    });
    } finally { flat.remove(); }
  }, { selector, all });
}

const scrollTo = (page, y, selector = '#panel') => page.evaluate(([y, selector]) => { const p = document.querySelector(selector); p.scrollTop = y === 'end' ? p.scrollHeight : y === 'mid' ? Math.round((p.scrollHeight - p.clientHeight) / 2) : y; }, [y, selector]);
const clickHidden = (page, dataset) => page.evaluate(dataset => { const o = document.createElement('button'); Object.assign(o.dataset, dataset); o.style.position = 'fixed'; o.style.left = '-9999px'; document.body.append(o); o.click(); o.remove(); }, dataset);

module.exports = { ...L, measure, layoutAB, lines, scrollTo, clickHidden };
