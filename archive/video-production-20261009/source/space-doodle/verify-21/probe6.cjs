// verify-21 probe 6: the lobby (shares the overview camera) with and without the K=2.2 pan
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function one(browser, K) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage(); page.setDefaultTimeout(30000);
  if (K) await page.route(/scene-layout\.js/, async route => {
    const res = await route.fetch(); let body = await res.text();
    body = body.replace(':{position:[-.493*distance,2.15+.20*distance,1+.87004*distance],target:[0,2.15,1]};', `:{position:[-.493*distance+${K}*.87004,2.15+.20*distance,1+.87004*distance+${K}*.493],target:[${K}*.87004,2.15,1+${K}*.493]};`);
    await route.fulfill({ response: res, body, headers: { ...res.headers(), 'content-type': 'application/javascript' } });
  });
  try {
    await page.goto('http://127.0.0.1:5190/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
    await page.evaluate(() => document.fonts.ready); await sleep(3000);
    const r = await page.evaluate(() => { const q = window.__SPACE_EVENT_QA__?.(); const p = document.querySelector('.presence').getBoundingClientRect(); return { stage: document.querySelector('.frame').dataset.stage, cam: q?.camera?.view, members: q?.members?.length, presence: [p.left, p.top, p.right, p.bottom].map(Math.round), world: (b => [b.left, b.top, b.right, b.bottom].map(Math.round))(document.querySelector('#world').getBoundingClientRect()) }; });
    console.log('K=' + K, JSON.stringify(r));
    await page.screenshot({ path: `/tmp/space-doodle/verify-21/lobby-K${K}.png` });
  } finally { await ctx.close(); }
}
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
  try { await Promise.all([one(browser, 0), one(browser, 2.2)]); } finally { await browser.close(); }
})();
