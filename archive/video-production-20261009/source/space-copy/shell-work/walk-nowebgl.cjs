const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const VP = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desktop: { viewport: { width: 1440, height: 900 } }, narrow: { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };
const t = setTimeout(() => { console.log('WATCHDOG'); process.exit(3); }, 200000); t.unref();
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--disable-webgl', '--disable-3d-apis'] });
  try {
    for (const kind of (process.argv[2] || 'phone,desktop,narrow').split(',')) {
      const context = await browser.newContext({ ...VP[kind], locale: 'zh-CN' }); const page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(String(e.message).slice(0, 160)));
      await page.goto('http://127.0.0.1:5190/', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('#error') && !document.querySelector('#error').hidden, null, { timeout: 90000 }).catch(() => console.log(kind, 'error panel not shown'));
      await page.waitForTimeout(2500);
      const info = await page.evaluate(() => { const e = document.querySelector('#error'); const b = e.getBoundingClientRect(); const kids = [...e.children].map(k => { const r = k.getBoundingClientRect(); return { tag: k.tagName, text: k.textContent, w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) }; }); return { hidden: e.hidden, box: [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)], kids, docOverflow: document.documentElement.scrollWidth > innerWidth + 1, loadingHidden: document.querySelector('#loading').hidden }; });
      console.log(kind, JSON.stringify(info), 'errors', JSON.stringify(errors));
      await page.screenshot({ path: `/tmp/space-copy/shell-work/shots/${kind}-nowebgl.png` });
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error('FAILED', e); process.exit(1); });
