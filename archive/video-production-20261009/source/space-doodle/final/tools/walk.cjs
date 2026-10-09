// Final judge-route walk on a production build: first screen -> join -> room -> upload (AI) -> wall badge -> exchange accepted
// -> chat -> about. Records every request (fails on /api or a foreign host), console errors and page errors.
//   SPACE_URL=http://127.0.0.1:4783/musicSpace/ node walk.cjs <phone|desktop> [outdir] [label]
const L = require('./lib.cjs');
const fs = require('fs');
L.watchdog(285);
const kind = process.argv[2] || 'phone';
const OUT = process.argv[3] || '/tmp/space-doodle/final';
const label = process.argv[4] || '';
const BASE = process.env.SPACE_URL || 'http://127.0.0.1:4783/musicSpace/';
const origin = new URL(BASE).origin;
const log = { kind, base: BASE, steps: [], api: [], foreign: [], consoleErrors: [], pageErrors: [], failedRequests: [], requests: 0 };
const t0 = Date.now();
const step = (name, extra = {}) => { const s = { name, t: ((Date.now() - t0) / 1000).toFixed(1), ...extra }; log.steps.push(s); console.log(kind, JSON.stringify(s)); };
async function shot(page, name) {
  await page.evaluate(() => document.activeElement?.blur?.()).catch(() => {});
  // a transient toast over the header is not part of the screen being recorded
  await page.waitForFunction(() => { const t = document.querySelector('#toast'); if (!t || !t.textContent.trim()) return true; const cs = getComputedStyle(t); return cs.visibility === 'hidden' || +cs.opacity < 0.05 || !t.getClientRects().length; }, null, { timeout: 6000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await L.sleep(700);
  const file = `${OUT}/${label}${name}-${kind}.png`;
  await page.screenshot({ path: file });
  step('shot', { file });
}
async function openKind(page, k, id) {
  await page.evaluate(([k, i]) => { const b = document.createElement('button'); b.dataset.open = k; if (i) b.dataset.id = i; b.style.position = 'fixed'; b.style.left = '-9999px'; document.body.append(b); b.click(); b.remove(); }, [k, id]);
  await L.sleep(1000);
}
(async () => {
  const browser = await L.launch();
  let exitCode = 0;
  try {
    const context = await browser.newContext({ ...L.VP[kind], locale: 'zh-CN' });
    const page = await context.newPage();
    page.setDefaultTimeout(45000);
    page.on('request', r => {
      log.requests++;
      const u = new URL(r.url());
      if (u.protocol === 'data:' || u.protocol === 'blob:') return;
      if (/\/api(\/|$)/.test(u.pathname)) log.api.push(r.method() + ' ' + r.url());
      if ((u.protocol === 'http:' || u.protocol === 'https:') && u.origin !== origin) log.foreign.push(r.url());
    });
    page.on('requestfailed', r => log.failedRequests.push(`${r.url()} ${r.failure()?.errorText}`));
    page.on('response', r => { if (r.status() >= 400) log.failedRequests.push(`${r.status()} ${r.url()}`); });
    page.on('console', m => { if (m.type() === 'error') log.consoleErrors.push(m.text().slice(0, 300)); });
    page.on('pageerror', e => log.pageErrors.push(String(e.message).slice(0, 300)));
    const run = { page, kind, touch: Boolean(L.VP[kind].hasTouch) };

    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 120000 });
    await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 60000 }).catch(() => {});
    step('ready');
    await L.sleep(1500);
    await shot(page, '01-first-screen');

    await L.press(run, '#join');
    await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 30000 });
    await L.sleep(800);
    await shot(page, '02-join');
    await page.check('form[data-form="demo-entry"] input[name="consent"]', { force: true });
    await page.waitForFunction(() => { const b = document.querySelector('form[data-form="demo-entry"] button[type="submit"]'); return b && !b.disabled; }, null, { timeout: 90000 });
    await L.press(run, 'form[data-form="demo-entry"] button[type="submit"]');
    await page.waitForSelector('[data-tour-action="sample:sample-crowd"]', { timeout: 60000 });
    await page.waitForFunction(() => document.querySelectorAll('#hotspots [data-kind="person"]').length > 1, null, { timeout: 30000 }).catch(() => step('few people'));
    await L.sleep(2500);
    step('joined', { people: await page.evaluate(() => [...document.querySelectorAll('#hotspots [data-kind="person"]')].map(n => n.textContent.trim())) });
    await shot(page, '03-room');

    await L.press(run, '[data-tour-action="sample:sample-crowd"]');
    await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
    const settled = await L.aiSettled(page);
    await L.sleep(800);
    const ai = await page.evaluate(() => ({ key: document.querySelector('form[data-form="upload"] [data-ai-line]')?.getAttribute('data-ai-key'), line: document.querySelector('form[data-form="upload"] [data-ai-line]')?.textContent.trim(), chosen: document.querySelector('form[data-form="upload"] .moment-chip[aria-pressed="true"]')?.textContent.trim() || null }));
    step('upload', { settled, ...ai });
    await shot(page, '04-upload');
    if (!ai.chosen) await L.press(run, 'form[data-form="upload"] .moment-chip[data-moment-viewpoint="crowd"]');
    await L.press(run, 'form[data-form="upload"] button[type="submit"]');
    await page.locator('#panel [data-moment-badge] [data-exchange-offer]').first().waitFor({ state: 'attached', timeout: 45000 });
    await page.waitForFunction(() => [...document.querySelectorAll('#panel .moment-card img')].every(i => i.complete && i.naturalWidth), null, { timeout: 30000 }).catch(() => {});
    await L.sleep(1800);
    step('wall', await page.evaluate(() => ({ badge: document.querySelector('#panel .moment-badge__title')?.textContent.trim(), reason: document.querySelector('#panel .moment-badge__reason')?.textContent.trim(), offer: document.querySelector('#panel [data-exchange-offer]')?.textContent.trim() })));
    await shot(page, '05-wall');

    await L.press(run, '#panel [data-moment-badge] [data-exchange-offer]');
    await page.waitForSelector('.photo-exchanges:not([hidden]) .exchange-pair', { timeout: 20000 });
    await L.sleep(800);
    await page.check('.photo-exchanges:not([hidden]) input[data-x-consent]', { force: true });
    await page.waitForFunction(() => { const b = document.querySelector('.photo-exchanges:not([hidden]) [data-x-send]'); return b && !b.disabled; }, null, { timeout: 30000 });
    await L.press(run, '.photo-exchanges:not([hidden]) [data-x-send]');
    step('sent');
    await page.waitForFunction(() => /交换已接受/.test(document.querySelector('.photo-exchanges:not([hidden])')?.textContent || ''), null, { timeout: 60000 });
    await L.sleep(1500);
    step('accepted');
    await shot(page, '06-accepted');

    // chat: wave to 阿遥 from the person card, wait for her to accept, open the private thread, say something, read the reply
    await page.evaluate(() => document.querySelector('.photo-exchanges:not([hidden]) [data-x-close]')?.click());
    await L.sleep(600);
    const ayao = await page.evaluate(() => { const n = [...document.querySelectorAll('#hotspots [data-kind="person"]')].find(x => x.textContent.includes('阿遥')); return n ? n.dataset.sceneTarget : null; });
    await openKind(page, 'person', ayao);
    const wave = page.locator('#panel-body [data-social-send]');
    if (await wave.count()) { await wave.first().click(); step('waved'); }
    let friends = false;
    for (let i = 0; i < 20 && !friends; i++) { await L.sleep(1000); friends = await page.evaluate(() => /私聊|发消息|聊天/.test(document.querySelector('#panel-body')?.textContent || '')); if (!friends && i % 4 === 3) await openKind(page, 'person', ayao); }
    step('friend', { friends });
    await openKind(page, 'chats', ayao);
    await page.waitForSelector('.private-chat:not([hidden]) textarea', { timeout: 20000 });
    await page.locator('.private-chat textarea').fill('刚刚返场那首我也拍到了！你在哪个位置？');
    await page.locator('.private-chat .chat-composer button[type=submit]').click();
    const before = await page.evaluate(() => document.querySelectorAll('.private-chat .chat-messages > *').length);
    await page.waitForFunction(n => document.querySelectorAll('.private-chat .chat-messages > *').length > n + 1, before, { timeout: 30000 }).catch(() => step('no reply seen'));
    await L.sleep(1500);
    await shot(page, '07-chat');
    await page.evaluate(() => document.querySelector('.private-chat:not([hidden]) .chat-close')?.click());
    await L.sleep(600);

    // about: the footer button
    const about = page.locator('footer button:visible, footer a:visible').filter({ hasText: '关于这个示例' });
    if (await about.count()) { if (run.touch) await about.first().tap(); else await about.first().click(); } else await openKind(page, 'about');
    await page.waitForFunction(() => /关于这个示例/.test(document.querySelector('#panel:not([hidden])')?.textContent || ''), null, { timeout: 20000 });
    await L.sleep(800);
    await shot(page, '08-about');
    step('done');
  } catch (e) {
    exitCode = 1;
    step('FAILED', { error: e.message.split('\n')[0] });
  } finally {
    log.seconds = (Date.now() - t0) / 1000;
    fs.writeFileSync(`${OUT}/${label}walk-${kind}.json`, JSON.stringify(log, null, 1));
    console.log(kind, 'requests', log.requests, 'api', log.api.length, 'foreign', log.foreign.length, 'consoleErrors', log.consoleErrors.length, 'pageErrors', log.pageErrors.length, 'failed', log.failedRequests.length);
    for (const k of ['api', 'foreign', 'consoleErrors', 'pageErrors', 'failedRequests']) if (log[k].length) console.log(kind, k, JSON.stringify(log[k].slice(0, 8)));
    await browser.close();
    process.exit(exitCode);
  }
})();
