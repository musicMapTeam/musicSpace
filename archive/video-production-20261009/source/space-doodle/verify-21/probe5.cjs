// verify-21 probe 5: what sits on top of the route note's 「收起」 and label sticker at short desktop viewports (no patches)
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const VPS = (process.argv[2] || '1536x730,1280x720,1440x790,1440x900').split(',').map(s => s.split('x').map(Number));
async function one(browser, [w, h]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage(); page.setDefaultTimeout(30000);
  try {
    await page.goto('http://127.0.0.1:5190/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
    await page.evaluate(() => document.fonts.ready); await sleep(800);
    await page.locator('#join').click();
    await page.waitForSelector('form[data-form="demo-entry"]');
    await page.locator('form[data-form="demo-entry"] input[name=consent]').check();
    await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button[type=submit]')?.disabled, null, { timeout: 60000 });
    await page.locator('form[data-form="demo-entry"] button[type=submit]').click();
    await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"]'), null, { timeout: 60000 });
    await sleep(3000);
    const r = await page.evaluate(() => {
      const desc = e => e ? (e.closest('.demo-tour') ? 'tour:' + (e.closest('button')?.textContent.trim() || e.className) : (e.closest('header') ? 'HEADER:' + (e.closest('a,button')?.textContent.trim() || e.className || e.tagName) : (e.id || e.className || e.tagName))) : null;
      const at = (el, fx, fy) => { const b = el.getBoundingClientRect(); return desc(document.elementFromPoint(b.left + b.width * fx, b.top + b.height * fy)); };
      const tg = document.querySelector('.demo-tour [data-tour-toggle]'), st = document.querySelector('.demo-tour .demo-tour-title strong');
      const world = document.querySelector('#world').getBoundingClientRect(), pres = document.querySelector('.presence').getBoundingClientRect();
      return { toggle: { rect: [...['left', 'top', 'right', 'bottom'].map(k => Math.round(tg.getBoundingClientRect()[k]))], centre: at(tg, .5, .5), left: at(tg, .2, .5), right: at(tg, .8, .5) },
        sticker: { centre: at(st, .5, .5), left: at(st, .15, .5) }, cardTopAboveWindowBy: Math.round(world.top - pres.top) };
    });
    console.log(`${w}x${h}`, JSON.stringify(r));
    // can a real click collapse it?
    const ok = await page.locator('.demo-tour [data-tour-toggle]').click({ timeout: 4000 }).then(() => true, e => e.message.split('\n').find(l => /intercepts/.test(l)) || 'timeout');
    console.log(`${w}x${h} click 收起 ->`, ok);
  } finally { await ctx.close(); }
}
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
  try { await Promise.all(VPS.map(vp => one(browser, vp).catch(e => console.log('ERR', vp.join('x'), e.message.slice(0, 200))))); } finally { await browser.close(); }
})();
