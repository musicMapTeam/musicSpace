// Remaining papers: 自选起点和终点, 找音乐人, 出题给朋友 (fallback paper), a friend's link, 换一组.
const { launch, open, audit, outside, ORIGIN, mkdir } = require('./lib.cjs');
const OUT = mkdir('/tmp/space-map/shots/verify/extra');
(async () => {
  const browser = await launch();
  const { ctx, page, rec } = await open(browser, 'phone');
  const tap = async sel => { const l = page.locator(sel).filter({ visible: true }).first(); await l.waitFor({ state: 'visible', timeout: 10000 }); await l.scrollIntoViewIfNeeded().catch(() => {}); await l.tap(); };
  const snap = async name => { await page.waitForTimeout(900); await page.screenshot({ path: `${OUT}/${name}.png` }); const a = await audit(page); const toast = await page.evaluate(() => document.querySelector('#toast.visible')?.innerText || ''); console.log(name, 'modal=' + (a.modal || '-'), toast ? 'TOAST=' + toast : '', a.hits.length ? 'WORDS ' + a.hits.join(' | ').slice(0, 300) : '', a.small.length ? 'SMALL ' + a.small.join(' | ') : '', a.over.length ? 'OVER ' + a.over.join(' | ') : '', Object.keys(a.sysFallback).length ? 'SYS ' + JSON.stringify(a.sysFallback) : ''); return a; };
  await page.goto(ORIGIN + '/musicSpace/music-map/#/explore', { waitUntil: 'load' }); await page.waitForSelector('#sakura-world canvas'); await page.waitForTimeout(4000);
  await tap('[data-map-action="round-next"]'); await page.waitForTimeout(2500); await snap('round-next');
  await tap('.map-shop-menu > summary'); await tap('.map-shop-menu [data-map-action="challenge"]'); await page.waitForSelector('dialog[open]'); await snap('challenge-form');
  await page.selectOption('dialog[open] select[name="start"]', 'real-jolin'); await page.selectOption('dialog[open] select[name="target"]', 'real-jolin');
  await tap('dialog[open] button[value="play"]'); await snap('challenge-same');
  await page.selectOption('dialog[open] select[name="target"]', 'real-yichun'); await tap('dialog[open] button[value="share"]'); await page.waitForTimeout(800); await snap('share-paper');
  const link = await page.evaluate(() => document.querySelector('dialog[open] [data-map-share-link]')?.value || '');
  console.log('share link', link.replace(ORIGIN, ''));
  // a friend's link in a fresh context
  const f = await open(browser, 'phone');
  await f.page.goto(link || ORIGIN + '/musicSpace/music-map/?from=real-jolin&to=real-yichun#/explore', { waitUntil: 'load' }); await f.page.waitForTimeout(5000);
  await f.page.screenshot({ path: `${OUT}/friend-link.png` });
  const fa = await audit(f.page); console.log('friend link url', fa.url, 'text:', fa.text.replace(/\s+/g, ' ').slice(0, 260), fa.hits.length ? 'WORDS ' + fa.hits.join(' | ') : '');
  await f.ctx.close();
  // 找音乐人 (atlas)
  await page.goto(ORIGIN + '/musicSpace/music-map/', { waitUntil: 'load' }); await page.waitForTimeout(2500);
  await tap('[data-home-start="real-stefanie"]'); await page.waitForTimeout(3000);
  await tap('[data-map-action="search"]'); await page.waitForSelector('dialog[open]'); await page.fill('dialog[open] #map-artist-search', '五月'); await snap('search');
  await page.fill('dialog[open] #map-artist-search', 'zzz'); await snap('search-none');
  console.log('errors', JSON.stringify({ c: rec.console, p: rec.pageerrors, f: rec.failed, b: rec.bad, out: outside(rec) }));
  await ctx.close(); await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
