// 音乐探索 with ?doodle=0 / ?doodle=classic: renderer, the canvas label (no 樱下 text), session storage untouched, console clean.
const { launch, openContext, sleep } = require('./lib.cjs');
const BASE = process.argv[2] || 'http://127.0.0.1:4783/musicSpace/';
(async () => {
  const browser = await launch();
  for (const kind of ['phone', 'desktop']) for (const q of ['', '?doodle=0', '?doodle=classic']) {
    const { ctx, page, rec } = await openContext(browser, kind, BASE);
    await page.goto(BASE + 'music-map/' + q + '#/explore', { waitUntil: 'load' });
    await page.waitForSelector('#sakura-world canvas', { timeout: 30000 });
    await sleep(4000);
    const info = await page.evaluate(() => ({ style: document.querySelector('[data-render-style]')?.dataset.renderStyle || null, label: document.querySelector('#sakura-world canvas')?.getAttribute('aria-label'), session: Object.keys(sessionStorage), sakura: /樱下/.test(document.body.innerText + [...document.querySelectorAll('[aria-label]')].map(e => e.getAttribute('aria-label')).join(' ')) }));
    console.log(kind, q || '(none)', JSON.stringify(info), 'console', rec.console.length, 'errors', rec.pageErrors.length, 'failed', rec.failed.length, 'bad', rec.badStatus.length, 'third', rec.thirdParty.length);
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
