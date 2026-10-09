// probe-overview: where are the name tags vs the presence/tour card on desktop right after joining (4 members) — and at 1280x800.
const L = require('./lib.cjs');
L.watchdog(150);
(async () => {
  const b = await L.launch();
  for (const vp of [{ w: 1440, h: 900 }, { w: 1280, h: 800 }, { w: 1920, h: 1080 }]) {
    const ctx = await b.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await ctx.newPage();
    await page.goto(L.URL, { waitUntil: 'domcontentloaded' });
    await L.ready(page);
    await L.enter(page);
    await L.sleep(1500);
    const m = await page.evaluate(() => {
      const r = el => { const b = el.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; };
      const card = document.querySelector('.presence');
      const tags = [...document.querySelectorAll('#hotspots .hotspot')].map(h => ({ t: h.textContent.trim(), hidden: h.hidden, r: r(h) }));
      return { card: r(card), members: (window.__SPACE_EVENT_QA__?.()?.members || []).length, tags };
    });
    console.log(vp.w + 'x' + vp.h, JSON.stringify(m));
    await page.screenshot({ path: `${L.OUT}/e-overview-${vp.w}x${vp.h}.png` });
    await ctx.close();
  }
  await b.close();
})();
