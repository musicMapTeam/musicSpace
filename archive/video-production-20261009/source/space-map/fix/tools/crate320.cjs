// 320×568: the home paper's foot links step aside; 开放曲库 is reached from the shop's 目录, and its 数据来源 opens 关于.
const { launch, MAP, VIEWPORTS, audit } = require('./lib.cjs');
(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ ...VIEWPORTS.w320s }); const page = await ctx.newPage();
  await page.goto(MAP, { waitUntil: 'load' }); await page.waitForTimeout(3500);
  const foot = await page.evaluate(() => getComputedStyle(document.querySelector('.home-paper__foot')).display);
  await page.locator('[data-nav="explore"]:not(.brand)').filter({ visible: true }).first().tap(); await page.waitForTimeout(3500);
  await page.locator('.map-shop-menu > summary').filter({ visible: true }).first().tap(); await page.waitForTimeout(500);
  await page.locator('.map-shop-menu [data-open-catalogue]').filter({ visible: true }).first().tap(); await page.waitForSelector('dialog.open-catalogue[open]');
  await page.waitForTimeout(600);
  const a = await audit(page);
  await page.screenshot({ path: '/tmp/space-map/shots/fix/crate320.png' });
  await page.locator('dialog[open] [data-about-sources]').tap(); await page.waitForSelector('#about-dialog[open]'); await page.waitForTimeout(500);
  const r = await page.evaluate(() => ({ bar: Math.round(document.querySelector('#about-dialog .about-top').getBoundingClientRect().bottom), heading: Math.round(document.querySelector('#about-sources-title').getBoundingClientRect().top) }));
  console.log('foot display at 320x568:', foot, '| crate open via 目录, small:', a.small.length, 'over:', a.over.length, '| about bar bottom', r.bar, 'heading top', r.heading);
  await ctx.close(); await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
