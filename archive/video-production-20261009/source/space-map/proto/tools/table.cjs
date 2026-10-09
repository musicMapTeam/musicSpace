// Record table states with ink on it: a round after one flip + move, and a free roam from a singer chip.
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const T = { base: 'http://127.0.0.1:5291/music-map/', doodle: 'http://127.0.0.1:5292/music-map/?ui=paper' };
const VPS = { desktop: { viewport: { width: 1440, height: 900 } }, phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };
(async () => {
  const dir = '/tmp/space-map/shots/3d-table'; fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--enable-gpu'] });
  for (const [vp, opts] of Object.entries(VPS)) for (const [name, url] of Object.entries(T)) {
    const ctx = await browser.newContext(opts); const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
    await page.goto(url + '#/explore'); await page.waitForFunction(() => window.__MAP_PROTO__); await sleep(2500);
    const flip = page.locator('.map-round-card__flip').first();
    if (await flip.count()) { await flip.click(); await sleep(1500); }
    const go = page.locator('.map-round-card__go').first();
    if (await go.count()) { await go.click(); await sleep(2500); }
    await page.screenshot({ path: `${dir}/round-${vp}-${name}.png` });
    await page.goto(url + '#/home'); await sleep(2500);
    const chip = page.getByRole('button', { name: /林俊杰/ }).first();
    if (await chip.count()) { await chip.click(); await sleep(3500); }
    await page.screenshot({ path: `${dir}/roam-${vp}-${name}.png` });
    console.log(vp, name, 'errors:', errs.length ? errs.join(' | ') : 'none');
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
