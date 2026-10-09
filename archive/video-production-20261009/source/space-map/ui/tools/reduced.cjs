const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(process.argv[2] + '#/explore', { waitUntil: 'load' }); await page.waitForTimeout(4000);
  const running = async label => console.log(label, await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').map(a => `${a.animationName || a.constructor.name}:${a.effect?.getTiming?.().duration}`).join(',') || 'none'));
  await running('explore');
  console.log(await page.evaluate(() => document.getAnimations().map(a => `${a.constructor.name} id=${a.id} target=${a.effect?.target?.className || a.effect?.target?.tagName} kf=${JSON.stringify(a.effect?.getKeyframes?.()).slice(0,160)} timeline=${a.timeline?.constructor?.name}`).join('\n')));
  await page.locator('[data-map-action="flip"]').first().click(); await page.waitForTimeout(80); await running('flip');
  await page.locator('.map-round-card.is-open [data-map-action="edge"]').first().click(); await page.waitForTimeout(80); await running('paper');
  const t = await page.evaluate(() => getComputedStyle(document.querySelector('dialog[open]')).transform); console.log('paper transform', t);
  await page.screenshot({ path: '/tmp/space-map/shots/ui-wip/phone-reduced-paper.png' });
  await browser.close();
})();
