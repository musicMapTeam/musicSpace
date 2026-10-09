const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--enable-gpu'] });
  for (const [i, q] of ['', '?lights=all'].entries()) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }); const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:5292/music-map/' + q + '#/explore'); await page.waitForFunction(() => window.__MAP_PROTO__); await new Promise(r => setTimeout(r, 2500));
    await page.locator('canvas.sakura-scene__canvas').screenshot({ path: `/tmp/space-map/shots/3d-lights/same-${i}.png` }); await ctx.close();
  }
  await browser.close();
})();
