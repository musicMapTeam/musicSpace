const L = require('./lib.cjs');
L.watchdog(200);
const kind = process.argv[2] || 'narrow';
(async () => {
  const browser = await L.launch();
  try {
    const run = await L.open(browser, kind);
    const { page } = run;
    await L.enter(run);
    await L.press(run, '[data-tour-action="sample:sample-crowd"]');
    await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
    await L.aiSettled(page);
    await L.sleep(1200);
    await page.evaluate(() => {
      window.__log = [];
      const t0 = performance.now();
      const panel = document.querySelector('#panel');
      const log = (...a) => window.__log.push([Math.round(performance.now() - t0), ...a]);
      let last = '';
      const tick = () => {
        const form = document.querySelector('form.moment-upload');
        const parts = form ? [...form.querySelectorAll(':scope > *, .moment-taken > *, .moment-view > *, .moment-taken__row > *')].map(e => `${(e.className || e.tagName).toString().split(' ')[0]}:${Math.round(e.getBoundingClientRect().height)}`) : [];
        const k = `st=${Math.round(panel.scrollTop)} ${parts.join(' ')}`;
        if (k !== last) { last = k; log(k); }
        if (performance.now() - t0 < 3000) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.setInputFiles('form[data-form="upload"] input[type="file"]', '/tmp/space-video-prep/photos/pack/demo-unsure-2150.jpg');
    await L.sleep(3200);
    const log = await page.evaluate(() => window.__log);
    for (const row of log) console.log(JSON.stringify(row));
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { await browser.close(); }
})();
