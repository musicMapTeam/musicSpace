// Part E: desktop lobby, the tour card on desktop (is the hint shown?), the About sheet on desktop.
const L = require('./lib.cjs');
L.watchdog(200);
(async () => {
  const browser = await L.launch();
  try {
    const run = await L.open(browser, 'desktop');
    const { page } = run;
    await L.grab(page, 'desktop-lobby', 'body');
    await L.shot(page, 'e-lobby-desktop');
    await L.enter(run);
    await L.sleep(800);
    await L.grab(page, 'desktop-tour', '#demo-tour');
    await L.shot(page, 'e-room-desktop');
    L.save('part-e-desktop');
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { await browser.close(); }
})();
