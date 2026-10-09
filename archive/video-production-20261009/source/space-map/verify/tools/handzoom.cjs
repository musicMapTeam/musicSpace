// At 周杰伦 (10-card hand) in the default round: does the hand cover the zoom tools? Desktop sizes.
const { launch } = require('./lib.cjs');
const ORIGIN = process.env.ORIGIN || 'http://127.0.0.1:5633';
(async () => {
  const browser = await launch();
  for (const [w, h] of [[1440, 900], [1280, 720], [1366, 768], [1536, 864], [1920, 1080]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await page.goto(ORIGIN + '/musicSpace/music-map/#/explore', { waitUntil: 'load' }); await page.waitForTimeout(4000);
    await page.locator('[data-map-action="flip"]').first().click(); await page.waitForTimeout(800);
    await page.locator('.map-round-card [data-map-action="move"]').first().click(); await page.waitForTimeout(3000);
    const r = await page.evaluate(() => {
      const b = [...document.querySelectorAll('[data-map-action="zoom-out"]')].find(e => e.checkVisibility());
      if (!b) return 'no zoom-out visible';
      const q = b.getBoundingClientRect(); const pts = [[q.left + 4, q.top + q.height / 2], [q.left + q.width / 2, q.top + q.height / 2], [q.right - 4, q.top + q.height / 2]];
      return pts.map(([x, y]) => { const t = document.elementFromPoint(x, y); return t === b || b.contains(t) ? 'self' : (t?.className?.toString().split(' ')[0] || t?.tagName); }).join(',');
    });
    console.log(`${w}x${h}`, r);
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
