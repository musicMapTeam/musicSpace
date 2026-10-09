// The person card (its own × rule at <=800px): opens at its top, × in view and on top while scrolling, nothing under it at the top.
//   node person.cjs <phone|desktop|narrow> <base> <name>
const L = require('./lib.cjs');
const fs = require('fs');
L.watchdog(200);
const [, , kind = 'phone', BASE = 'http://127.0.0.1:4783/musicSpace/', who = '阿遥'] = process.argv;
const DIR = `${L.OUT}/person`;
fs.mkdirSync(DIR, { recursive: true });
const out = { kind, who, results: {}, failures: [] };
const fail = m => { out.failures.push(m); console.log(kind, '!! FAIL', m); };
const note = (k, v) => { out.results[k] = v; console.log(kind, k, JSON.stringify(v)); };
(async () => {
  const browser = await L.launch();
  let run;
  try {
    run = await L.open(browser, kind, BASE);
    const { page } = run;
    await L.enter(run);
    await L.sleep(800);
    await L.press(run, '.camera-nav [data-view="person"]');
    await L.sleep(500);
    // the people list scrolled a little first, so the card is opened from a scrolled sheet when it can scroll
    await page.evaluate(() => { const p = document.querySelector('#panel'); p.scrollTop = 60; });
    await L.press(run, page.locator('#panel button[data-person]', { hasText: who }).first());
    await page.waitForFunction(() => document.querySelector('#panel')?.dataset.kind === 'person', null, { timeout: 20000 });
    await L.sleep(600);
    const c = await L.closeState(page);
    note('open:person', c);
    if (c.st !== 0) fail(`person card opened at ${c.st}`);
    if (!c.inView || !c.onTop) fail('person: × not in view / on top');
    if (c.under.length) fail(`person: × covers ${JSON.stringify(c.under)} at the top`);
    await L.shot(page, `${DIR}/person-top-${kind}.png`);
    const s = await L.scan(page);
    note('scan:person', s);
    if (s.bad.length) fail(`person: bad offsets ${JSON.stringify(s.bad.slice(0, 3))}`);
    await L.scrollTo(page, 'end');
    note('close:person:end', await L.closeState(page));
    await L.shot(page, `${DIR}/person-end-${kind}.png`);
  } catch (e) { fail('EXCEPTION ' + e.message.split('\n')[0]); }
  finally {
    const log = run?.log || {};
    for (const k of ['api', 'foreign', 'consoleErrors', 'pageErrors']) if (log[k]?.length) fail(`${k}: ${JSON.stringify(log[k].slice(0, 4))}`);
    out.failedRequests = log.failedRequests;
    out.ok = !out.failures.length;
    fs.writeFileSync(`${DIR}/person-${kind}.json`, JSON.stringify(out, null, 1));
    console.log(kind, out.ok ? 'RESULT: PASS' : `RESULT: FAIL ${JSON.stringify(out.failures)}`);
    await browser.close();
    process.exit(out.ok ? 0 : 1);
  }
})();
