// W15: About → 重新开始 (confirmed) → what the visitor sees after the reset.
const L = require('./lib.cjs');
L.watchdog(200);
const vp = process.argv[2] || 'phone';
L.setCorpus(`w15-${vp}`);
(async () => {
  const browser = await L.launch();
  try {
    const run = await L.open(browser, vp);
    const { page } = run; page.__vp = vp;
    await L.ready(run);
    await L.enter(run);
    await L.clickHidden(page, { open: 'about' });
    await L.sleep(800);
    await page.evaluate(() => { window.__confirmAnswer = true; });
    await L.js(page, '#panel [data-demo-reset]');
    await L.sleep(1500);
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 120000 }).catch(() => {});
    await L.sleep(2500);
    await L.grab(page, 'after-reset', 'body');
    await L.shot(page, 'w15-after-reset');
    await L.log(page, 'w15');
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { L.flush(); await browser.close(); }
})();
