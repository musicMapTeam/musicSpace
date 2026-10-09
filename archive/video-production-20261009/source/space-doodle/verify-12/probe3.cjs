// verify-12 probe3: own tag with chosen nicknames (overflowing digits, long CJK name, quiet), current vs fix (fix injected at runtime only)
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const OUT = '/tmp/space-doodle/verify-12';
const URL = process.env.SPACE_URL || 'http://127.0.0.1:5190/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const kill = setTimeout(() => { console.log('WATCHDOG'); process.exit(2); }, 285000);
const FIX = '.hotspot .label{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;white-space:normal;overflow:hidden;text-overflow:clip;word-break:keep-all;overflow-wrap:anywhere;text-wrap:balance;line-height:1.22;padding:4px 4px 3px}';
const tagInfo = page => page.evaluate(() => [...document.querySelectorAll('#hotspots .hotspot')].filter(h => !h.hidden).map(h => {
  const lab = h.querySelector('.label'); const lr = lab.getBoundingClientRect(); const hr = h.getBoundingClientRect();
  const rg = document.createRange(); rg.selectNodeContents(lab); const tops = new Set([...rg.getClientRects()].map(r => Math.round(r.top)));
  return { text: lab.textContent, slot: [Math.round(hr.left), Math.round(hr.top), Math.round(hr.width), Math.round(hr.height)], label: [Math.round(lr.left), Math.round(lr.top), Math.round(lr.width), Math.round(lr.height)], lines: tops.size, sw: lab.scrollWidth, cw: lab.clientWidth, sh: lab.scrollHeight, ch: lab.clientHeight };
}));
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    for (const [i, [nick, quiet]] of [['访客4004', true], ['今晚站在第一排的人', false]].entries()) {
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 160)));
      await page.goto(URL, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
      await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 60000 }).catch(() => {});
      await page.evaluate(() => document.fonts.ready); await sleep(800);
      if (!(await page.locator('form[data-form="demo-entry"]').count())) await page.locator('button:visible', { hasText: '进入示例现场' }).first().click();
      await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 20000 });
      await page.locator('form[data-form="demo-entry"] input[name=name]').fill(nick);
      if (quiet) await page.locator('form[data-form="demo-entry"] input[name=participation][value=quiet]').check({ force: true }).catch(e => console.log('quiet radio', e.message.slice(0, 80)));
      await page.locator('form[data-form="demo-entry"] input[name=consent]').check();
      await page.waitForSelector('form[data-form="demo-entry"] button[type=submit]:not([disabled])', { timeout: 60000 });
      await page.locator('form[data-form="demo-entry"] button[type=submit]').click();
      await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"]'), null, { timeout: 60000 });
      await page.waitForFunction(() => (window.__SPACE_EVENT_QA__?.()?.members || []).length >= 4, null, { timeout: 30000 }).catch(() => {});
      await sleep(2500); await page.evaluate(() => document.fonts.ready);
      console.log(`[${nick}] current`, JSON.stringify(await tagInfo(page)));
      await page.screenshot({ path: `${OUT}/own-${i}-current-crop.png`, clip: { x: 12, y: 190, width: 366, height: 120 } });
      await page.addStyleTag({ content: FIX }); await sleep(350);
      console.log(`[${nick}] fix`, JSON.stringify(await tagInfo(page)));
      await page.screenshot({ path: `${OUT}/own-${i}-fix-crop.png`, clip: { x: 12, y: 190, width: 366, height: 120 } });
      await ctx.close();
    }
  } finally { await b.close(); clearTimeout(kill); }
})().catch(e => { console.error(e); process.exit(1); });
