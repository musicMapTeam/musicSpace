// The two storage states: a write the browser refuses, and another tab changing the record.
const { launch, open, audit, ORIGIN, mkdir } = require('./lib.cjs');
const OUT = mkdir('/tmp/space-map/shots/verify/storage');
(async () => {
  const browser = await launch();
  const { ctx, page, rec } = await open(browser, 'phone');
  const tap = async (p, sel) => { const l = p.locator(sel).filter({ visible: true }).first(); await l.waitFor({ state: 'visible', timeout: 10000 }); await l.tap(); };
  // 1. refused write
  await page.goto(ORIGIN + '/musicSpace/music-map/#/explore', { waitUntil: 'load' }); await page.waitForTimeout(4000);
  await page.evaluate(() => { const orig = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (String(k).includes('exploration')) throw new DOMException('quota', 'QuotaExceededError'); return orig.call(this, k, v); }; });
  await tap(page, '[data-map-action="flip"]'); await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/refused.png` });
  let a = await audit(page); console.log('refused:', (await page.evaluate(() => document.querySelector('#storage-warning:not([hidden])')?.innerText || 'no warning')).replace(/\s+/g, ' '), a.small.length ? 'SMALL ' + a.small.join(' | ') : '', a.over.length ? 'OVER ' + a.over.join(' | ') : '');
  // 2. conflict: a second tab writes
  const p2 = await ctx.newPage();
  const page1 = await ctx.newPage();
  await page1.goto(ORIGIN + '/musicSpace/music-map/#/explore', { waitUntil: 'load' }); await page1.waitForTimeout(3500);
  await p2.goto(ORIGIN + '/musicSpace/music-map/#/explore', { waitUntil: 'load' }); await p2.waitForTimeout(3500);
  await p2.locator('[data-map-action="flip"]').first().tap(); await p2.waitForTimeout(800);
  await page1.bringToFront(); await page1.evaluate(() => window.dispatchEvent(new Event('focus'))); await page1.waitForTimeout(1200);
  await page1.screenshot({ path: `${OUT}/conflict.png` });
  a = await audit(page1); console.log('conflict:', a.text.replace(/\s+/g, ' ').slice(0, 300), a.small.length ? 'SMALL ' + a.small.join(' | ') : '', a.over.length ? 'OVER ' + a.over.join(' | ') : '');
  console.log('errors', JSON.stringify({ c: rec.console, p: rec.pageerrors }));
  await ctx.close(); await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
