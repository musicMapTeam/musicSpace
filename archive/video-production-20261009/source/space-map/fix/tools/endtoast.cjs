// An ended roam: tapping a singer next to you says how to walk on, naming the resume button as printed.
const { launch, MAP, VIEWPORTS } = require('./lib.cjs');
(async () => {
  const browser = await launch();
  for (const kind of ['desktop', 'w320']) {
    const ctx = await browser.newContext({ ...VIEWPORTS[kind] }); const page = await ctx.newPage();
    const touch = kind !== 'desktop';
    const tap = async l => { if (touch) await l.tap(); else await l.click(); };
    await page.goto(MAP, { waitUntil: 'load' }); await page.waitForTimeout(3000);
    await tap(page.locator('[data-home-start="real-jj"]')); await page.waitForTimeout(3500);
    await tap(page.locator('[data-map-action="finish"]').filter({ visible: true }).first()); await page.waitForTimeout(1200);
    const close = page.locator('dialog[open] [data-map-action="close"]').filter({ visible: true }).first();
    if (await close.count()) { await tap(close); await page.waitForTimeout(1200); }
    const label = await page.evaluate(() => document.querySelector('.map-roam-bar__resume')?.innerText.replace(/\s+/g, ''));
    let toast = '';
    const tags = page.locator('.world-music-label--node:not([hidden]):not(.is-current)');
    for (let i = 0; i < Math.min(await tags.count(), 8) && !toast.includes('已结束'); i++) {
      await tags.nth(i).click({ force: true }).catch(() => {}); await page.waitForTimeout(600);
      toast = await page.evaluate(() => document.querySelector('#toast.visible')?.innerText || '');
    }
    console.log(kind, 'resume label:', label, '| toast:', toast);
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
