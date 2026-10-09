// The person card (people -> a cast member): × position, A/B layout, scroll; usage: node person.cjs <vp>
const S = require('./sheets.cjs');
const path = require('path');
S.watchdog(200);
const vp = process.argv[2] || 'desktop';
const log = (label, value) => console.log(`${label} ${JSON.stringify(value)}`);
(async () => {
  const browser = await S.launch();
  try {
    const run = await S.open(browser, vp);
    const { page } = run;
    await S.enter(run);
    await S.clickHidden(page, { open: 'people' });
    await page.waitForSelector('.panel[data-kind="people"] [data-person]', { timeout: 20000 });
    await page.locator('#panel [data-person]').first().evaluate(b => b.click());
    await page.waitForSelector('.panel[data-kind="person"]', { timeout: 20000 });
    await S.sleep(1500);
    log('person:padding', await page.evaluate(() => getComputedStyle(document.querySelector('#panel')).padding));
    log('person:open', await S.measure(page));
    log('person:layoutAB', await S.layoutAB(page));
    await S.shot(page, path.join('/tmp/space-doodle/shots/panels', `person-top-${vp}.png`));
    await S.scrollTo(page, 'end'); await S.sleep(250);
    log('person:end', await S.measure(page));
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { await browser.close(); }
})();
