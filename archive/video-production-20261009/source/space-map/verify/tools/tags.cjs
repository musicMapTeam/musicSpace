// Scene name tags on the record table: painted size and touch size (tag ∪ its .world-music-hit band), per viewport and view.
const { launch, open, ORIGIN } = require('./lib.cjs');
(async () => {
  const browser = await launch();
  for (const kind of ['phone', 'w320', 'desktop']) {
    const { ctx, page } = await open(browser, kind);
    const measure = async label => {
      const r = await page.evaluate(() => [...document.querySelectorAll('.world-music-label,.world-music-link,.world-pin')].filter(b => !b.hidden && b.checkVisibility({ visibilityProperty: true, opacityProperty: true })).map(b => {
        const a = b.getBoundingClientRect(); const h = b.querySelector('.world-music-hit')?.getBoundingClientRect();
        const u = h ? { l: Math.min(a.left, h.left), r: Math.max(a.right, h.right), t: Math.min(a.top, h.top), b: Math.max(a.bottom, h.bottom) } : { l: a.left, r: a.right, t: a.top, b: a.bottom };
        return { name: (b.querySelector('strong')?.textContent || b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 8), cls: b.className.split(' ')[0], w: Math.round(u.r - u.l), h: Math.round(u.b - u.t), pw: Math.round(a.width), ph: Math.round(a.height) };
      }));
      const small = r.filter(x => x.w < 44 || x.h < 44);
      console.log(kind, label, `tags ${r.length}, touch <44: ${small.length}`, small.slice(0, 12).map(x => `${x.name}(${x.cls === 'world-music-label' ? '' : x.cls + ' '}${x.w}x${x.h}, painted ${x.pw}x${x.ph})`).join(' '));
    };
    await page.goto(ORIGIN + '/musicSpace/music-map/', { waitUntil: 'load' }); await page.waitForSelector('#sakura-world canvas'); await page.waitForTimeout(4000);
    await measure('home');
    await page.click('[data-home-start="real-jj"]'); await page.waitForTimeout(4000);
    await measure('atlas');
    await page.goto(ORIGIN + '/musicSpace/music-map/#/explore', { waitUntil: 'load' }); await page.waitForTimeout(1000);
    await page.click('.world-compass [data-world-view="home"], [data-nav="home"]:not(.brand) >> visible=true'); await page.waitForTimeout(2500);
    await page.click('[data-home="round"]'); await page.waitForTimeout(4000);
    await measure('round');
    await page.click('[data-map-action="flip"]'); await page.waitForTimeout(800); await page.click('.map-round-card [data-map-action="move"]'); await page.waitForTimeout(3000);
    await measure('round-step1');
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
