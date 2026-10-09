// Extra states: friend's puzzle link, dead-end/arrival path, credits sources expanded, 320px setlist.
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const BASE = 'http://127.0.0.1:4791/musicSpace/music-map/';
const OUT = '/tmp/space-map/shots/base';
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--enable-gpu'] });
  for (const [name, opts] of [['phone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }], ['desktop', { viewport: { width: 1440, height: 900 } }]]) {
    const c = await b.newContext(opts); const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 150)));
    const shot = async l => { await p.waitForTimeout(1000); await p.screenshot({ path: `${OUT}/${name}-x-${l}.png` }); console.log(name, l); };
    await p.goto(BASE + '?from=real-fei&to=real-gem#/explore', { waitUntil: 'load' }); await p.waitForTimeout(5000); await shot('friend-note');
    // walk 费玉清 → 周杰伦 → 林俊杰 → 邓紫棋 by song title
    const walk = async title => {
      const card = p.locator('.map-round-card', { hasText: title }).first();
      await card.scrollIntoViewIfNeeded().catch(() => {});
      const flip = card.locator('[data-map-action="flip"]');
      if (await flip.count()) { await flip.click(); await p.waitForTimeout(700); }
      const card2 = p.locator('.map-round-card', { hasText: title }).first();
      await card2.locator('[data-map-action="move"]').click(); await p.waitForTimeout(1200);
    };
    try {
      await walk('千里之外'); await walk('稻香'); await shot('mid-route');
      await walk('手心的蔷薇'); await shot('arrive-ceremony');
      const skip = p.locator('[data-map-action="ceremony-done"]'); if (await skip.count()) await skip.first().click().catch(() => {});
      await p.waitForSelector('.map-dialog--setlist', { timeout: 9000 }); await shot('arrive-setlist');
      await p.click('.map-dialog [data-map-action="credits"]'); await p.waitForTimeout(500);
      await p.evaluate(() => { document.querySelectorAll('.map-dialog details').forEach(d => d.open = true); const d = document.querySelector('.map-dialog'); if (d) d.scrollTop = d.scrollHeight; });
      await shot('credits-sources-open');
      await p.click('.map-dialog [data-map-action="close"]'); await p.waitForTimeout(400);
      await p.click('.map-round-hand--closed [data-map-action="save-card"]'); await p.waitForTimeout(2500); await shot('arrive-card');
    } catch (e) { console.log('FAIL', name, String(e).slice(0, 200)); }
    console.log(name, 'errors', errs);
    await c.close();
  }
  await b.close();
})();
