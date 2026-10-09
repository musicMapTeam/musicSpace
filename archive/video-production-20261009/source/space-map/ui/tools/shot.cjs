// Quick shots: node shot.cjs <url> <outdir> <name> [phone,desktop] [waitMs] [--nogl] [--reduced] [--w320]
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const [url, out, name, which = 'phone,desktop', wait = '5000', ...flags] = process.argv.slice(2);
const views = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 } },
  w320: { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const args = flags.includes('--nogl') ? ['--disable-webgl', '--disable-3d-apis'] : ['--use-angle=metal', '--enable-gpu'];
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args });
  for (const v of which.split(',')) {
    const context = await browser.newContext({ ...views[v], reducedMotion: flags.includes('--reduced') ? 'reduce' : 'no-preference' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + String(e).slice(0, 300)));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)); });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(Number(wait));
    await page.screenshot({ path: `${out}/${v}-${name}.png` });
    const info = await page.evaluate(() => ({ hscroll: document.documentElement.scrollWidth > innerWidth, fonts: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family).filter((x, i, a) => a.indexOf(x) === i) }));
    console.log(v, name, JSON.stringify(info), errors.length ? errors.join(' | ') : 'no errors');
    await context.close();
  }
  await browser.close();
})();
