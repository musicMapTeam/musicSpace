// The production build's rescue overlay and the About sheet, served under /musicSpace/ like Pages.
const L = require('./lib.cjs');
L.watchdog(200);
const BASE = process.env.SPACE_URL;
(async () => {
  const browser = await L.launch();
  try {
    for (const vp of ['phone', 'desktop']) {
      const context = await browser.newContext({ ...L.VP[vp], locale: 'zh-CN' });
      const page = await context.newPage();
      page.on('pageerror', e => console.log('[pageerror]', String(e.message).slice(0, 200)));
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 120000 });
      await page.evaluate(() => { window.__SPACE_BOOT__ = 'failed:SEED_FAILED'; window.__SPACE_RESCUE__.show('failed:SEED_FAILED'); });
      await L.sleep(600);
      const text = await page.evaluate(() => document.getElementById('space-rescue')?.innerText);
      console.log(`--- rescue ${vp}:\n${text}`);
      await L.shot(page, `20-rescue-${vp}`);
      await context.close();
    }
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { await browser.close(); }
})();
