const { launch, open, ORIGIN } = require('./lib.cjs');
(async () => {
  const browser = await launch();
  for (const kind of ['phone', 'desktop']) {
    const { ctx, page } = await open(browser, kind);
    await page.goto(ORIGIN + '/musicSpace/music-map/', { waitUntil: 'load' }); await page.waitForTimeout(3000);
    await page.locator('.home-paper__foot [data-open-catalogue]').click(); await page.waitForSelector('dialog.open-catalogue[open]');
    await page.locator('dialog[open] [data-about-sources]').click(); await page.waitForSelector('#about-dialog[open]'); await page.waitForTimeout(800);
    const r = await page.evaluate(() => { const top = document.querySelector('#about-dialog .about-top').getBoundingClientRect(); const h = document.querySelector('#about-sources-title').getBoundingClientRect(); const first = document.querySelector('#about-sources li b').getBoundingClientRect(); const st = getComputedStyle(document.querySelector('#about-dialog .about-top')).position; return { topBarBottom: Math.round(top.bottom), headingTop: Math.round(h.top), headingBottom: Math.round(h.bottom), firstLabelTop: Math.round(first.top), topBarPosition: st, focused: document.activeElement.id }; });
    console.log(kind, JSON.stringify(r), r.headingBottom <= r.topBarBottom ? 'HEADING HIDDEN under the sticky title bar' : 'heading visible');
    await page.screenshot({ path: `/tmp/space-map/shots/verify/details/about-sources-${kind}.png` });
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
