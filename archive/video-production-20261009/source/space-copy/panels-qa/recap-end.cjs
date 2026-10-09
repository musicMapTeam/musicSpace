const Q = require('/tmp/space-copy/panels-qa/qa.cjs');
Q.watchdog(200);
const kind = process.argv[2] || 'phone';
(async () => {
  const browser = await Q.launch();
  try {
    const run = await Q.open(browser, kind);
    const { page } = run;
    await Q.enter(run);
    await Q.clickHidden(page, { open: 'recap' });
    await page.waitForSelector('.panel[data-kind="recap"] .recap-next', { timeout: 30000 });
    await Q.sleep(1200);
    await page.evaluate(() => document.querySelector('#panel .recap-next')?.scrollIntoView({ block: 'end' }));
    await Q.sleep(500);
    console.log(JSON.stringify(await Q.audit(page, '#panel')));
    await Q.snap(page, 'recap-end', kind);
    await page.locator('#panel [data-open="memory-card"]').first().evaluate(b => b.click());
    await page.waitForSelector('form[data-form="memory-card"]', { timeout: 20000 });
    await Q.sleep(800);
    await Q.snap(page, 'memory-top', kind);
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { await browser.close(); }
})();
