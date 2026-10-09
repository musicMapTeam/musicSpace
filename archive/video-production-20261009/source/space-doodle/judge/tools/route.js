// Judge route to 「交换已接受」 on the production static build, counting taps; then the tour's last step (回看这一晚) and a reload.
// usage: node route.js <phone|desktop> <root|preview> [label]
const L = require('./lib.js');
const vp = process.argv[2] || 'phone';
const channel = process.argv[3] || 'root';
const label = process.argv[4] || `route-${channel}-${vp}`;

(async () => {
  const browser = await L.launch();
  const run = await L.open(browser, vp, { label });
  const { page } = run;
  const taps = [];
  const notes = [];
  const tours = [];
  const result = { label, vp, channel, ok: false };
  const note = s => { notes.push(s); console.log('-', s); };
  try {
    await L.clearServerLog();
    const b = await L.boot(page, L.baseUrl(channel));
    note(`boot ${b.state} in ${b.ms} ms`);
    result.static = await page.evaluate(() => { const s = window.__SPACE_STATIC__ || {}; return { channel: s.channel, idbName: s.idbName, writable: s.writable, persistent: s.persistent, memoryOnly: s.memoryOnly, fresh: s.fresh, roomCode: s.roomCode }; });
    await page.evaluate(() => document.fonts.ready);
    await L.sleep(1200);
    await L.shot(run, '01-lobby');

    // 1 「进入示例现场」
    await L.tap(run, page.locator('#join'), '进入示例现场 (lobby)', taps);
    const form = page.locator('form[data-form="demo-entry"]');
    await form.waitFor({ state: 'visible' });
    const t0 = Date.now();
    await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button[type="submit"]')?.disabled, null, { timeout: 60000 });
    note(`entry submit enabled after ${Date.now() - t0} ms`);
    await L.shot(run, '02-entry');
    // 2 consent (tap the visible box/label like a person)
    const consentInput = form.locator('input[name="consent"]');
    const inputVisible = await consentInput.evaluate(el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width >= 8 && r.height >= 8 && cs.opacity !== '0' && cs.visibility !== 'hidden'; });
    await L.tap(run, inputVisible ? consentInput : form.locator('label.consent'), `同意 checkbox (${inputVisible ? 'input' : 'label'})`, taps);
    if (!(await consentInput.isChecked())) note('!! consent not checked after tap');
    // 3 submit
    await L.tap(run, form.locator('button[type="submit"]'), '进入示例现场 (submit)', taps);
    await page.waitForFunction(() => document.querySelector('.frame')?.dataset.stage === 'room', null, { timeout: 30000 });
    const sample = page.locator('[data-tour-action="sample:sample-crowd"]');
    await sample.waitFor({ state: 'visible', timeout: 30000 });
    await L.sleep(800);
    tours.push(['in room', await L.tourText(page)]);
    await L.shot(run, '03-room-tour1');
    // 4 sample crowd
    await L.tap(run, sample, '人海 · 示例照片 (tour)', taps);
    const upload = page.locator('form[data-form="upload"]');
    await upload.waitFor({ state: 'visible' });
    const t1 = Date.now();
    // wait for the model answer (sure tag) or 90 s
    const ai = await page.waitForFunction(() => {
      const line = document.querySelector('form[data-form="upload"] [data-ai-line]');
      const key = line?.getAttribute('data-ai-key') || '';
      return /^(sure|unsure|off)/.test(key) ? key + ' | ' + line.textContent.trim() : false;
    }, null, { timeout: 90000 }).then(h => h.jsonValue()).catch(() => 'timeout');
    note(`AI line after ${Date.now() - t1} ms: ${ai}`);
    result.aiCrowd = ai;
    const chosen = await page.evaluate(() => [...document.querySelectorAll('form[data-form="upload"] .moment-chip')].map(c => `${c.dataset.momentViewpoint}:${c.getAttribute('aria-pressed')}${c.classList.contains('is-ai') ? '(ai)' : ''}`).join(' '));
    note(`chips: ${chosen}`);
    const taken = await page.evaluate(() => document.querySelector('form[data-form="upload"] .moment-taken')?.textContent.trim().replace(/\s+/g, ' ').slice(0, 120));
    note(`taken row: ${taken}`);
    await L.shot(run, '04-upload');
    // 5 save
    const save = upload.locator('button[type="submit"]');
    note(`save button text: ${(await save.innerText()).trim()}`);
    await L.tap(run, save, '保存这张照片', taps);
    // the wall should open by itself
    const offer = page.locator('[data-moment-badge] [data-exchange-offer]').first();
    const wallOk = await offer.waitFor({ state: 'visible', timeout: 30000 }).then(() => true).catch(() => false);
    if (!wallOk) {
      note('!! wall offer button not visible 30 s after save');
      await L.shot(run, '05-after-save-FAIL');
      const panel = await page.evaluate(() => ({ kind: document.querySelector('#panel')?.dataset.kind, hidden: document.querySelector('#panel')?.hidden, text: document.querySelector('#panel-body')?.innerText.slice(0, 300) }));
      note(`panel: ${JSON.stringify(panel)}`);
      throw new Error('no exchange offer on wall');
    }
    await L.sleep(1200);
    await L.shot(run, '05-wall');
    note(`wall offer text: ${(await offer.innerText()).trim()}`);
    // 6 offer
    await L.tap(run, offer, '和 TA 交换这个视角', taps);
    const xc = page.locator('.photo-exchanges [data-x-consent]');
    await xc.waitFor({ state: 'attached', timeout: 20000 });
    await page.waitForFunction(() => document.querySelectorAll('.photo-exchanges .exchange-photo img').length >= 2, null, { timeout: 30000 }).catch(() => note('compose images not both loaded'));
    await L.sleep(600);
    await L.shot(run, '06-compose');
    // 7 consent
    const xcVisible = await xc.evaluate(el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width >= 8 && r.height >= 8 && cs.opacity !== '0' && cs.visibility !== 'hidden'; });
    await L.tap(run, xcVisible ? xc : page.locator('.photo-exchanges .exchange-agreement label'), `交换同意 (${xcVisible ? 'input' : 'label'})`, taps);
    await page.waitForFunction(() => !document.querySelector('.photo-exchanges [data-x-send]')?.disabled, null, { timeout: 20000 });
    // 8 send
    const send = page.locator('.photo-exchanges [data-x-send]');
    note(`send text: ${(await send.innerText()).trim()}`);
    await L.tap(run, send, '把这两张交给对方确认 ↗', taps);
    const t2 = Date.now();
    await page.waitForSelector('.photo-exchanges .exchange-status', { timeout: 20000 });
    await L.shot(run, '07-pending', { settle: 150 });
    await page.waitForFunction(() => /交换已接受/.test(document.querySelector('.photo-exchanges .exchange-status')?.textContent || ''), null, { timeout: 60000 });
    note(`交换已接受 ${Date.now() - t2} ms after send`);
    await page.waitForFunction(() => document.querySelectorAll('.photo-exchanges .exchange-photo img').length >= 2, null, { timeout: 30000 }).catch(() => note('accepted images not both loaded'));
    await L.sleep(1000);
    await L.shot(run, '08-accepted');
    result.ok = true;
    result.tapsToAccepted = taps.length;

    // ---- the tour after the route (item 9) ----
    tours.push(['accepted, exchange panel open', await L.tourText(page)]);
    await page.click('.photo-exchanges [data-x-close]');
    await L.sleep(1500);
    tours.push(['exchange closed', await L.tourText(page)]);
    await L.shot(run, '09-tour-after-exchange');
    const panelState = await page.evaluate(() => ({ kind: document.querySelector('#panel')?.dataset.kind || null, hidden: document.querySelector('#panel')?.hidden }));
    note(`panel after exchange close: ${JSON.stringify(panelState)}`);
    if (!panelState.hidden) { await page.click('#panel-close').catch(() => {}); await L.sleep(1000); tours.push(['wall closed', await L.tourText(page)]); }
    const recapBtn = page.locator('[data-tour-action="open:recap"]');
    if (await recapBtn.isVisible().catch(() => false)) {
      await recapBtn.click();
      await page.waitForSelector('.panel[data-kind="recap"]:not([hidden])', { timeout: 15000 }).catch(() => note('recap panel did not open'));
      await L.sleep(2500);
      await L.shot(run, '10-recap');
      tours.push(['recap open', await L.tourText(page)]);
      await page.click('#panel-close');
      await L.sleep(2000);
      tours.push(['recap closed', await L.tourText(page)]);
      await L.shot(run, '11-tour-after-recap');
      await L.sleep(6000);
      tours.push(['recap closed +6s', await L.tourText(page)]);
    } else note('!! no 回看这一晚 button on the tour card');
    // reload the page (a judge may reload, or the identity guard reloads it)
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
    await L.sleep(4000);
    tours.push(['after reload', await L.tourText(page)]);
    await L.shot(run, '12-tour-after-reload');
  } catch (e) {
    note(`FAILED: ${e.message.split('\n')[0]}`);
    await L.shot(run, 'zz-failure').catch(() => {});
  }
  result.taps = taps;
  result.tours = tours;
  result.notes = notes;
  const net = L.summarizeNet(run);
  result.net = { total: net.total, external: net.external, api: net.api, bad: net.bad, aborted: net.aborted.map(r => r.url), fonts: net.fonts };
  result.console = run.consoleMsgs;
  result.pageErrors = run.pageErrors;
  result.serverLog = await L.serverLog();
  L.writeJson(`${label}.json`, result);
  console.log(JSON.stringify({ taps: taps.map(t => `${t.n}. ${t.desc} [${t.w}x${t.h}${t.inView ? '' : ' SCROLL'}${t.covered ? ' COVERED by ' + t.covered : ''}]`), tours, api: net.api.length, external: net.external.length, bad: net.bad.map(r => `${r.status} ${r.url} ${r.failure || ''}`), console: run.consoleMsgs.map(c => `${c.type}: ${c.text}`), pageErrors: run.pageErrors }, null, 1));
  await browser.close();
})();
