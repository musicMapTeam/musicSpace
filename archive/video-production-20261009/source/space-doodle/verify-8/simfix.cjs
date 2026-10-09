const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const OUT = '/tmp/space-doodle/verify-8';
const kill = setTimeout(() => { console.error('watchdog'); process.exit(2); }, 250000);
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  try {
    await page.goto('http://127.0.0.1:5190/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 120000 });
    await page.evaluate(() => document.fonts.ready);
    await page.locator('button:visible', { hasText: '进入示例现场' }).first().click();
    await page.waitForSelector('form[data-form="demo-entry"] h2', { timeout: 30000 });
    await page.waitForTimeout(1200);
    const h2 = page.locator('form[data-form="demo-entry"] h2');
    await h2.screenshot({ path: `${OUT}/sim-0-current.png` });
    await page.evaluate(() => { const h = document.querySelector('form[data-form="demo-entry"] h2'); h.dataset.orig = h.innerHTML; h.innerHTML = h.dataset.orig.replace('入', '<span style="font-family:\'Doodle Marker\'">入</span>'); });
    await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(400);
    await h2.screenshot({ path: `${OUT}/sim-1-marker-fallback.png` });
    await page.evaluate(() => { const h = document.querySelector('form[data-form="demo-entry"] h2'); h.innerHTML = h.dataset.orig.replace('入', '<span style="font-family:\'Doodle Marker\';-webkit-text-stroke:.07em currentColor;paint-order:stroke fill">入</span>'); });
    await page.waitForTimeout(400);
    await h2.screenshot({ path: `${OUT}/sim-2-marker-emboldened.png` });
    await page.evaluate(() => { const h = document.querySelector('form[data-form="demo-entry"] h2'); h.innerHTML = h.dataset.orig; });
  } catch (e) { console.error('ERR', e.message.split('\n')[0]); }
  await browser.close(); clearTimeout(kill);
})();
