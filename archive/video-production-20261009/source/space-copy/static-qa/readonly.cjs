// A second tab of the same browser: the read-only banner and About's note, at phone size.
const L = require('./lib.cjs');
L.watchdog(200);
const vp = process.argv[2] || 'phone';
(async () => {
  const browser = await L.launch();
  try {
    const first = await L.open(browser, vp);
    const page = await first.context.newPage();
    await page.goto(L.BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 120000 });
    await L.sleep(1200);
    console.log('banner:', await page.evaluate(() => document.getElementById('space-boot-banner')?.innerText));
    await L.shot(page, `21-readonly-${vp}`);
    await L.clickHidden(page, { open: 'about' });
    await L.sleep(800);
    await page.evaluate(() => { const p = document.querySelector('#panel'); p.scrollTop = p.scrollHeight; });
    await L.sleep(300);
    console.log('about warn:', await page.evaluate(() => [...document.querySelectorAll('#panel .demo-about-warn')].map(n => n.innerText)));
    console.log('reset disabled:', await page.evaluate(() => document.querySelector('#panel [data-demo-reset]')?.disabled));
    await L.shot(page, `22-readonly-about-${vp}`);
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { await browser.close(); }
})();
