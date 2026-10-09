const { launch, open, audit, mkdir } = require('./lib.cjs');
const ORIGIN = 'http://127.0.0.1:5644';
const OUT = mkdir('/tmp/space-map/shots/fix/node');
(async () => {
  const browser = await launch();
  for (const kind of ['phone', 'desktop']) {
    const { ctx, page, rec } = await open(browser, kind);
    await page.goto(ORIGIN + '/music-map/', { waitUntil: 'load' });
    await page.waitForSelector('#sakura-world canvas'); await page.waitForTimeout(4500);
    const a = await audit(page);
    await page.screenshot({ path: `${OUT}/${kind}-home.png` });
    await page.goto(ORIGIN + '/music-map/#/explore', { waitUntil: 'load' }); await page.waitForTimeout(4500);
    const b = await audit(page);
    await page.screenshot({ path: `${OUT}/${kind}-explore.png` });
    const fonts = [...new Set(rec.requests.filter(u => u.includes('fonts')).map(u => u.replace(ORIGIN, '')))];
    console.log(kind, 'style', a.renderStyle, b.renderStyle, 'fontStatus', JSON.stringify(b.fontStatus), 'sys', JSON.stringify(a.sysFallback), JSON.stringify(b.sysFallback), 'notLoaded', JSON.stringify(b.notLoaded));
    console.log('  fonts requested', fonts.join(' '));
    console.log('  errors', JSON.stringify({ c: rec.console, p: rec.pageerrors, f: rec.failed, b: rec.bad }));
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
