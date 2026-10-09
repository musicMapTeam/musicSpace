const L = require('./lib.cjs');
L.watchdog(200);
const vp = process.argv[2] || 'phone';
(async () => {
  const browser = await L.launch();
  try {
    const run = await L.open(browser, vp);
    const { page } = run;
    await L.enter(run);
    await L.press(run, '[data-tour-action="sample:sample-crowd"]');
    await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
    await L.aiSettled(page);
    await page.setInputFiles('form[data-form="upload"] input[type="file"]', '/tmp/space-doodle/critique/art/01-display-glyphs-ru-ji.png');
    await page.waitForFunction(() => /没读到|大约/.test(document.querySelector('form.moment-upload')?.textContent || '') && !document.querySelector('[data-sample-flag]'), null, { timeout: 30000 });
    await L.sleep(2500);
    console.log(vp, JSON.stringify(await L.uploadState(page)));
    await L.shot(page, process.env.NOEXIF_OUT ? `${process.env.NOEXIF_OUT}/after-upload-notime-${vp}.png` : `${L.OUT}/noexif-${vp}.png`);
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { await browser.close(); }
})();
