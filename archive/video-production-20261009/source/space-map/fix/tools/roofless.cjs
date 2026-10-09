// Records view on phones with the roof hidden (as the explore view does): screenshot only. Needs TEMP-DEBUG.
const { launch, MAP, mkdir } = require('./lib.cjs');
const OUT = mkdir(process.env.OUT || '/tmp/space-map/shots/fix/roofless');
const sizes = (process.argv.slice(2).length ? process.argv.slice(2) : ['390x844', '360x740', '320x568', '430x932']).map(s => s.split('x').map(Number));
(async () => {
  const browser = await launch();
  for (const [w, h] of sizes) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w > 760 && w > h ? 1 : 2, isMobile: !(w > 760 && w > h), hasTouch: !(w > 760 && w > h) });
    const page = await ctx.newPage();
    await page.goto(MAP + '#/records', { waitUntil: 'load' });
    await page.waitForFunction(() => globalThis.__mapDebug, null, { timeout: 20000 });
    await page.waitForTimeout(2500);
    await page.evaluate(() => { const d = globalThis.__mapDebug; d.model.roof.visible = false; d.requestDraw(); });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/${w}x${h}.png` });
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
