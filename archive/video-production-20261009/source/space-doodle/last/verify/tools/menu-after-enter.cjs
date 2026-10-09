// The ··· sheet right after entering: the entry sheet is scrolled down to its submit button, the visitor enters, then taps ···.
//   node menu-after-enter.cjs <phone|narrow|desktop> <base>
const L = require('./lib.cjs');
L.watchdog(150);
const [, , kind = 'phone', BASE = 'http://127.0.0.1:4783/musicSpace/'] = process.argv;
(async () => {
  const browser = await L.launch();
  let ok = true;
  try {
    const run = await L.open(browser, kind, BASE);
    const { page } = run;
    await L.press(run, '#join');
    await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 30000 });
    await page.check('form[data-form="demo-entry"] input[name="consent"]', { force: true });
    await page.waitForFunction(() => { const b = document.querySelector('form[data-form="demo-entry"] button[type="submit"]'); return b && !b.disabled; }, null, { timeout: 90000 });
    await page.evaluate(() => { const p = document.querySelector('#panel'); p.scrollTop = p.scrollHeight; });
    await L.sleep(300);
    const entrySt = await page.evaluate(() => Math.round(document.querySelector('#panel').scrollTop));
    await page.evaluate(() => document.querySelector('form[data-form="demo-entry"] button[type="submit"]').click());
    await page.waitForSelector('[data-tour-action="sample:sample-crowd"]', { timeout: 60000 });
    await L.sleep(1200);
    await L.press(run, '#room-info');
    await L.sleep(500);
    const c = await L.closeState(page);
    console.log(kind, JSON.stringify({ entryScrolledTo: entrySt, menu: { kind: c.kind, st: c.st, fromTop: c.fromTop, fromRight: c.fromRight, onTop: c.onTop, focused: c.focused } }));
    if (c.kind !== 'room' || c.st !== 0 || !c.onTop) ok = false;
    await L.shot(page, `${L.OUT}/sheets/menu-after-enter-${kind}.png`);
  } catch (e) { ok = false; console.log('FAILED', e.message.split('\n')[0]); } finally { console.log(kind, ok ? 'RESULT: PASS' : 'RESULT: FAIL'); await browser.close(); }
})();
