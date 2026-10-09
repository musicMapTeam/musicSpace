const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal'] });
  const page = await browser.newPage({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto('http://127.0.0.1:5296/#/explore', { waitUntil: 'load' }); await page.waitForTimeout(4000);
  await page.locator('[data-map-action="flip"]').first().click(); await page.waitForTimeout(1200);
  const go = await page.evaluate(() => { const b = document.querySelector('.map-round-card__go'); return { text: b.innerText, sw: b.scrollWidth, cw: b.clientWidth }; });
  console.log(JSON.stringify(go));
  await page.screenshot({ path: '/tmp/space-map/shots/ui-wip/w320-go.png' });
  await browser.close();
})();
