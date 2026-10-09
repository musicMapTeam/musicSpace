const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await p.goto(process.env.BASE || 'http://127.0.0.1:5190/');
  await p.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
  await p.locator('#join').click();
  await p.waitForSelector('form[data-form="demo-entry"]');
  const r = await p.evaluate(() => { const l = document.querySelector('.demo-entry .consent'), s = l.querySelector('span'), st = document.querySelector('.demo-entry-status'), f = document.querySelector('.demo-entry-actions + .fine'); const cs = n => { const c = getComputedStyle(n); return [c.fontSize, c.lineHeight, c.fontFamily.split(',')[0], c.color]; }; return { label: cs(l), span: cs(s), status: cs(st), fine: f && cs(f) }; });
  console.log(JSON.stringify(r));
  await b.close();
})();
