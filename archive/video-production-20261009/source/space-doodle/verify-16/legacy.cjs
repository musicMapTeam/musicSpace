const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const kill = setTimeout(() => process.exit(2), 200000);
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:5190/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
    await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 60000 }).catch(() => {});
    await sleep(700);
    await page.locator('button:visible', { hasText: '进入示例现场' }).first().click();
    await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 20000 });
    await page.locator('form[data-form="demo-entry"] input[name=consent]').check();
    await page.waitForSelector('form[data-form="demo-entry"] button[type=submit]:not([disabled])', { timeout: 60000 });
    await page.locator('form[data-form="demo-entry"] button[type=submit]').click();
    await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"]'), null, { timeout: 60000 });
    await sleep(2500);
    await page.click('#room-info');
    await page.waitForFunction(() => document.querySelector('#panel')?.dataset.kind === 'room', null, { timeout: 15000 });
    await sleep(1000);
    const removed = await page.evaluate(() => { let n = 0; for (const s of document.querySelectorAll('style[data-vite-dev-id]')) if (/\/doodle\//.test(s.dataset.viteDevId)) { s.disabled = true; n++; } return n; });
    await sleep(500);
    const info = await page.evaluate(() => [...document.querySelectorAll('#panel-body > .row > button, #panel-body > button.primary')].map(b => { const cs = getComputedStyle(b); const r = document.createRange(); r.selectNodeContents(b); return `${b.textContent.trim()} | bg ${cs.backgroundColor} | border ${cs.borderTopWidth} ${cs.borderTopColor} | ${cs.fontSize} | lines ${new Set([...r.getClientRects()].map(x => Math.round(x.top))).size}`; }));
    console.log('doodle sheets disabled:', removed); console.log(info.join('\n'));
    await page.evaluate(() => document.querySelector('#panel-body > .row')?.scrollIntoView({ block: 'center' }));
    await sleep(300);
    await page.screenshot({ path: '/tmp/space-doodle/verify-16/shots/legacy-room-phone.png' });
    await ctx.close();
  } catch (e) { console.error('ERR', e.message.split('\n')[0]); }
  await browser.close(); clearTimeout(kill);
})();
