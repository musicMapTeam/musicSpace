// One-off: clean product stills for the cover concept / style frames (our own build only).
// desktop 3D overview without the route card (CSS 1440x810 @ DPR 8/3 -> 3840x2160), phone badge + accepted screens (1080x2340), element cut-outs.
const L = require('./lib.cjs');
const OUT = '/tmp/space-video-doodle/script/probe/shots';
const sleep = ms => new Promise(r => setTimeout(r, ms));
setTimeout(() => { console.error('watchdog'); process.exit(2); }, 280000).unref();
(async () => {
  const browser = await L.launch();
  try {
    // ---- desktop, clean overview
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 8 / 3, locale: 'zh-CN', timezoneId: 'Asia/Shanghai' });
    const page = await ctx.newPage();
    await page.goto(L.URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
    await page.locator('#join').click();
    await page.waitForSelector('form[data-form="demo-entry"] button.primary:not([disabled])', { timeout: 60000 });
    await page.locator('form[data-form="demo-entry"] input[name=name]').fill('阿宁');
    await page.locator('form[data-form="demo-entry"] input[name=consent]').check();
    await page.locator('form[data-form="demo-entry"] button.primary').click();
    await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"]'), null, { timeout: 60000 });
    await sleep(9500); // 林间 arrives ~8 s after the visitor
    const skip = page.locator('button:visible', { hasText: '跳过路线' });
    if (await skip.count()) await skip.first().click();
    await sleep(1500);
    await page.screenshot({ path: `${OUT}/c-desktop-overview-clean-4k.png` });
    console.log('desktop overview');
    await ctx.close();
  } finally {
    await browser.close();
  }
})();
