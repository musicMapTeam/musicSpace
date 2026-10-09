// Text contrast against the nearest solid ancestor background (UI papers only; text over the canvas is skipped).
const { launch, open, ORIGIN } = require('./lib.cjs');
const check = page => page.evaluate(() => {
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
  const blend = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
  const out = [];
  const modal = [...document.querySelectorAll('dialog[open]')].pop();
  const scope = modal || document.body;
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  const done = new Set(); let n;
  while ((n = walker.nextNode())) {
    const el = n.parentElement; if (!el || done.has(el) || !n.nodeValue.trim()) continue; done.add(el);
    if (!el.checkVisibility({ visibilityProperty: true, opacityProperty: true }) || el.closest('.sr-only,[aria-hidden="true"]')) continue;
    const r = el.getBoundingClientRect(); if (!r.width || r.bottom < 0 || r.top > innerHeight) continue;
    const s = getComputedStyle(el); let fg = parse(s.color); if (!fg) continue;
    // nearest solid background
    let bg = null; const stack = [];
    for (let a = el; a; a = a.parentElement) { const c = parse(getComputedStyle(a).backgroundColor); if (c && c.a > 0) { stack.push(c); if (c.a >= .99) { bg = c; break; } } if (a.id === 'sakura-world' || a.classList?.contains('world-music-label')) break; }
    if (!bg) continue;
    let base = bg; for (let i = stack.length - 2; i >= 0; i--) base = blend(stack[i], base);
    if (fg.a < 1) fg = blend(fg, base);
    const op = Number(s.opacity); const size = parseFloat(s.fontSize); const bold = Number(s.fontWeight) >= 700;
    const large = size >= 24 || (bold && size >= 18.66);
    const cr = ratio(fg, base);
    if (cr < (large ? 3 : 4.5)) out.push(`${cr.toFixed(2)} ${size}px "${n.nodeValue.trim().slice(0, 24)}" <${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}> fg ${s.color} bg rgb(${Math.round(base.r)},${Math.round(base.g)},${Math.round(base.b)})`);
  }
  return out;
});
(async () => {
  const browser = await launch();
  const { ctx, page } = await open(browser, 'phone');
  const tap = async sel => { const l = page.locator(sel).filter({ visible: true }).first(); await l.waitFor({ state: 'visible', timeout: 10000 }); await l.tap(); };
  const rep = async name => { await page.waitForTimeout(900); const r = await check(page); console.log(name, r.length ? '\n   ' + [...new Set(r)].join('\n   ') : 'ok'); };
  await page.goto(ORIGIN + '/musicSpace/music-map/', { waitUntil: 'load' }); await page.waitForTimeout(3500);
  await rep('home');
  await tap('[data-home="round"]'); await page.waitForTimeout(3000); await rep('round');
  await tap('[data-map-action="flip"]'); await rep('flip');
  await tap('.map-round-card [data-map-action="edge"]'); await page.waitForSelector('dialog[open]'); await rep('sources-paper');
  await tap('dialog[open] [data-map-action="close"]');
  await tap('.map-shop-menu > summary'); await rep('menu');
  await tap('.map-shop-menu [data-map-action="reveal"]'); await tap('dialog[open] [data-map-action="reveal-confirm"]'); await page.waitForTimeout(2500); await rep('setlist');
  await tap('dialog[open] [data-map-action="close"]'); await rep('closed-bar');
  await tap('[data-nav="records"]:not(.brand)'); await page.waitForTimeout(2500); await rep('records');
  await tap('#demo-help'); await rep('about');
  await tap('#close-about'); await tap('[data-nav="home"]:not(.brand)'); await page.waitForTimeout(2000);
  await tap('.home-paper__foot [data-open-catalogue]'); await rep('catalogue');
  await ctx.close(); await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
