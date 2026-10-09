// How many lines does the offer button take, per width? (wall right after saving)
const L = require('./lib.cjs');
L.watchdog(280);
(async () => {
  const browser = await L.launch();
  try {
    for (const kind of (process.argv[2] || 'narrow,p360').split(',')) {
      const run = await L.open(browser, kind);
      const { page } = run;
      await L.enter(run);
      await L.press(run, '[data-tour-action="sample:sample-crowd"]');
      await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
      await L.aiSettled(page);
      await L.press(run, 'form[data-form="upload"] button[type="submit"]');
      await page.locator('#panel [data-moment-badge] [data-exchange-offer]').first().waitFor({ state: 'attached', timeout: 45000 });
      await L.sleep(1500);
      const r = await page.evaluate(() => { const b = document.querySelector('#panel [data-exchange-offer]'); const range = document.createRange(); range.selectNodeContents(b); const tops = new Set([...range.getClientRects()].map(x => Math.round(x.top))); const cs = getComputedStyle(b); return { lines: tops.size, h: Math.round(b.getBoundingClientRect().height), w: Math.round(b.getBoundingClientRect().width), size: cs.fontSize }; });
      console.log(kind, JSON.stringify(r));
      await run.context.close();
    }
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { await browser.close(); }
})();
