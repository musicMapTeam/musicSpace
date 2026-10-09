// Counts the doodle "line boil" timer (setTimeout 1000/7 ms) and idle canvas changes on /livehouse/.
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const { PNG } = require('/tmp/space-video-prep/tools/node_modules/pngjs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TARGETS = [
  { label: 'head', url: 'http://127.0.0.1:8931/livehouse/' },
  { label: 'now', url: 'http://127.0.0.1:8932/livehouse/' },
  { label: 'now_doodle0', url: 'http://127.0.0.1:8932/livehouse/?doodle=0' },
];
function changed(a, b) {
  const A = PNG.sync.read(a), B = PNG.sync.read(b); let n = 0;
  for (let i = 0; i < A.data.length; i += 4) if (Math.abs(A.data[i] - B.data[i]) > 8 || Math.abs(A.data[i + 1] - B.data[i + 1]) > 8 || Math.abs(A.data[i + 2] - B.data[i + 2]) > 8) n++;
  return +(100 * n / (A.width * A.height)).toFixed(2);
}
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const out = {};
  try {
    for (const t of TARGETS) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
      const page = await ctx.newPage();
      await page.addInitScript(() => {
        window.__boilTimers = 0;
        const orig = window.setTimeout;
        window.setTimeout = function (fn, ms, ...rest) { if (Math.abs((ms || 0) - 1000 / 7) < 0.5) window.__boilTimers++; return orig.call(this, fn, ms, ...rest); };
      });
      await page.goto(t.url, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__SPACE_LIVEHOUSE_QA__?.().ready === true, null, { timeout: 60000 });
      await sleep(2000);
      const b0 = await page.evaluate(() => window.__boilTimers);
      const clip = { x: 0, y: 140, width: 390, height: 350 };
      const s1 = await page.screenshot({ clip });
      await sleep(3000);
      const b1 = await page.evaluate(() => window.__boilTimers);
      const s2 = await page.screenshot({ clip });
      out[t.label] = { renderStyle: await page.evaluate(() => window.__SPACE_LIVEHOUSE_QA__().camera?.scene?.renderStyle ?? null), boilTimersIn3s: b1 - b0, idleCanvasChangePct: changed(s1, s2) };
      await ctx.close();
    }
  } finally { await browser.close(); }
  console.log(JSON.stringify(out, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
