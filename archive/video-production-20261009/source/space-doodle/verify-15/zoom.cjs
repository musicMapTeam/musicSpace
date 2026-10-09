const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const OUT = '/tmp/space-doodle/verify-15/shots';
const sleep = ms => new Promise(r => setTimeout(r, ms));
setTimeout(() => { console.error('watchdog'); process.exit(2); }, 200000).unref();
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:5190/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
  await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 60000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready); await sleep(1000);
  await page.locator('button:visible', { hasText: '进入示例现场' }).first().click();
  await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 20000 }); await sleep(800);
  await page.locator('form[data-form="demo-entry"] input[name=consent]').check();
  await page.waitForSelector('form[data-form="demo-entry"] button[type=submit]:not([disabled])', { timeout: 60000 });
  await page.locator('form[data-form="demo-entry"] button[type=submit]').click();
  await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"]'), null, { timeout: 60000 });
  await sleep(3000);
  for (let i = 0; i < 2; i++) { await page.keyboard.press('Escape'); await sleep(150); }
  await page.evaluate(() => { const c = document.querySelector('#panel-close'); if (c && !document.querySelector('#panel').hidden) c.click(); });
  await sleep(500);
  // recap sheet (data-open="recap")
  await page.evaluate(() => { const b = document.createElement('button'); b.dataset.open = 'recap'; b.style.cssText = 'position:fixed;left:-9999px'; document.body.append(b); b.click(); b.remove(); });
  await sleep(2500);
  await page.evaluate(() => document.activeElement?.blur?.()); await sleep(600);
  await page.screenshot({ path: `${OUT}/z-recap-tl.png`, clip: { x: 0, y: 52, width: 120, height: 60 } });
  await page.screenshot({ path: `${OUT}/z-recap-tr.png`, clip: { x: 270, y: 52, width: 120, height: 60 } });
  await page.screenshot({ path: `${OUT}/z-recap-bl.png`, clip: { x: 0, y: 712, width: 120, height: 48 } });
  await page.screenshot({ path: `${OUT}/z-recap-br.png`, clip: { x: 270, y: 712, width: 120, height: 48 } });
  // what shows inside the 6px gaps: sample pixel colours along the gap strip (top: y=71..73, bottom: y=734..736)
  const info = await page.evaluate(() => {
    const els = (x, y) => document.elementsFromPoint(x, y).slice(0, 3).map(e => e.id ? '#' + e.id : e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : e.tagName);
    return { top: [40, 120, 200, 300, 360].map(x => [x, els(x, 72)]), bottom: [16, 120, 360].map(x => [x, els(x, 735)]) };
  });
  console.log(JSON.stringify(info));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
