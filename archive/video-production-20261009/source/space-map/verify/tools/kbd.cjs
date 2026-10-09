const { launch, open, audit, ORIGIN, mkdir } = require('./lib.cjs');
const OUT = mkdir('/tmp/space-map/shots/verify/kbd');
(async () => {
  const browser = await launch();
  const { ctx, page, rec } = await open(browser, 'desktop');
  await page.goto(ORIGIN + '/musicSpace/music-map/', { waitUntil: 'load' }); await page.waitForSelector('#sakura-world canvas'); await page.waitForTimeout(3500);
  await page.click('[data-home-start="real-jj"]'); await page.waitForTimeout(3500);
  await page.click('.map-network-index > summary'); await page.click('.map-network-connection'); await page.waitForSelector('dialog[open]'); await page.waitForTimeout(600);
  // Tab until the 来源 summary has focus
  let found = false;
  for (let i = 0; i < 25; i++) { await page.keyboard.press('Tab'); const f = await page.evaluate(() => { const a = document.activeElement; return a?.tagName === 'SUMMARY' && a.parentElement.classList.contains('map-sources') ? a.textContent : null; }); if (f) { found = f; break; } }
  console.log('focus reached 来源 summary:', found);
  const state = () => page.evaluate(() => document.querySelector('dialog[open] details.map-sources').open);
  await page.keyboard.press('Enter'); console.log('after Enter open=', await state());
  await page.screenshot({ path: `${OUT}/sources-kbd-open.png` });
  await page.keyboard.press('Tab'); console.log('next focus', await page.evaluate(() => `${document.activeElement.tagName} ${document.activeElement.textContent.trim().slice(0, 40)}`));
  await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Space'); console.log('after Space open=', await state());
  // focus ring visible?
  const ring = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`; });
  console.log('focus outline', ring);
  // save, then 留下的歌 row → 来源
  await page.click('dialog[open] [data-map-action="save"]'); await page.waitForTimeout(400);
  await page.click('dialog[open] [data-map-action="close"]'); await page.waitForTimeout(400);
  await page.click('.world-compass [data-world-view="records"]'); await page.waitForTimeout(2500);
  await page.click('[data-records-filter="music"]'); await page.waitForTimeout(600);
  const rowSummary = page.locator('.saved-music .open-catalogue__record > details > summary').first();
  const marker = await rowSummary.evaluate(el => { const s = getComputedStyle(el); const m = getComputedStyle(el, '::marker'); const a = getComputedStyle(el, '::after'); const b = getComputedStyle(el, '::before'); return { listStyle: s.listStyleType, display: s.display, marker: m.content, after: a.content, before: b.content, cursor: s.cursor }; });
  console.log('留下的歌 row summary affordance', JSON.stringify(marker));
  console.log('来源 visible before expanding row:', await page.locator('.saved-music details.map-sources > summary').first().isVisible());
  await rowSummary.click(); await page.waitForTimeout(400);
  console.log('来源 visible after expanding row:', await page.locator('.saved-music details.map-sources > summary').first().isVisible());
  await page.screenshot({ path: `${OUT}/saved-row-expanded.png` });
  console.log('errors', JSON.stringify({ c: rec.console, p: rec.pageerrors }));
  await ctx.close(); await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
