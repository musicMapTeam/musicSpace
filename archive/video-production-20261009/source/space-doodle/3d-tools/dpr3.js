// Pixel-ratio cap: on a 3x screen the doodle canvas stays at 2x.
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  for (const [w, h, dpr] of [[390, 844, 3], [1440, 900, 2], [2560, 1440, 2]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:5190/');
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 60000 });
    await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 60000 });
    await new Promise(r => setTimeout(r, 800));
    const r = await page.evaluate(() => { const c = document.querySelector('#world canvas.toon-scene-canvas'); return { css: [c.clientWidth, c.clientHeight], canvas: [c.width, c.height], ratio: +(c.width / c.clientWidth).toFixed(3), style: window.__SPACE_EVENT_QA__?.()?.camera?.scene?.renderStyle }; });
    console.log(`${w}x${h}@${dpr}`, JSON.stringify(r));
    await ctx.close();
  }
  await browser.close();
})();
