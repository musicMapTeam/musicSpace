// Quick screenshots of a few states: home, round (shop), records. KIND list via args (phone,desktop).
const { launch, MAP, mkdir, VIEWPORTS } = require('./lib.cjs');
const OUT = mkdir(process.env.OUT || '/tmp/space-map/shots/fix/quick');
(async () => {
  const browser = await launch();
  for (const kind of (process.argv.slice(2).length ? process.argv.slice(2) : ['desktop', 'phone'])) {
    const ctx = await browser.newContext({ ...VIEWPORTS[kind] });
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(String(e).slice(0, 200))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
    await page.goto(MAP, { waitUntil: 'load' }); await page.waitForTimeout(3500);
    await page.screenshot({ path: `${OUT}/${kind}-home.png` });
    await page.locator('[data-home="round"]').click(); await page.waitForTimeout(3500);
    await page.screenshot({ path: `${OUT}/${kind}-round.png` });
    await page.locator('.world-compass [data-world-view="records"], .mobile-nav [data-nav="records"]').filter({ visible: true }).first().click(); await page.waitForTimeout(3200);
    await page.screenshot({ path: `${OUT}/${kind}-records.png` });
    console.log(kind, 'errors', JSON.stringify(errs));
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
