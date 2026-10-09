// Judge route (docs/design/doodle.md §5) on the production Pages build, fresh context:
// 「进入示例现场」→ 勾选同意 →「进入示例现场」→「人海 · 示例照片」→ 上传表单 →「保存这张照片」→ 照片墙 →「和 TA 交换这个视角」→ 勾选
// →「把这两张交给对方确认 ↗」→「交换已接受」. Fails on any /api request, foreign host, failed request, console error or page error.
//   node walk.cjs <phone|desktop|narrow> <base> <label>
const L = require('./lib.cjs');
const fs = require('fs');
L.watchdog(285);
const kind = process.argv[2] || 'phone';
const BASE = process.argv[3] || 'http://127.0.0.1:4783/musicSpace/';
const label = process.argv[4] || 'route';
const DIR = `${L.OUT}/${label}`;
fs.mkdirSync(DIR, { recursive: true });
const t0 = Date.now();
const out = { kind, base: BASE, steps: [], failures: [] };
let run;
const step = (name, extra = {}) => { const s = { name, t: +((Date.now() - t0) / 1000).toFixed(1), ...extra }; out.steps.push(s); if (run?.log) run.log.step = name; console.log(kind, JSON.stringify(s)); };
const fail = m => { out.failures.push(m); console.log(kind, '!! FAIL', m); };

(async () => {
  const browser = await L.launch();
  try {
    run = await L.open(browser, kind, BASE);
    const { page } = run;
    step('ready', { title: await page.title(), url: page.url(), ...(await page.evaluate(() => ({ build: document.querySelector('meta[name="space-build"]')?.content, channel: document.documentElement.dataset.channel, idb: window.__SPACE_STATIC__?.idbName, doodleSession: sessionStorage.getItem('music-space-event-doodle') }))) });
    await L.sleep(1500);
    await L.shot(page, `${DIR}/01-first-screen-${kind}.png`);

    const joinLabel = (await page.locator('#join').innerText()).trim();
    await L.press(run, '#join');
    await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 30000 });
    await L.sleep(700);
    const form = await page.evaluate(() => ({ st: Math.round(document.querySelector('#panel').scrollTop), submit: document.querySelector('form[data-form="demo-entry"] button[type="submit"]')?.textContent.trim(), consent: !!document.querySelector('form[data-form="demo-entry"] input[name="consent"]') }));
    step('join-form', { joinLabel, ...form, close: await L.closeState(page) });
    await L.shot(page, `${DIR}/02-join-${kind}.png`);
    await page.check('form[data-form="demo-entry"] input[name="consent"]', { force: true });
    await page.waitForFunction(() => { const b = document.querySelector('form[data-form="demo-entry"] button[type="submit"]'); return b && !b.disabled; }, null, { timeout: 90000 });
    await L.press(run, 'form[data-form="demo-entry"] button[type="submit"]');
    await page.waitForSelector('[data-tour-action="sample:sample-crowd"]', { timeout: 60000 });
    await page.waitForFunction(() => document.querySelectorAll('#hotspots [data-kind="person"]').length > 1, null, { timeout: 30000 }).catch(() => step('few people'));
    await L.sleep(2500);
    const sample = (await page.locator('[data-tour-action="sample:sample-crowd"]').first().innerText()).trim().replace(/\s+/g, ' ');
    step('joined', { sample, stage: await page.evaluate(() => document.querySelector('.frame')?.dataset.stage), people: await page.evaluate(() => [...document.querySelectorAll('#hotspots [data-kind="person"]')].map(n => n.textContent.trim())) });
    await L.toastGone(page);
    await L.shot(page, `${DIR}/03-room-${kind}.png`);

    await L.press(run, '[data-tour-action="sample:sample-crowd"]');
    await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
    const settled = await L.aiSettled(page);
    await L.sleep(1500); // the reveal waits for the photo decode and the pop-in, then scrolls
    const ai = await page.evaluate(() => ({ key: document.querySelector('form[data-form="upload"] [data-ai-line]')?.getAttribute('data-ai-key'), line: document.querySelector('form[data-form="upload"] [data-ai-line]')?.textContent.trim().slice(0, 60), chosen: document.querySelector('form[data-form="upload"] .moment-chip[aria-pressed="true"]')?.textContent.trim() || null, save: document.querySelector('form[data-form="upload"] button[type="submit"]')?.textContent.trim(), taken: document.querySelector('form[data-form="upload"] .moment-taken')?.textContent.trim().replace(/\s+/g, ' ').slice(0, 40) }));
    step('upload-reveal', { settled, ...ai, close: await L.closeState(page) });
    await L.shot(page, `${DIR}/04-upload-reveal-${kind}.png`);
    if (!ai.chosen) await L.press(run, 'form[data-form="upload"] .moment-chip[data-moment-viewpoint="crowd"]');
    await L.press(run, 'form[data-form="upload"] button[type="submit"]');
    await page.locator('#panel [data-moment-badge] [data-exchange-offer]').first().waitFor({ state: 'attached', timeout: 45000 });
    await page.waitForFunction(() => [...document.querySelectorAll('#panel .moment-card img')].every(i => i.complete && i.naturalWidth), null, { timeout: 30000 }).catch(() => {});
    await L.sleep(1800);
    step('wall', await page.evaluate(() => ({ kind: document.querySelector('#panel').dataset.kind, st: Math.round(document.querySelector('#panel').scrollTop), badge: document.querySelector('#panel .moment-badge__title')?.textContent.trim(), reason: document.querySelector('#panel .moment-badge__reason')?.textContent.trim().slice(0, 50), offer: document.querySelector('#panel [data-exchange-offer]')?.textContent.trim() })));
    await L.toastGone(page);
    await L.shot(page, `${DIR}/05-wall-${kind}.png`);

    await L.press(run, '#panel [data-moment-badge] [data-exchange-offer]');
    await page.waitForSelector('.photo-exchanges:not([hidden]) .exchange-pair', { timeout: 20000 });
    await L.sleep(800);
    await page.check('.photo-exchanges:not([hidden]) input[data-x-consent]', { force: true });
    await page.waitForFunction(() => { const b = document.querySelector('.photo-exchanges:not([hidden]) [data-x-send]'); return b && !b.disabled; }, null, { timeout: 30000 });
    const sendLabel = await page.evaluate(() => document.querySelector('.photo-exchanges:not([hidden]) [data-x-send]')?.textContent.trim());
    await L.shot(page, `${DIR}/06-exchange-consent-${kind}.png`);
    await L.press(run, '.photo-exchanges:not([hidden]) [data-x-send]');
    step('sent', { sendLabel });
    await page.waitForFunction(() => /交换已接受/.test(document.querySelector('.photo-exchanges:not([hidden])')?.textContent || ''), null, { timeout: 60000 });
    step('accepted');
    await L.sleep(1800);
    await L.toastGone(page);
    await L.shot(page, `${DIR}/07-accepted-${kind}.png`);
    await L.sleep(1500); // let any late request land in the log
  } catch (e) {
    fail('EXCEPTION ' + e.message.split('\n')[0]);
  } finally {
    const log = run?.log || {};
    Object.assign(out, { trace: log.trace, requests: log.requests, api: log.api, foreign: log.foreign, failedRequests: log.failedRequests, consoleErrors: log.consoleErrors, pageErrors: log.pageErrors, consoleWarnings: log.consoleWarnings });
    for (const k of ['api', 'foreign', 'failedRequests', 'consoleErrors', 'pageErrors']) if (out[k]?.length) fail(`${k}: ${JSON.stringify(out[k].slice(0, 5))}`);
    if (!out.steps.some(s => s.name === 'accepted')) fail('did not reach 交换已接受');
    out.ok = !out.failures.length;
    out.seconds = (Date.now() - t0) / 1000;
    fs.writeFileSync(`${DIR}/walk-${kind}.json`, JSON.stringify(out, null, 1));
    console.log(kind, 'requests', out.requests, 'api', out.api?.length, 'foreign', out.foreign?.length, 'failed', out.failedRequests?.length, 'consoleErrors', out.consoleErrors?.length, 'pageErrors', out.pageErrors?.length);
    console.log(kind, out.ok ? 'RESULT: PASS' : `RESULT: FAIL ${JSON.stringify(out.failures)}`);
    await browser.close();
    process.exit(out.ok ? 0 : 1);
  }
})();
