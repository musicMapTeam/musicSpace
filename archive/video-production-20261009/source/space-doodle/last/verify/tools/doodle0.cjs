// ?doodle=0 smoke on the production build: the classic shading in the room, the Doodle UI unchanged, the choice kept on reload in the same tab,
// ?doodle=1 brings the doodle shading back. Control: the plain URL renders 'doodle'. No /api, no failed requests, no console or page errors.
//   node doodle0.cjs <phone|desktop> <base>
const L = require('./lib.cjs');
const fs = require('fs');
L.watchdog(285);
const [, , kind = 'desktop', BASE = 'http://127.0.0.1:4783/musicSpace/'] = process.argv;
const DIR = `${L.OUT}/doodle0`;
fs.mkdirSync(DIR, { recursive: true });
const out = { kind, base: BASE, results: {}, failures: [] };
const fail = m => { out.failures.push(m); console.log(kind, '!! FAIL', m); };
const note = (k, v) => { out.results[k] = v; console.log(kind, k, JSON.stringify(v)); };
const info = page => page.evaluate(() => {
  const q = window.__SPACE_EVENT_QA__?.(); const s = q?.camera?.scene;
  const c = document.querySelector('#world canvas');
  const css = getComputedStyle(document.body);
  return { url: location.pathname + location.search, renderStyle: s?.renderStyle ?? null, venue: s?.venueAsset?.status ?? null, stage: document.querySelector('.frame')?.dataset.stage, session: sessionStorage.getItem('music-space-event-doodle'),
    canvas: c ? [c.width, c.height] : null, bodyBg: css.backgroundColor, paperToken: getComputedStyle(document.documentElement).getPropertyValue('--ds-paper').trim(), font: getComputedStyle(document.querySelector('#join') || document.body).fontFamily.slice(0, 40) };
});
const sceneColours = page => page.evaluate(() => { const c = document.querySelector('#world canvas'); if (!c) return 0; const o = document.createElement('canvas'); o.width = 64; o.height = 64; const x = o.getContext('2d'); x.drawImage(c, 0, 0, 64, 64); const d = x.getImageData(0, 0, 64, 64).data; const set = new Set(); for (let i = 0; i < d.length; i += 4) set.add((d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4)); return set.size; });

(async () => {
  const browser = await L.launch();
  const runs = [];
  try {
    // control: the plain address draws the doodle shading
    const ctl = await L.open(browser, kind, BASE); runs.push(ctl);
    await L.sleep(1800);
    const c0 = await info(ctl.page);
    note('control-lobby', c0);
    if (c0.renderStyle !== 'doodle') fail(`control: renderStyle ${c0.renderStyle}, expected doodle`);
    await ctl.context.close();

    const run = await L.open(browser, kind, BASE + '?doodle=0'); runs.push(run);
    const { page } = run;
    await L.sleep(1800);
    const a = await info(page);
    note('doodle0-lobby', { ...a, colours: await sceneColours(page) });
    if (a.renderStyle !== 'classic') fail(`?doodle=0 lobby: renderStyle ${a.renderStyle}, expected classic`);
    if (a.session !== '0') fail(`?doodle=0: session choice ${a.session}`);
    await L.shot(page, `${DIR}/lobby-doodle0-${kind}.png`);
    const e = await L.enter(run);
    note('entered', e);
    await L.sleep(2500);
    const b = await info(page);
    note('doodle0-room', { ...b, colours: await sceneColours(page) });
    if (b.renderStyle !== 'classic') fail(`?doodle=0 room: renderStyle ${b.renderStyle}`);
    if (b.stage !== 'room') fail('?doodle=0: did not reach the room');
    await L.toastGone(page);
    await L.shot(page, `${DIR}/room-doodle0-${kind}.png`);
    // the upload sheet and the wall still work in the classic shading
    await L.press(run, '[data-tour-action="sample:sample-crowd"]');
    await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
    note('doodle0-upload-ai', await L.aiSettled(page));
    const chosen = await page.evaluate(() => Boolean(document.querySelector('form[data-form="upload"] .moment-chip[aria-pressed="true"]')));
    if (!chosen) await L.press(run, 'form[data-form="upload"] .moment-chip[data-moment-viewpoint="crowd"]');
    await L.press(run, 'form[data-form="upload"] button[type="submit"]');
    await page.locator('#panel [data-moment-badge] [data-exchange-offer]').first().waitFor({ state: 'attached', timeout: 45000 });
    await L.sleep(1200);
    await L.shot(page, `${DIR}/wall-doodle0-${kind}.png`);
    await L.press(run, '#panel-close');
    // a reload in the same tab keeps the classic choice (the address no longer says ?doodle=0)
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 120000 });
    await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 60000 }).catch(() => {});
    await L.sleep(2500);
    const r = await info(page);
    note('reload', r);
    if (r.renderStyle !== 'classic') fail(`reload: renderStyle ${r.renderStyle}, the classic choice was not kept`);
    await L.shot(page, `${DIR}/reload-doodle0-${kind}.png`);
    // ?doodle=1 switches back
    await page.goto(BASE + '?doodle=1', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 120000 });
    await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 60000 }).catch(() => {});
    await L.sleep(2500);
    const d = await info(page);
    note('doodle1', d);
    if (d.renderStyle !== 'doodle') fail(`?doodle=1: renderStyle ${d.renderStyle}`);
    await L.shot(page, `${DIR}/doodle1-${kind}.png`);
  } catch (e) { fail('EXCEPTION ' + e.message.split('\n')[0]); }
  finally {
    for (const [i, r] of runs.entries()) {
      const log = r.log;
      out[`log${i}`] = { requests: log.requests, api: log.api, foreign: log.foreign, failedRequests: log.failedRequests, consoleErrors: log.consoleErrors, pageErrors: log.pageErrors };
      for (const k of ['api', 'foreign', 'failedRequests', 'consoleErrors', 'pageErrors']) if (log[k].length) fail(`run ${i} ${k}: ${JSON.stringify(log[k].slice(0, 4))}`);
    }
    out.ok = !out.failures.length;
    fs.writeFileSync(`${DIR}/doodle0-${kind}.json`, JSON.stringify(out, null, 1));
    console.log(kind, out.ok ? 'RESULT: PASS' : `RESULT: FAIL ${JSON.stringify(out.failures)}`);
    await browser.close();
    process.exit(out.ok ? 0 : 1);
  }
})();
