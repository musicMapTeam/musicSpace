// Does a panel opened from a scrolled panel keep the old scroll? (wall -> photo detail, recap -> memory card)
const L = require('./lib.cjs');
L.watchdog(250);
(async () => {
  const browser = await L.launch();
  try {
    const run = await L.open(browser, 'phone');
    const { page } = run;
    await L.enter(run);
    await L.press(run, '[data-tour-action="sample:sample-crowd"]');
    await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
    await L.aiSettled(page);
    await L.press(run, 'form[data-form="upload"] button[type="submit"]');
    await page.locator('#panel [data-moment-badge] [data-exchange-offer]').first().waitFor({ state: 'attached', timeout: 45000 });
    await L.sleep(1000);
    const state = () => page.evaluate(() => { const p = document.querySelector('#panel'); const h = p.querySelector('#panel-body > h2'); return { kind: p.dataset.kind, scrollTop: Math.round(p.scrollTop), h2Top: h ? Math.round(h.getBoundingClientRect().top - p.getBoundingClientRect().top) : null }; });
    console.log('wall opened', JSON.stringify(await state()));
    // the last photo on the wall, as a judge would tap it after scrolling
    const items = page.locator('#panel .moment-card .photo-item');
    await items.nth((await items.count()) - 1).tap();
    await L.sleep(800);
    console.log('photo detail from a scrolled wall', JSON.stringify(await state()));
    await page.evaluate(() => { const o = document.createElement('button'); o.dataset.open = 'recap'; o.style.position = 'fixed'; o.style.left = '-9999px'; document.body.append(o); o.click(); o.remove(); });
    await page.waitForSelector('.panel[data-kind="recap"] [data-open="memory-card"]:not([disabled])', { timeout: 20000 });
    await L.sleep(800);
    console.log('recap opened', JSON.stringify(await state()));
    await L.press(run, '.panel[data-kind="recap"] [data-open="memory-card"]');
    await L.sleep(800);
    console.log('memory card from a scrolled recap', JSON.stringify(await state()));
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { await browser.close(); }
})();
