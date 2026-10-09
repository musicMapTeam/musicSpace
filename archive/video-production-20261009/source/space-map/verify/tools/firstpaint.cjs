// What a first visit sees while the page loads: frames at fixed times after navigation.
const { launch, open, ORIGIN, mkdir } = require('./lib.cjs');
const OUT = mkdir('/tmp/space-map/shots/verify/firstpaint');
(async () => {
  const browser = await launch();
  for (const [kind, path] of [['phone', '#/explore'], ['desktop', '']]) {
    const { ctx, page } = await open(browser, kind);
    const t0 = Date.now();
    page.goto(ORIGIN + '/musicSpace/music-map/' + path, { waitUntil: 'commit' }).catch(() => {});
    await page.waitForSelector('#app', { timeout: 15000 }).catch(() => {});
    for (const at of [150, 400, 800, 1500, 3000]) {
      const wait = at - (Date.now() - t0); if (wait > 0) await page.waitForTimeout(wait);
      await page.screenshot({ path: `${OUT}/${kind}-${String(at).padStart(4, '0')}ms.png` });
    }
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
