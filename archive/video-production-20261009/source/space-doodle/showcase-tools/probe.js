const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const [, , W = '320', PORT = '5190'] = process.argv;
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const ctx = await browser.newContext({ viewport: { width: +W, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/`);
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  const info = await page.evaluate(() => {
    const f = document.querySelector('.frame > footer'), b = f.querySelector('button'), cs = getComputedStyle(f);
    const r = n => { const x = n.getBoundingClientRect(); return [Math.round(x.left), Math.round(x.top), Math.round(x.width), Math.round(x.height)]; };
    return { footer: r(f), padding: cs.padding, button: r(b), docW: document.documentElement.scrollWidth, winW: innerWidth };
  });
  console.log(JSON.stringify(info));
  await browser.close();
})();
