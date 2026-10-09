const { launch, open, ORIGIN } = require('./lib.cjs');
(async () => {
  const browser = await launch();
  const { ctx, page } = await open(browser, 'phone');
  await page.goto(ORIGIN + '/musicSpace/music-map/', { waitUntil: 'load' }); await page.waitForTimeout(2500);
  await page.locator('#demo-help').tap(); await page.waitForTimeout(800);
  console.log('about links', JSON.stringify(await page.$$eval('#about-dialog a', as => as.map(a => { const r = a.getBoundingClientRect(); return `${a.textContent.trim()} ${Math.round(r.width)}x${Math.round(r.height)} ${getComputedStyle(a).display}`; }))));
  await page.locator('#close-about').tap();
  await page.locator('[data-home-start="real-jj"]').tap(); await page.waitForTimeout(3000);
  await page.locator('.map-network-index > summary').tap(); await page.locator('.map-network-connection').first().tap(); await page.waitForSelector('dialog[open]');
  await page.locator('dialog[open] details.map-sources > summary').tap(); await page.waitForTimeout(500);
  console.log('来源 links', JSON.stringify(await page.$$eval('dialog[open] .map-sources a', as => as.map(a => { const r = a.getBoundingClientRect(); return `${a.textContent.trim().slice(0, 16)} ${Math.round(r.width)}x${Math.round(r.height)} ${getComputedStyle(a).display}`; }))));
  console.log('来源 summary', JSON.stringify(await page.$eval('dialog[open] .map-sources > summary', s => { const r = s.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}`; })));
  await ctx.close(); await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
