// The map opened from a chat song (return context with a recording and a scope): 「这首歌」 in the masthead, draft buttons under songs.
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const [BASE, OUT] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal'] });
  for (const [name, view] of [['phone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }], ['w320', { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }], ['desktop', { viewport: { width: 1440, height: 900 } }]]) {
    const context = await browser.newContext(view);
    await context.addInitScript(() => sessionStorage.setItem('music-space-map-return:v1', JSON.stringify({ actor: 'a', scope: { kind: 'room', id: 'r' }, recordingId: 'real-far-away', returnUrl: '/musicSpace/' })));
    const page = await context.newPage();
    await page.goto(BASE + '#/explore', { waitUntil: 'load' }); await page.waitForTimeout(4000);
    await page.screenshot({ path: `${OUT}/${name}-context-masthead.png` });
    await page.locator('.space-map-context').click(); await page.waitForTimeout(2500);
    await page.locator('.map-network-selection [data-map-action="artist"]').click(); await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/${name}-context-drafts.png` });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    const tools = await page.evaluate(() => [...document.querySelectorAll('.masthead-tools button, .brand')].map(b => { const r = b.getBoundingClientRect(); return `${(b.innerText || b.getAttribute('aria-label')).replace(/\s+/g, ' ').slice(0, 12)}:${Math.round(r.left)}-${Math.round(r.right)}x${Math.round(r.height)}`; }).join(' '));
    console.log(name, 'overflow', overflow, tools);
    await context.close();
  }
  await browser.close();
})();
