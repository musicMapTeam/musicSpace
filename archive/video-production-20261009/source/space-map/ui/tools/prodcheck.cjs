// Production check: fonts, requests outside the prefix, failed requests, errors. node prodcheck.cjs <url> [label]
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const [url, label = 'prod'] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--enable-gpu'] });
  for (const view of [{ width: 390, height: 844, mobile: true }, { width: 1440, height: 900 }]) {
    const context = await browser.newContext({ viewport: { width: view.width, height: view.height }, deviceScaleFactor: view.mobile ? 2 : 1, isMobile: !!view.mobile, hasTouch: !!view.mobile });
    const page = await context.newPage();
    const failed = []; const outside = []; const errors = []; const fonts = [];
    const prefix = new URL(url).pathname.replace(/music-map\/.*$/, '');
    page.on('requestfailed', r => failed.push(r.url()));
    page.on('response', r => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); if (r.url().includes('/fonts/doodle/')) fonts.push(r.url().split('/fonts/doodle/')[1]); });
    page.on('request', r => { const u = new URL(r.url()); if (u.protocol.startsWith('http') && (u.host !== new URL(url).host || !u.pathname.startsWith(prefix))) outside.push(r.url()); });
    page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(5000);
    const check = await page.evaluate(async () => {
      await document.fonts.ready;
      return { logo: document.fonts.check('20px "Doodle Logo"', 'MUSIC'), display: document.fonts.check('20px "Doodle Display"', '寻声'), marker: document.fonts.check('20px "Doodle Marker"', '唱片店'), hand: document.fonts.check('20px "Doodle Hand"', '合唱'),
        brand: getComputedStyle(document.querySelector('.brand-logo')).fontFamily.slice(0, 30), link: document.querySelector('link[href$="fonts.css"]')?.href };
    });
    console.log(label, view.width, JSON.stringify(check), 'fonts:', [...new Set(fonts)].join(','), 'failed:', failed.join(' ') || 'none', 'outside:', outside.join(' ') || 'none', 'errors:', errors.join(' | ') || 'none');
    await context.close();
  }
  await browser.close();
})();
