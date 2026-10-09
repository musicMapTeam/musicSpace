const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  for (const path of ['lh-head', 'lh-now']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'no-preference' });
    const page = await ctx.newPage();
    await page.addInitScript(() => { const st = window.setTimeout; window.__timers = []; window.setTimeout = (f, ms, ...a) => { window.__timers.push(Math.round(ms || 0)); return st(f, ms, ...a); }; });
    await page.goto(`http://127.0.0.1:5604/${path}/index.html`);
    await page.waitForFunction(() => window.__SPACE_LIVEHOUSE_QA__?.().ready === true, null, { timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));
    console.log(path, await page.evaluate(() => ({ style: window.__SPACE_LIVEHOUSE_QA__().camera.scene.renderStyle ?? null, timers143: window.__timers.filter(t => t === 143).length, total: window.__timers.length })));
    await ctx.close();
  }
  await browser.close();
})();
