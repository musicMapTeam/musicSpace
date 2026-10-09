// verify-4: reproduce the room-panel row-action claim on a given base URL.
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
  const desc = b => { const cs = getComputedStyle(b), rc = b.getBoundingClientRect(); return { cls: b.className, open: b.dataset.open || '', text: b.innerText.replace(/\s+/g, ' ').trim(), w: Math.round(rc.width * 10) / 10, h: Math.round(rc.height), lines: lines(b), font: cs.fontSize + ' ' + cs.fontFamily.split(',')[0], pad: cs.padding, bg: cs.backgroundColor, color: cs.color, border: cs.borderTopWidth + ' ' + cs.borderTopStyle, shadow: cs.boxShadow, flex: cs.flex, ws: cs.whiteSpace, wb: cs.wordBreak, minW: cs.minWidth }; };
  const panel = document.querySelector('#panel');
  const pr = panel && panel.getBoundingClientRect();
  const rows = [...document.querySelectorAll('#panel .row')].map(r => ({ rowW: Math.round(r.getBoundingClientRect().width), display: getComputedStyle(r).display, wrap: getComputedStyle(r).flexWrap, gap: getComputedStyle(r).gap, buttons: [...r.querySelectorAll(':scope > button')].map(desc) }));
  const visibleBtns = [...document.querySelectorAll('#panel button')].filter(b => b.getClientRects().length);
  const inkBtns = visibleBtns.filter(b => getComputedStyle(b).backgroundColor === ink).map(b => b.innerText.replace(/\s+/g, ' ').trim());
  return { kind: panel && panel.dataset.kind, panelW: pr && Math.round(pr.width), rows, inkBtns };
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
    // close the tour card if it covers things? just open the room panel via its visible opener
    const openers = await page.evaluate(() => [...document.querySelectorAll('[data-open=room]')].filter(b => b.getClientRects().length).map(b => b.id + '|' + b.innerText.replace(/\s+/g, ' ').trim()));
    console.log('room openers', JSON.stringify(openers));
    const room = page.locator('[data-open=room]:visible').first();
    await room.click(); await sleep(1500);
    const res = await page.evaluate(measure);
    console.log(JSON.stringify(res, null, 1));
    await page.screenshot({ path: `${OUT}/${tag}-room-${vp}.png` });
    // scroll the row into view for a close-up
    const row = page.locator('#panel .row').first();
    if (await row.count()) { await row.scrollIntoViewIfNeeded(); await sleep(300); await page.screenshot({ path: `${OUT}/${tag}-room-${vp}-row.png` }); }
    console.log('pageerrors', JSON.stringify(errs));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
