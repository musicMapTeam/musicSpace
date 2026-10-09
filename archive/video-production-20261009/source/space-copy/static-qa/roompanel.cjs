// The room panel (本场信息) after entering: shot + the About link's target size.
const L = require('./lib.cjs');
L.watchdog(200);
const vp = process.argv[2] || 'phone';
(async () => {
  const browser = await L.launch();
  try {
    const run = await L.open(browser, vp);
    const { page } = run;
    await L.enter(run);
    await page.locator('#join').first().evaluate(b => b.click());
    await L.sleep(900);
    await L.shot(page, `07b-room-panel-${vp}`);
    const box = await page.evaluate(() => { const b = document.querySelector('#panel .demo-room-note button'); const r = b.getBoundingClientRect(); const s = getComputedStyle(b); return { w: Math.round(r.width), h: Math.round(r.height), font: s.fontFamily.slice(0, 40), size: s.fontSize, note: getComputedStyle(b.parentElement).backgroundColor }; });
    console.log('about link', JSON.stringify(box));
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { await browser.close(); }
})();
