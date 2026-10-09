process.env.SPACE_URL = process.env.SPACE_URL || 'http://127.0.0.1:47391/musicSpace/';
const L = require('/tmp/space-doodle/critique/art/tools/lib.cjs');
L.watchdog(150);
(async () => {
  const b = await L.launch();
  for (const kind of ['desktop', 'phone']) {
    const { ctx, page } = await L.open(b, kind);
    await L.sleep(1500);
    const m = await page.evaluate(() => ({ stage: (() => { const r = document.querySelector('#world').getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; })(), people: window.__SPACE_EVENT_QA__?.()?.camera?.scene?.peopleCount, view: window.__SPACE_EVENT_QA__?.()?.camera?.view }));
    console.log(kind, JSON.stringify(m));
    await page.screenshot({ path: `/tmp/space-doodle/fix/app/after-lobby-${kind}.png` });
    await ctx.close();
  }
  await b.close();
})();
