const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal'] });
  for (const [name, view] of [['w320', { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }], ['w360', { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
    const context = await browser.newContext(view);
    await context.addInitScript(() => sessionStorage.setItem('music-space-map-return:v1', JSON.stringify({ actor: 'a', scope: { kind: 'room', id: 'r' }, recordingId: 'real-far-away', returnUrl: '/' })));
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:5296/#/explore', { waitUntil: 'load' }); await page.waitForTimeout(3500);
    const tools = await page.evaluate(() => [...document.querySelectorAll('.masthead-tools button, .brand')].map(b => { const r = b.getBoundingClientRect(); return `${(b.innerText || b.getAttribute('aria-label')).replace(/\s+/g, ' ').slice(0, 12)}:${Math.round(r.left)}-${Math.round(r.right)}`; }).join(' '));
    console.log(name, tools);
    await page.screenshot({ path: `/tmp/space-map/shots/ui-wip/${name}-context.png` });
    await context.close();
  }
  await browser.close();
})();
