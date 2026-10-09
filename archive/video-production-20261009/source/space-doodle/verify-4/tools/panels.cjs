// verify-4: open room (via ··· header) and social (♡) panels after joining; measure .row buttons; screenshot.
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const VP = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const base = process.argv[2] || 'http://127.0.0.1:5190/';
const vp = process.argv[3] || 'phone';
const tag = process.argv[4] || 'dev';
const OUT = '/tmp/space-doodle/verify-4/shots';
const measure = () => {
  const ink = 'rgb(28, 27, 26)';
  const lines = el => { const r = document.createRange(); r.selectNodeContents(el); const ys = new Set([...r.getClientRects()].filter(x => x.width > 1).map(x => Math.round(x.top))); return ys.size; };
  const desc = b => { const cs = getComputedStyle(b), rc = b.getBoundingClientRect(); return `${b.className || '-'}|${b.innerText.replace(/\s+/g, ' ').trim()}|w=${Math.round(rc.width)} h=${Math.round(rc.height)} lines=${lines(b)} ${cs.fontSize} pad=${cs.padding} bg=${cs.backgroundColor === ink ? 'INK' : cs.backgroundColor}`; };
  const panel = document.querySelector('#panel');
  return { kind: panel && panel.dataset.kind, panelW: panel && Math.round(panel.getBoundingClientRect().width),
    rows: [...document.querySelectorAll('#panel .row')].map(r => [...r.querySelectorAll(':scope > button')].map(desc)),
    inkBtns: [...document.querySelectorAll('#panel button')].filter(b => b.getClientRects().length && getComputedStyle(b).backgroundColor === ink).map(b => b.innerText.replace(/\s+/g, ' ').trim()) };
};
(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars', '--mute-audio', '--force-color-profile=srgb'] });
  try {
    const ctx = await browser.newContext({ ...VP[vp], locale: 'zh-CN', timezoneId: 'Asia/Shanghai' });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
    await page.goto(base, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 }); await sleep(2000);
    await page.getByRole('button', { name: /进入示例现场/ }).first().click(); await sleep(1200);
    const consent = page.locator('#panel input[type=checkbox]').first();
    if (await consent.isVisible().catch(() => false)) await consent.check();
    await page.getByRole('button', { name: /进入示例现场/ }).last().click(); await sleep(4500);
    // room panel via the header ··· (judge route)
    await page.locator('#room-info').click(); await sleep(1500);
    console.log('ROOM', JSON.stringify(await page.evaluate(measure), null, 1));
    await page.screenshot({ path: `${OUT}/${tag}-room-${vp}.png` });
    // social panel via ♡
    await page.locator('#panel-close').click().catch(() => {}); await sleep(600);
    await page.locator('#social-inbox').click(); await sleep(1500);
    console.log('SOCIAL', JSON.stringify(await page.evaluate(measure), null, 1));
    const row = page.locator('#panel .row').last();
    if (await row.count()) { await row.scrollIntoViewIfNeeded(); await sleep(300); }
    await page.screenshot({ path: `${OUT}/${tag}-social-${vp}.png` });
    console.log('pageerrors', JSON.stringify(errs));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
