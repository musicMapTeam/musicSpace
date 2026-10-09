const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--enable-gpu'] });
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  await p.goto('http://127.0.0.1:5197/#/explore', { waitUntil: 'load' }); await p.waitForTimeout(7000);
  const fonts = await p.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + ' ' + (f.unicodeRange || '').slice(0, 12)).slice(0, 10); });
  await p.screenshot({ path: '/tmp/space-map/shots/base/dev-explore-phone.png' });
  console.log('errors', errs, 'loaded fonts', fonts.length, fonts.slice(0, 4));
  await b.close();
})();
