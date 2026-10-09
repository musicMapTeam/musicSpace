const L = require('./lib.cjs');
L.watchdog(200);
(async () => {
  const b = await L.launch();
  for (const block of [true, false]) {
    for (const vp of ['desktop', 'd1100', 'd1920']) {
      const ctx = await b.newContext({ ...L.VP[vp] });
      if (block) await ctx.route(/fonts\/doodle\/display-/, r => r.abort());
      const page = await ctx.newPage();
      await page.goto(L.URL, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
      await page.evaluate(() => document.fonts.ready); await L.sleep(800);
      console.log(block ? 'fallback' : 'doodle  ', vp, JSON.stringify(await page.evaluate(() => { const h = document.querySelector('.desktop-caption h2'); const r = h.getBoundingClientRect(); return { h2: [Math.round(r.width), Math.round(r.height)], lines: [...h.querySelectorAll('.caption-line')].map(l => { const q = l.getBoundingClientRect(); return [Math.round(l.scrollWidth), Math.round(q.height), getComputedStyle(l).fontSize]; }), aside: Math.round(document.querySelector('.desktop-caption').getBoundingClientRect().width) }; })));
      if (vp === 'desktop' && block) await page.screenshot({ path: '/tmp/space-doodle/fix/shell/v3-caption-fallback-desktop.png', clip: { x: 0, y: 250, width: 480, height: 420 } });
      await ctx.close();
    }
  }
  await b.close();
})();
