// Reduced motion (no boil), 320px overflow, tag hit bands >= 44px, console errors: base vs doodle prototype.
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const crypto = require('crypto');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const T = { base: 'http://127.0.0.1:5291/music-map/', doodle: 'http://127.0.0.1:5292/music-map/' };
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--enable-gpu'] });
  for (const [name, url] of Object.entries(T)) {
    // 1. line boil: canvas hashes 330 ms apart, normal vs reduced motion (home, desktop)
    for (const reducedMotion of ['no-preference', 'reduce']) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion }); const page = await ctx.newPage();
      await page.goto(url + '#/home'); await page.waitForFunction(() => window.__MAP_PROTO__); await sleep(2500);
      const hashes = [];
      for (let i = 0; i < 4; i++) { const buf = await page.locator('canvas.sakura-scene__canvas').screenshot(); hashes.push(crypto.createHash('md5').update(buf).digest('hex').slice(0, 6)); await sleep(330); }
      console.log(name, 'motion', reducedMotion, hashes.join(' '), 'distinct=' + new Set(hashes).size);
      await ctx.close();
    }
    // 2 + 3. 320 px phone: overflow and the tags' touch bands in the record shop
    for (const [vp, opts] of [['320', { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }], ['390', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
      const ctx = await browser.newContext(opts); const page = await ctx.newPage(); const errs = [];
      page.on('pageerror', e => errs.push(String(e).slice(0, 120))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 120)); });
      for (const view of ['home', 'explore', 'records']) {
        await page.goto(url + '#/' + view); await page.waitForFunction(() => window.__MAP_PROTO__); await sleep(2500);
        const r = await page.evaluate(() => {
          const over = document.documentElement.scrollWidth - innerWidth;
          const tags = [...document.querySelectorAll('.world-music-label:not([hidden]),.world-music-link:not([hidden]),.world-pin:not([hidden])')];
          const small = tags.map(t => { const hit = t.querySelector('.world-music-hit') || t; const b = hit.getBoundingClientRect(); const o = t.getBoundingClientRect(); return { w: Math.max(b.width, o.width), h: Math.max(b.height, o.height) }; }).filter(b => b.h < 43.5 || b.w < 43.5).length;
          const outside = tags.filter(t => { const b = t.getBoundingClientRect(); return b.left < 0 || b.right > innerWidth; }).length;
          return { over, tags: tags.length, small, outside };
        });
        console.log(name, vp, view, JSON.stringify(r));
      }
      console.log(name, vp, 'errors:', errs.length ? errs.join(' | ') : 'none');
      await ctx.close();
    }
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
