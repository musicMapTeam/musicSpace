// 寻声 on a phone: take a hint (toast), open 目录 right away: the toast must be gone.
const { launch, MAP, VIEWPORTS, mkdir } = require('./lib.cjs');
const OUT = mkdir('/tmp/space-map/shots/fix/toastmenu');
(async () => {
  const browser = await launch();
  for (const kind of ['phone', 'w320']) {
    const ctx = await browser.newContext({ ...VIEWPORTS[kind] }); const page = await ctx.newPage();
    await page.goto(MAP + '#/explore', { waitUntil: 'load' }); await page.waitForTimeout(3500);
    await page.locator('[data-map-action="flip"]').first().tap(); await page.waitForTimeout(700);
    await page.locator('.map-round-card [data-map-action="move"]').first().tap(); await page.waitForTimeout(2500);
    await page.locator('[data-map-action="hint"]').filter({ visible: true }).first().tap(); await page.waitForTimeout(500);
    const before = await page.evaluate(() => document.querySelector('#toast').classList.contains('visible') && document.querySelector('#toast').innerText);
    await page.locator('.map-shop-menu > summary').filter({ visible: true }).first().tap(); await page.waitForTimeout(400);
    const after = await page.evaluate(() => ({ visible: document.querySelector('#toast').classList.contains('visible'), opacity: getComputedStyle(document.querySelector('#toast')).opacity, menu: document.querySelector('.map-shop-menu').open }));
    console.log(kind, 'toast before menu:', JSON.stringify(before), '| after opening 目录:', JSON.stringify(after));
    await page.waitForTimeout(400); await page.screenshot({ path: `${OUT}/${kind}-menu.png` });
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
