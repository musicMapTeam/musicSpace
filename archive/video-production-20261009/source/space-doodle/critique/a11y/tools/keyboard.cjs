// Keyboard pass: Tab through the first screen, then open the join panel and Tab through it.
// For every stop: what got focus, is it on screen and uncovered, and is the focus indicator visible
// (pixel diff of the element's surroundings focused vs. unfocused, via Shift+Tab / Tab).
// usage: node keyboard.cjs <w320|w390|w768|w1440> [maxStops]
const L = require('./lib.cjs');
const fs = require('fs');
const path = require('path');
const [, , vp = 'w390', maxArg = '40'] = process.argv;
const MAX = +maxArg;
setTimeout(() => { console.error('watchdog'); process.exit(2); }, 9 * 60 * 1000).unref();
const OUT = path.join(L.ROOT, 'keyboard', vp); fs.mkdirSync(OUT, { recursive: true });
const sleep = L.sleep;

async function describe(page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body || el === document.documentElement) return { body: true };
    el.setAttribute('data-a11y-kb', '1');
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const vw = document.documentElement.clientWidth, vh = innerHeight;
    const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
    const inView = r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
    const fully = r.top >= -1 && r.bottom <= vh + 1 && r.left >= -1 && r.right <= vw + 1;
    let top = null;
    if (inView) { const h = document.elementFromPoint(Math.min(vw - 1, Math.max(0, cx)), Math.min(vh - 1, Math.max(0, cy))); top = h && (h === el || el.contains(h) || (el.labels && [...el.labels].some(l => l.contains(h)))) ? 'self' : (h ? window.__a11y ? window.__a11y.sel(h) : h.tagName : null); }
    let o = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity);
    const inPanel = !!el.closest('#panel, .photo-exchanges, .private-chat, .community-panel, .wardrobe');
    const labels = el.labels ? [...el.labels].map(l => l.getBoundingClientRect()) : [];
    const box = labels.reduce((b, l) => ({ left: Math.min(b.left, l.left), top: Math.min(b.top, l.top), right: Math.max(b.right, l.right), bottom: Math.max(b.bottom, l.bottom) }), { left: r.left, top: r.top, right: r.right, bottom: r.bottom });
    return {
      sel: window.__a11y ? window.__a11y.sel(el) : el.tagName, text: (el.innerText || el.value || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 40),
      tag: el.tagName.toLowerCase(), type: el.type || null, rect: { x: r.left, y: r.top, w: r.width, h: r.height }, box,
      inView, fully, top, opacity: +o.toFixed(2), visibility: cs.visibility, focusVisible: el.matches(':focus-visible'),
      outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor} off ${cs.outlineOffset}`, boxShadow: cs.boxShadow.slice(0, 90), inPanel,
      ariaHidden: !!el.closest('[aria-hidden="true"]'), inert: !!el.closest('[inert]'),
    };
  });
}
function clipOf(info, vpSize, pad = 10) {
  const b = info.box;
  const x = Math.max(0, Math.floor(b.left - pad)), y = Math.max(0, Math.floor(b.top - pad));
  const r = Math.min(vpSize.width, Math.ceil(b.right + pad)), btm = Math.min(vpSize.height, Math.ceil(b.bottom + pad));
  if (r - x < 2 || btm - y < 2) return null;
  return { x, y, width: r - x, height: btm - y };
}
function diff(a, b) {
  const A = L.PNG.sync.read(a), B = L.PNG.sync.read(b);
  const w = Math.min(A.width, B.width), h = Math.min(A.height, B.height);
  let changed = 0, strong = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * A.width + x) * 4, j = (y * B.width + x) * 4;
    const d = Math.abs(A.data[i] - B.data[j]) + Math.abs(A.data[i + 1] - B.data[j + 1]) + Math.abs(A.data[i + 2] - B.data[j + 2]);
    if (d > 60) { changed++; const c = L.contrast({ r: A.data[i], g: A.data[i + 1], b: A.data[i + 2] }, { r: B.data[j], g: B.data[j + 1], b: B.data[j + 2] }); if (c >= 3) strong++; }
  }
  return { changed, strong, px: w * h };
}

async function tabPass(page, label, max) {
  const size = page.viewportSize();
  const stops = [];
  let firstSel = null;
  for (let i = 0; i < max; i++) {
    await page.evaluate(() => document.querySelectorAll('[data-a11y-kb]').forEach(n => n.removeAttribute('data-a11y-kb')));
    await page.keyboard.press('Tab');
    await sleep(320);
    await L.inject(page);
    const info = await describe(page);
    if (info.body) { stops.push({ i, body: true }); if (stops.filter(s => s.body).length > 1) break; continue; }
    if (firstSel && info.sel === firstSel && i > 3) { stops.push({ i, cycle: true, sel: info.sel }); break; }
    if (!firstSel) firstSel = info.sel;
    const clip = info.inView ? clipOf(info, size) : null;
    let d = null;
    if (clip) {
      const A = await page.screenshot({ clip });
      await page.keyboard.press('Shift+Tab'); await sleep(320);
      const info2 = await page.evaluate(() => { const el = document.querySelector('[data-a11y-kb]'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, same: document.activeElement === el }; });
      let B = null;
      if (info2 && !info2.same) {
        const dx = info2.x - info.rect.x, dy = info2.y - info.rect.y;
        const clip2 = { x: Math.max(0, clip.x + dx), y: Math.max(0, clip.y + dy), width: clip.width, height: clip.height };
        if (clip2.x + clip2.width <= size.width + 0.5 && clip2.y + clip2.height <= size.height + 0.5) B = await page.screenshot({ clip: clip2 });
        d = B ? { ...diff(A, B), moved: Math.round(Math.abs(dx) + Math.abs(dy)) } : { error: 'moved out' };
      } else d = { error: 'shift-tab did not leave' };
      await page.keyboard.press('Tab'); await sleep(320);
      const back = await page.evaluate(() => document.activeElement && document.activeElement.hasAttribute('data-a11y-kb'));
      if (!back) { d.refocused = true; await page.evaluate(() => document.querySelector('[data-a11y-kb]')?.focus()); await sleep(200); }
      const name = `${label}-${String(i).padStart(2, '0')}`;
      fs.writeFileSync(path.join(OUT, `${name}-focus.png`), A); if (B) fs.writeFileSync(path.join(OUT, `${name}-blur.png`), B);
    }
    const perim = 2 * (info.box.right - info.box.left + info.box.bottom - info.box.top) * (vp === 'w1440' ? 1 : 2);
    const visibleRing = d && !d.error ? d.strong >= perim * 0.5 : null;
    stops.push({ i, ...info, diff: d, perim: Math.round(perim), visibleRing });
    console.log(`${label} ${String(i).padStart(2)} ${info.sel.slice(-70).padEnd(70)} «${info.text.slice(0, 16)}» view:${info.inView ? (info.fully ? 'full' : 'part') : 'OFF'} top:${info.top === 'self' ? 'self' : 'COVER ' + info.top} fv:${info.focusVisible} ring:${visibleRing} ${d ? JSON.stringify(d) : ''} perim ${Math.round(perim)} | ${info.outline}`);
  }
  return stops;
}

(async () => {
  const b = await L.launch();
  const result = { vp };
  try {
    const { page } = await L.open(b, vp, { reducedMotion: 'reduce' });
    await L.inject(page);
    await page.evaluate(() => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); });
    result.first = await tabPass(page, 'first', MAX);
    // join panel: open with the keyboard from the hero button (Enter), as a keyboard user would
    await page.evaluate(() => document.querySelector('#join').focus());
    await page.keyboard.press('Enter');
    await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 20000 });
    await sleep(900);
    await L.inject(page);
    result.afterOpen = await describe(page);
    console.log('after opening join panel, focus is on', JSON.stringify(result.afterOpen).slice(0, 300));
    result.join = await tabPass(page, 'join', MAX + 10);
  } catch (e) { console.log('FATAL', e.message.split('\n').slice(0, 3).join(' | ')); }
  finally { fs.writeFileSync(path.join(L.ROOT, 'data', `keyboard-${vp}.json`), JSON.stringify(result, null, 1)); await b.close(); }
})();
