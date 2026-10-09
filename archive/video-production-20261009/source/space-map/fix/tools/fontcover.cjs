// Font coverage of the long tail: every open-catalogue row expanded, every song's 来源 and credits expanded (all 37), About.
const { launch, open, audit, ORIGIN, MAP } = require('./lib.cjs');
(async () => {
  const browser = await launch();
  const { ctx, page, rec } = await open(browser, 'desktop');
  const agg = {};
  const add = a => { for (const [k, v] of Object.entries(a.sysFallback)) for (const ch of v) (agg['SYS ' + k] ||= new Set()).add(ch); for (const [k, v] of Object.entries(a.firstMiss)) for (const ch of v) (agg[k] ||= new Set()).add(ch); for (const [k, v] of Object.entries(a.notLoaded)) for (const ch of v) (agg['NOTLOADED ' + k] ||= new Set()).add(ch); };
  await page.goto(MAP, { waitUntil: 'load' }); await page.waitForSelector('#sakura-world canvas'); await page.waitForTimeout(3000);
  await page.locator('.home-paper__foot [data-open-catalogue]').click(); await page.waitForSelector('dialog.open-catalogue[open]');
  await page.evaluate(() => document.querySelectorAll('dialog.open-catalogue details').forEach(d => { d.open = true; }));
  await page.waitForTimeout(1500); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(800);
  add(await audit(page));
  await page.locator('dialog.open-catalogue [data-crate-close]').click();
  await page.click('#demo-help'); await page.waitForTimeout(1200); add(await audit(page)); await page.click('#close-about');
  await page.click('[data-home-start="real-jay"]'); await page.waitForTimeout(3500);
  const names = await page.$$eval('.world-music-label', els => els.filter(e => !e.hidden).map(e => e.querySelector('strong').textContent));
  for (const name of names) {
    const tag = page.locator('.world-music-label', { has: page.locator('strong', { hasText: new RegExp(`^${name}$`) }) }).first();
    await tag.click({ timeout: 5000 }).catch(async () => { await tag.evaluate(el => el.click()); });
    await page.waitForTimeout(300);
    await page.click('.map-shop-menu > summary'); await page.waitForTimeout(200);
    await page.locator('.map-shop-menu [data-map-action="relations"]').click(); await page.waitForSelector('dialog[open]');
    await page.evaluate(() => document.querySelectorAll('dialog[open] details').forEach(d => { d.open = true; }));
    await page.waitForTimeout(700); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(300);
    add(await audit(page));
    await page.click('dialog[open] [data-map-action="close"]'); await page.waitForTimeout(200);
  }
  for (const [k, v] of Object.entries(agg)) console.log(k, [...v].join(''));
  console.log('errors', JSON.stringify({ c: rec.console, p: rec.pageerrors, f: rec.failed }));
  await ctx.close(); await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
