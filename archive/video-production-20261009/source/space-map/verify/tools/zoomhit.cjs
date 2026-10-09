const { launch, ORIGIN } = require('./lib.cjs');
(async () => {
  const browser = await launch();
  for (const [w, h, touch] of [[768, 1024, true], [900, 1100, false], [1024, 768, false], [1180, 820, false]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: touch, hasTouch: touch });
    const page = await ctx.newPage();
    await page.goto(ORIGIN + '/musicSpace/music-map/', { waitUntil: 'load' }); await page.waitForTimeout(2500);
    await page.locator('[data-home-start="real-jay"]').click(); await page.waitForTimeout(3500);
    const r = await page.evaluate(() => {
      const b = [...document.querySelectorAll('.map-network-tools [data-map-action="zoom-out"]')].find(e => e.checkVisibility());
      if (!b) return 'no zoom-out';
      const q = b.getBoundingClientRect(); const pts = [[q.left + 4, q.top + q.height / 2], [q.left + q.width / 2, q.top + q.height / 2], [q.right - 4, q.top + q.height / 2]];
      return `${Math.round(q.width)}x${Math.round(q.height)} hits: ` + pts.map(([x, y]) => { const t = document.elementFromPoint(x, y); return t === b || b.contains(t) ? 'self' : (t?.className?.toString().split(' ')[0] || t?.tagName); }).join(',');
    });
    console.log(`${w}x${h}`, r);
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
