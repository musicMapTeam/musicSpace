// 留下的歌 on a phone and desktop: keep one duet, open the tab, screenshot the row.
const { launch, MAP, VIEWPORTS, mkdir } = require('./lib.cjs');
const OUT = mkdir('/tmp/space-map/shots/fix/savedrow');
(async () => {
  const browser = await launch();
  for (const kind of (process.argv.slice(2).length ? process.argv.slice(2) : ['phone', 'w320', 'desktop'])) {
    const ctx = await browser.newContext({ ...VIEWPORTS[kind] }); const page = await ctx.newPage();
    const touch = kind !== 'desktop'; const tap = async l => { if (touch) await l.tap(); else await l.click(); };
    await page.goto(MAP, { waitUntil: 'load' }); await page.waitForTimeout(2500);
    await tap(page.locator('[data-home-start="real-jj"]')); await page.waitForTimeout(3000);
    const idx = page.locator('.map-network-index > summary').filter({ visible: true }).first(); if (await idx.count()) await tap(idx);
    await tap(page.locator('.map-network-connection').first()); await page.waitForSelector('dialog[open]');
    await tap(page.locator('dialog[open] [data-map-action="save"]').first()); await page.waitForTimeout(400);
    await tap(page.locator('dialog[open] [data-map-action="close"]').first()); await page.waitForTimeout(400);
    await tap(page.locator('.world-compass [data-world-view="records"], .mobile-nav [data-nav="records"]').filter({ visible: true }).first()); await page.waitForTimeout(2500);
    await tap(page.locator('[data-records-filter="music"]')); await page.waitForTimeout(800);
    const r = await page.evaluate(() => { const l = document.querySelector('.music-row__listen'); const kids = [...l.children].map(e => { const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; }); return kids; });
    console.log(kind, JSON.stringify(r));
    await page.screenshot({ path: `${OUT}/${kind}.png` });
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
