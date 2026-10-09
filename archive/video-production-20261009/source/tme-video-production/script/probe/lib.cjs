// Probe kit for the script/storyboard pass: opens the restyled production build (dist-pages served under /musicSpace/) in system Chrome.
// Phone = CSS 390x845 at DPR 1080/390 (screenshots 1080x2340); desktop = CSS 1440x810 at DPR 4/3 (screenshots 1920x1080).
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const URL = process.env.SPACE_URL || 'http://127.0.0.1:4971/musicSpace/';
const VP = {
  phone: { viewport: { width: 390, height: 845 }, deviceScaleFactor: 1080 / 390, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 810 }, deviceScaleFactor: 4 / 3 },
};
async function launch() {
  return chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'] });
}
async function open(browser, kind, opts = {}) {
  const ctx = await browser.newContext({ ...VP[kind], locale: 'zh-CN', timezoneId: 'Asia/Shanghai', reducedMotion: opts.reducedMotion || 'no-preference' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror ' + e.message.slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console ' + m.text().slice(0, 200)); });
  page.__errors = errors;
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
  return { ctx, page };
}
// visible clickable things, with ids / data-* hooks, to learn selectors
async function visibleButtons(page) {
  return page.evaluate(() => [...document.querySelectorAll('button,a,summary,[role=button]')]
    .filter(b => b.getClientRects().length && getComputedStyle(b).visibility !== 'hidden')
    .map(b => {
      const r = b.getBoundingClientRect();
      const data = Object.entries(b.dataset).map(([k, v]) => `data-${k.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}=${v}`).join(' ');
      return `${(b.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40)}${b.id ? ' #' + b.id : ''}${data ? ' [' + data + ']' : ''} @${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`;
    }));
}
async function visibleText(page, sel = 'body') {
  return page.evaluate(s => (document.querySelector(s)?.innerText || '').replace(/\n{2,}/g, '\n').slice(0, 4000), sel);
}
module.exports = { launch, open, visibleButtons, visibleText, URL, VP };
