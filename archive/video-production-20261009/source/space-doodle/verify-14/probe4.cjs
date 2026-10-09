const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const URL = process.env.SPACE_URL || 'http://127.0.0.1:5190/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
setTimeout(() => { console.log('watchdog'); process.exit(3); }, 200000).unref();
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const orig = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (...a) {
      if (this.classList?.contains('moment-view')) {
        const p = document.querySelector('#panel'); const img = this.closest('form')?.querySelector('.photo-review');
        const r = el => el ? Math.round(el.getBoundingClientRect().bottom) : null;
        window.__V14AT = { connected: this.isConnected, inCurrentBody: document.querySelector('#panel-body').contains(this), panelBottom: Math.round(p.getBoundingClientRect().bottom), viewBottomBefore: r(this), imgComplete: img?.complete, imgH: img && Math.round(img.getBoundingClientRect().height), takenH: Math.round(this.closest('form').querySelector('.moment-taken').getBoundingClientRect().height), viewH: Math.round(this.getBoundingClientRect().height), scrollBefore: p.scrollTop };
        const res = orig.apply(this, a);
        window.__V14AT.scrollAfter = p.scrollTop;
        return res;
      }
      return orig.apply(this, a);
    };
  });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
  await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 60000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await sleep(800);
  if (!(await page.locator('form[data-form="demo-entry"]').count())) await page.locator('button:visible', { hasText: '进入示例现场' }).first().click();
  await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 20000 });
  await page.locator('form[data-form="demo-entry"] input[name=consent]').check();
  await page.waitForSelector('form[data-form="demo-entry"] button[type=submit]:not([disabled])', { timeout: 60000 });
  await page.locator('form[data-form="demo-entry"] button[type=submit]').click();
  await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"]'), null, { timeout: 60000 });
  await sleep(2500);
  await page.locator('[data-tour-action^="sample:"]:visible', { hasText: '人海' }).first().click();
  await sleep(3000);
  const after = await page.evaluate(() => { const p = document.querySelector('#panel'); const v = p.querySelector('.moment-view'); const img = p.querySelector('.photo-review'); return { at: window.__V14AT, final: { viewH: Math.round(v.getBoundingClientRect().height), takenH: Math.round(p.querySelector('.moment-taken').getBoundingClientRect().height), imgH: Math.round(img.getBoundingClientRect().height), viewBottom: Math.round(v.getBoundingClientRect().bottom), scrollTop: p.scrollTop } }; });
  console.log(JSON.stringify(after));
  await browser.close(); process.exit(0);
})();
