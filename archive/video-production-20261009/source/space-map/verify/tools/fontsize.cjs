// Smallest text on phone screens: anything under 12px, and body-ish runs (Hand font) under 14px.
const { launch, open, ORIGIN } = require('./lib.cjs');
const scan = page => page.evaluate(() => {
  const out = new Map();
  const modal = [...document.querySelectorAll('dialog[open]')].pop(); const scope = modal || document.body;
  const w = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) {
    const el = n.parentElement; if (!el || !n.nodeValue.trim() || el.closest('.sr-only,[aria-hidden="true"],script,style')) continue;
    if (!el.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
    const r = el.getBoundingClientRect(); if (!r.width || r.bottom < 0 || r.top > innerHeight) continue;
    const s = getComputedStyle(el); const px = parseFloat(s.fontSize); const fam = s.fontFamily.split(',')[0].replace(/"/g, '');
    if (px < 12 || (fam === 'Doodle Hand' && px < 14)) out.set(`${px}px ${fam} "${n.nodeValue.trim().slice(0, 18)}" <${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}>`, 1);
  }
  return [...out.keys()];
});
(async () => {
  const browser = await launch();
  const { ctx, page } = await open(browser, 'phone');
  const tap = async sel => { const l = page.locator(sel).filter({ visible: true }).first(); await l.waitFor({ state: 'visible', timeout: 10000 }); await l.tap(); };
  const rep = async name => { await page.waitForTimeout(900); const r = await scan(page); console.log(name, r.length ? '\n   ' + r.join('\n   ') : 'ok'); };
  await page.goto(ORIGIN + '/musicSpace/music-map/', { waitUntil: 'load' }); await page.waitForTimeout(3500); await rep('home');
  await tap('[data-home-start="real-jj"]'); await page.waitForTimeout(3500); await rep('atlas');
  await tap('.map-network-index > summary'); await tap('.map-network-connection'); await page.waitForSelector('dialog[open]'); await tap('dialog[open] details.map-sources > summary'); await rep('duet+sources');
  await tap('dialog[open] [data-map-action="close"]');
  await page.goto(ORIGIN + '/musicSpace/music-map/', { waitUntil: 'load' }); await page.waitForTimeout(2500); await tap('[data-home="round"]'); await page.waitForTimeout(3500); await rep('round');
  await tap('[data-map-action="flip"]'); await rep('flip');
  await tap('.map-shop-menu > summary'); await tap('.map-shop-menu [data-map-action="reveal"]'); await tap('dialog[open] [data-map-action="reveal-confirm"]'); await page.waitForTimeout(2500); await rep('setlist');
  await tap('dialog[open] [data-map-action="close"]'); await tap('[data-nav="records"]:not(.brand)'); await page.waitForTimeout(2500); await rep('records');
  await ctx.close(); await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
