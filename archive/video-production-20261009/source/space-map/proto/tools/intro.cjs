const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--enable-gpu'] });
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion }); const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    await page.goto('http://127.0.0.1:5292/music-map/?ui=paper#/home'); await page.waitForFunction(() => window.__MAP_PROTO__);
    const samples = []; for (let i = 0; i < 6; i++) { samples.push(await page.evaluate(() => +window.__MAP_PROTO__.doodle.uniforms.uLine.value.toFixed(2))); await new Promise(r => setTimeout(r, 160)); }
    if (reducedMotion === 'no-preference') await page.screenshot({ path: '/tmp/space-map/shots/3d-lights/intro-early.png' });
    console.log(reducedMotion, 'uLine samples', samples.join(' '), 'errors:', errs.length ? errs.join(' | ') : 'none');
    await ctx.close();
  }
  await browser.close();
})();
