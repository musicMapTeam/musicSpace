// The two PNG keepsakes: 战绩卡 (after a revealed round) and 发现卡片 (after a roam with a kept song). Saves the PNGs and the dialogs.
const { launch, open, audit, ORIGIN, mkdir, fs } = require('./lib.cjs');
const OUT = mkdir('/tmp/space-map/shots/verify/cards');
(async () => {
  const browser = await launch();
  const { ctx, page, rec } = await open(browser, 'phone');
  const tap = async sel => { const l = page.locator(sel).filter({ visible: true }).first(); await l.waitFor({ state: 'visible', timeout: 10000 }); await l.scrollIntoViewIfNeeded().catch(() => {}); await l.tap(); };
  const savePng = async name => {
    await page.waitForSelector('dialog.share-card-export[open] img[src]', { timeout: 15000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/${name}-dialog.png` });
    const b64 = await page.evaluate(async () => { const img = document.querySelector('dialog.share-card-export[open] img'); const r = await fetch(img.src); const buf = new Uint8Array(await r.arrayBuffer()); let s = ''; for (const x of buf) s += String.fromCharCode(x); return btoa(s); });
    fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(b64, 'base64'));
    const a = await audit(page); console.log(name, 'dialog text:', a.text.replace(/\s+/g, ' ').slice(0, 200), a.small.length ? 'SMALL ' + a.small.join(' | ') : '', a.hits.length ? 'WORDS ' + a.hits.join(' | ') : '');
    await tap('dialog.share-card-export [data-export-close]');
  };
  await page.goto(ORIGIN + '/musicSpace/music-map/#/explore', { waitUntil: 'load' });
  await page.waitForSelector('#sakura-world canvas'); await page.waitForTimeout(4000);
  await tap('[data-map-action="flip"]'); await page.waitForTimeout(700);
  await tap('.map-round-card [data-map-action="move"]'); await page.waitForTimeout(2000);
  await tap('.map-shop-menu > summary'); await tap('.map-shop-menu [data-map-action="reveal"]'); await tap('dialog[open] [data-map-action="reveal-confirm"]'); await page.waitForTimeout(3000);
  await tap('dialog[open] [data-map-action="save-card"]');
  await savePng('challenge');
  // roam with a kept song
  await page.goto(ORIGIN + '/musicSpace/music-map/', { waitUntil: 'load' }); await page.waitForTimeout(3000);
  await tap('[data-home-start="real-gem"]'); await page.waitForTimeout(3000);
  await tap('.map-network-index > summary'); await tap('.map-network-connection'); await page.waitForSelector('dialog[open]');
  await tap('dialog[open] [data-map-action="save"]'); await page.waitForTimeout(500);
  await tap('dialog[open] [data-map-action="move"]'); await page.waitForTimeout(2500);
  await tap('[data-map-action="recap"]'); await page.waitForSelector('dialog[open]');
  await tap('dialog[open] [data-map-action="save-discovery"]');
  await savePng('discovery');
  console.log('errors', JSON.stringify({ c: rec.console, p: rec.pageerrors, f: rec.failed, b: rec.bad }));
  await ctx.close(); await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
