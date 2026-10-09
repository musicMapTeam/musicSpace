const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const crypto = require('crypto');
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion });
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:5190/');
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 60000 });
    await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 60000 });
    await new Promise(r => setTimeout(r, 1200));
    const hashes = [];
    for (let i = 0; i < 4; i++) {
      const buf = await page.locator('#world canvas').screenshot();
      hashes.push(crypto.createHash('md5').update(buf).digest('hex').slice(0, 8));
      await new Promise(r => setTimeout(r, 330));
    }
    console.log(reducedMotion, hashes.join(' '), 'distinct=' + new Set(hashes).size);
    await ctx.close();
  }
  await browser.close();
})();
