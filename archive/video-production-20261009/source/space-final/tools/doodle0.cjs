// ?doodle=0 on the built 音乐探索 page: the classic renderer on paper, no console problems.
const { launch, open, outside } = require('./lib.cjs');
const BASE = process.env.ORIGIN + '/musicSpace/music-map/';
(async () => {
  const browser = await launch();
  for (const kind of ['desktop', 'phone']) {
    for (const query of ['', '?doodle=0', '?doodle=classic']) {
      const { ctx, page, rec } = await open(browser, kind);
      await page.goto(BASE + query + '#/explore', { waitUntil: 'load' });
      await page.waitForSelector('#sakura-world canvas', { timeout: 30000 });
      await page.waitForTimeout(4000);
      const style = await page.evaluate(() => document.querySelector('[data-render-style]')?.dataset.renderStyle || null);
      const stored = await page.evaluate(() => Object.keys(sessionStorage).filter(k => /doodle/i.test(k)));
      await page.screenshot({ path: `/tmp/space-final/shots/doodle-check-${kind}${query.replace(/[?=]/g, '-')}.png` });
      console.log(kind, query || '(none)', 'renderStyle=' + style, 'doodleKeysInSession=' + JSON.stringify(stored), 'console=' + JSON.stringify(rec.console), 'pageerrors=' + JSON.stringify(rec.pageerrors), 'failed=' + JSON.stringify(rec.failed), 'outside=' + JSON.stringify(outside(rec)));
      await ctx.close();
    }
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
