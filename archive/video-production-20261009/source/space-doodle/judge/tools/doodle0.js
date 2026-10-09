// Item 7: ?doodle=0 must give the classic 3D shading; the default is the doodle renderer.
const L = require('./lib.js');
const vp = process.argv[2] || 'desktop';
(async () => {
  const browser = await L.launch();
  const say = (k, v) => console.log(k, '=>', typeof v === 'string' ? v : JSON.stringify(v));
  for (const [name, query] of [['default', ''], ['doodle0', '?doodle=0']]) {
    const run = await L.open(browser, vp, { label: `doodle-${name}-${vp}` });
    const { page } = run;
    try {
      await L.boot(page, L.baseUrl('root') + query);
      await page.waitForFunction(() => document.querySelector('#loading')?.hidden || getComputedStyle(document.querySelector('#loading')).display === 'none' || getComputedStyle(document.querySelector('#loading')).opacity === '0', null, { timeout: 60000 }).catch(() => {});
      await L.sleep(3500);
      const st = await page.evaluate(() => ({ style: window.__SPACE_EVENT_QA__?.()?.camera?.scene?.renderStyle, venue: window.__SPACE_EVENT_QA__?.()?.camera?.scene?.venueAsset, error: !document.querySelector('#error')?.hidden, url: location.search }));
      say(`${name} lobby`, st);
      await L.shot(run, 'lobby');
      // join, then see what the address and the renderer say
      await page.click('#join');
      await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button[type="submit"]')?.disabled, null, { timeout: 60000 });
      await page.check('form[data-form="demo-entry"] input[name="consent"]');
      await page.click('form[data-form="demo-entry"] button[type="submit"]');
      await page.waitForFunction(() => document.querySelector('.frame')?.dataset.stage === 'room', null, { timeout: 30000 });
      await L.sleep(3000);
      say(`${name} room`, await page.evaluate(() => ({ style: window.__SPACE_EVENT_QA__?.()?.camera?.scene?.renderStyle, url: location.search })));
      await page.click('[data-tour-toggle]').catch(() => {});
      await L.sleep(1200);
      await L.shot(run, 'room');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
      await L.sleep(4000);
      say(`${name} after reload`, await page.evaluate(() => ({ style: window.__SPACE_EVENT_QA__?.()?.camera?.scene?.renderStyle, url: location.search })));
      say(`${name} console`, run.consoleMsgs.map(c => `${c.type}: ${c.text.slice(0, 200)}`));
      say(`${name} pageErrors`, run.pageErrors);
    } catch (e) { say(`${name} FAILED`, e.message.split('\n')[0]); }
    await run.context.close();
  }
  await browser.close();
})();
