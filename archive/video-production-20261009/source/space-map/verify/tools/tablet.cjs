const { launch, audit, ORIGIN, mkdir } = require('./lib.cjs');
const OUT = mkdir('/tmp/space-map/shots/verify/tablet');
(async () => {
  const browser = await launch();
  for (const [name, vp] of [['768x1024', { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }], ['1024x768', { viewport: { width: 1024, height: 768 } }], ['1280x720', { viewport: { width: 1280, height: 720 } }]]) {
    const ctx = await browser.newContext(vp); const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    const snap = async s => { await page.waitForTimeout(1000); await page.screenshot({ path: `${OUT}/${name}-${s}.png` }); const a = await audit(page); console.log(name, s, a.small.length ? 'SMALL ' + a.small.join(' | ') : '', a.over.length ? 'OVER ' + a.over.join(' | ') : ''); };
    await page.goto(ORIGIN + '/musicSpace/music-map/', { waitUntil: 'load' }); await page.waitForTimeout(3500); await snap('home');
    await page.locator('[data-home="round"]').click(); await page.waitForTimeout(3500); await snap('round');
    await page.locator('[data-map-action="flip"]').first().click(); await page.waitForTimeout(800); await snap('flip');
    await page.goto(ORIGIN + '/musicSpace/music-map/', { waitUntil: 'load' }); await page.waitForTimeout(2500);
    await page.locator('[data-home-start="real-jay"]').click(); await page.waitForTimeout(3500); await snap('atlas');
    await page.locator('.world-compass [data-world-view="records"], .mobile-nav [data-nav="records"]').filter({ visible: true }).first().click(); await page.waitForTimeout(3000); await snap('records');
    console.log(name, 'errors', JSON.stringify(errs));
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
