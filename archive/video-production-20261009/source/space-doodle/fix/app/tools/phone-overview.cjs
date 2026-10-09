process.env.SPACE_URL = process.env.SPACE_URL || 'http://127.0.0.1:47391/musicSpace/';
const L = require('/tmp/space-doodle/critique/art/tools/lib.cjs');
L.watchdog(200);
(async () => {
  const b = await L.launch();
  const { ctx, page } = await L.open(b, 'phone');
  await L.enter(page);
  await page.waitForFunction(() => (window.__SPACE_EVENT_QA__?.()?.members || []).length >= 5, null, { timeout: 25000 }).catch(() => {});
  await L.sleep(2500);
  const m = await page.evaluate(() => ({ cam: window.__SPACE_EVENT_QA__?.()?.camera?.position, tags: [...document.querySelectorAll('#hotspots .hotspot')].filter(h => !h.hidden).map(h => h.textContent.trim()) }));
  console.log(JSON.stringify(m));
  await page.screenshot({ path: '/tmp/space-doodle/fix/app/after-overview-phone.png' });
  await ctx.close(); await b.close();
})();
