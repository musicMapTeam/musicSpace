// Part F: the visitor's own photo (no EXIF time): the demo-time button, its pressed state and note.
const L = require('./lib.cjs');
L.watchdog(220);
(async () => {
  const browser = await L.launch();
  try {
    const run = await L.open(browser, 'phone');
    const { page } = run;
    await L.enter(run);
    await L.press(run, '[data-tour-action="open:upload"]');
    await page.waitForSelector('form[data-form="upload"] input[type="file"]', { state: 'attached', timeout: 30000 });
    await page.setInputFiles('form[data-form="upload"] input[type="file"]', '/Users/alakazan/workplace/tme/musicSpace/web/static-runtime/demo-assets/yao-stage.jpg');
    await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
    await L.sleep(2500);
    await L.grab(page, 'own-photo', '#panel form[data-form="upload"]');
    await L.shot(page, 'f-own-photo-phone');
    const demo = page.locator('form[data-form="upload"] [data-demo-time]').first();
    if (await demo.count()) { await demo.evaluate(b => b.click()); await L.sleep(800); await L.grab(page, 'own-photo-demo-on', '#panel form[data-form="upload"] .moment-taken, #panel form[data-form="upload"] [data-demo-time]'); await L.shot(page, 'f-own-photo-demo-on-phone'); }
    L.save('part-f-phone');
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { await browser.close(); }
})();
