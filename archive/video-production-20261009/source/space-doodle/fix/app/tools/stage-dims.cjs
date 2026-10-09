const L = require('/tmp/space-doodle/critique/art/tools/lib.cjs');
L.watchdog(200);
(async () => {
  const b = await L.launch();
  for (const [w, h] of [[1280, 800], [1440, 900], [1920, 1080]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await page.goto(L.URL, { waitUntil: 'domcontentloaded' });
    await L.ready(page);
    await L.enter(page);
    const r = await page.evaluate(() => { const s = document.querySelector('#world').getBoundingClientRect(); const c = window.__SPACE_EVENT_QA__?.()?.camera; return { stage: [s.left, s.top, s.width, s.height], fov: c?.fov, aspect: c?.aspect }; });
    console.log(w + 'x' + h, JSON.stringify(r));
    await ctx.close();
  }
  await b.close();
})();
