const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
setTimeout(() => { console.error('watchdog'); process.exit(2); }, 150000).unref();
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const out = {};
  for (const [label, vp] of [['phone390', { width: 390, height: 844 }], ['tab768', { width: 768, height: 1024 }], ['narrow360', { width: 360, height: 740 }]]) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:5190/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
    await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 60000 }).catch(() => {});
    await sleep(800);
    await page.locator('button:visible', { hasText: '进入示例现场' }).first().click();
    await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 20000 }); await sleep(900);
    out[label] = await page.evaluate(() => {
      const R = e => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom].map(v => Math.round(v)); };
      const p = document.querySelector('#panel'), w = document.querySelector('.world-shell'), s = getComputedStyle(p);
      return { panel: R(p), world: R(w), overflow: s.overflowY, position: s.position, worldZ: getComputedStyle(w).zIndex, worldPos: getComputedStyle(w).position, panelZ: s.zIndex, scroll: [p.scrollHeight, p.clientHeight] };
    });
    if (label === 'tab768') await page.screenshot({ path: '/tmp/space-doodle/verify-15/shots/tab768-join.png' });
    if (label === 'narrow360') await page.screenshot({ path: '/tmp/space-doodle/verify-15/shots/narrow360-join.png' });
    await ctx.close();
  }
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
