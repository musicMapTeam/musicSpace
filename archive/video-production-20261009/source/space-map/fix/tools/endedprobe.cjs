// The roam bar after 结束探索 (已结束 · 回顾 · 继续本次探索) across widths: overflow inside the buttons.
const { launch, MAP } = require('./lib.cjs');
const sizes = (process.argv.slice(2).length ? process.argv.slice(2) : ['320x568', '360x740', '375x667', '390x844', '430x932', '768x1024', '820x1180', '1024x768', '1440x900']).map(s => s.split('x').map(Number));
(async () => {
  const browser = await launch();
  for (const [w, h] of sizes) {
    const touch = h > w;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: touch ? 2 : 1, isMobile: touch, hasTouch: touch });
    const page = await ctx.newPage();
    const tap = async l => { if (touch) await l.tap(); else await l.click(); };
    await page.goto(MAP, { waitUntil: 'load' }); await page.waitForTimeout(2500);
    await tap(page.locator('[data-home-start="real-jay"]')); await page.waitForTimeout(3000);
    await page.evaluate(() => document.fonts.ready);
    const active = await page.evaluate(() => [...document.querySelector('.map-roam-bar').children].filter(e => e.checkVisibility()).map(e => `${e.innerText.replace(/\s+/g, '')}${e.scrollWidth > e.clientWidth + 1 ? ` CLIPPED ${e.scrollWidth}/${e.clientWidth}` : ''}`).join(' | '));
    await tap(page.locator('[data-map-action="finish"]').filter({ visible: true }).first()); await page.waitForTimeout(1200);
    const close = page.locator('dialog[open] [data-map-action="close"]').filter({ visible: true }).first();
    if (await close.count()) { await tap(close); await page.waitForTimeout(1000); }
    await page.evaluate(() => document.fonts.ready);
    const ended = await page.evaluate(() => { const bar = document.querySelector('.map-roam-bar'); const bb = bar.getBoundingClientRect(); return [...bar.children].filter(e => e.checkVisibility()).map(e => { const b = e.getBoundingClientRect(); return `${e.innerText.replace(/\s+/g, '')}${e.scrollWidth > e.clientWidth + 1 ? ` CLIPPED ${e.scrollWidth}/${e.clientWidth}` : ''}${b.right > bb.right + 1 ? ' OUT' : ''}`; }).join(' | '); });
    console.log(`${w}x${h}`, 'active:', active, '|| ended:', ended);
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
