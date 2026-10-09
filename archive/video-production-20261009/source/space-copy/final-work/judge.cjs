// Judge route on a production build served under /musicSpace/ (read-only on the repo).
//   node judge.cjs <phone|desktop|narrow> [baseUrl]
// Walks doodle.md §5: 进入现场 → consent → 进入现场 → 第一次来 「人海那张」 → upload → 保存这张照片 → wall → 和 TA 交换这个视角 → consent →
// 把这两张交给对方确认 ↗ → 交换已接受; then a chat reply (招个手 → 私聊 → reply), About, and the nav/top buttons. Records every network request
// (no /api, no third party), console errors, page errors, failed responses; dumps the visible text of every screen for a copy scan.
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const kind = process.argv[2] || 'phone';
const BASE = process.argv[3] || 'http://127.0.0.1:5471/musicSpace/';
const OUT = process.env.OUT_DIR ? `${process.env.OUT_DIR}/${kind}` : `/tmp/space-copy/final-work/shots/${kind}`;
fs.mkdirSync(OUT, { recursive: true });
const VP = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  narrow: { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
const watchdog = setTimeout(() => { console.log('WATCHDOG: giving up'); finish(3); }, 280000); watchdog.unref();
const report = { kind, base: BASE, steps: [], api: [], thirdParty: [], failedResponses: [], consoleErrors: [], consoleWarnings: [], pageErrors: [], programmaticClicks: [], texts: {} };
let browser;
async function finish(code) {
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  try { await browser?.close(); } catch {}
  process.exit(code);
}
function step(name, ok, detail = '') { report.steps.push({ name, ok, detail, t: ((Date.now() - t0) / 1000).toFixed(1) }); log(ok ? 'OK  ' : 'FAIL', name, detail); }
async function shot(page, label) { await sleep(350); await page.screenshot({ path: `${OUT}/${label}.png` }); }
async function grab(page, label, selector = 'body') {
  const text = await page.evaluate(sel => {
    const out = [];
    for (const root of document.querySelectorAll(sel)) {
      if (!root.getClientRects().length) continue;
      out.push(root.innerText);
      for (const el of [root, ...root.querySelectorAll('*')]) {
        if (!el.getClientRects().length) continue;
        for (const a of ['aria-label', 'title', 'placeholder', 'alt', 'data-confirm']) { const v = el.getAttribute(a); if (v && /[一-鿿]/.test(v)) out.push(`@${a}: ${v}`); }
      }
    }
    return out.join('\n');
  }, selector);
  report.texts[label] = text;
  return text;
}
/** A real tap/click on the first visible match; falls back to a DOM click (recorded) when the element cannot be hit. */
async function act(page, selector, label, { timeout = 30000 } = {}) {
  const loc = page.locator(selector).filter({ visible: true }).first();
  await loc.waitFor({ state: 'visible', timeout });
  const text = (await loc.innerText().catch(() => '')).trim().replace(/\s+/g, ' ');
  try {
    await loc.scrollIntoViewIfNeeded({ timeout: 5000 });
    if (VP[kind].hasTouch) await loc.tap({ timeout: 8000 }); else await loc.click({ timeout: 8000 });
  } catch (error) {
    report.programmaticClicks.push({ label, selector, why: String(error.message).split('\n')[0].slice(0, 200) });
    log('programmatic click for', label, String(error.message).split('\n')[0].slice(0, 160));
    await loc.evaluate(el => el.click());
  }
  return text;
}
const panelKind = page => page.evaluate(() => { const p = document.querySelector('#panel'); return p && !p.hidden ? p.dataset.kind : null; });
async function closeSheet(page) {
  const close = page.locator('#panel-close').filter({ visible: true }).first();
  if (await close.count()) { if (VP[kind].hasTouch) await close.tap().catch(() => close.evaluate(el => el.click())); else await close.click().catch(() => close.evaluate(el => el.click())); }
  await sleep(500);
}

(async () => {
  browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const context = await browser.newContext({ ...VP[kind], locale: 'zh-CN' });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  const base = new URL(BASE);
  page.on('request', req => {
    const u = new URL(req.url());
    if (!/^https?:$/.test(u.protocol)) return;
    if (/(^|\/)api(\/|$)/.test(u.pathname)) report.api.push(`${req.method()} ${u.pathname}`);
    if (u.host !== base.host) report.thirdParty.push(req.url().slice(0, 160));
  });
  page.on('response', res => { if (res.status() >= 400) report.failedResponses.push(`${res.status()} ${res.url().slice(0, 160)}`); });
  page.on('requestfailed', req => report.failedResponses.push(`FAILED ${req.failure()?.errorText} ${req.url().slice(0, 160)}`));
  page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push(m.text().slice(0, 300)); else if (m.type() === 'warning') report.consoleWarnings.push(m.text().slice(0, 300)); });
  page.on('pageerror', e => report.pageErrors.push(String(e.message).slice(0, 300)));

  // 1. boot
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 120000 });
  await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 60000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await sleep(1200);
  step('boot ready', true, `__SPACE_BOOT__=ready, visibility=${await page.evaluate(() => document.visibilityState)}`);
  await grab(page, 'lobby'); await shot(page, '01-lobby');

  // 2. 进入现场 → entry sheet
  const joinText = await act(page, '#join', 'join (lobby)');
  await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 30000 });
  await sleep(700);
  step('lobby button', joinText === '进入现场', `#join reads 「${joinText}」`);
  await grab(page, 'entry', '#panel'); await shot(page, '02-entry');
  // the host details
  await page.evaluate(() => { const d = document.querySelector('#panel details.demo-entry-more'); if (d) d.open = true; });
  await sleep(300); await grab(page, 'entry-more', '#panel');
  await page.evaluate(() => { const d = document.querySelector('#panel details.demo-entry-more'); if (d) d.open = false; });

  // 3. consent → 进入现场
  await act(page, 'form[data-form="demo-entry"] label.consent', 'entry consent label');
  const checked = await page.isChecked('form[data-form="demo-entry"] input[name="consent"]');
  if (!checked) await page.check('form[data-form="demo-entry"] input[name="consent"]', { force: true });
  step('entry consent', true, `checked by tapping the label: ${checked}`);
  await page.waitForFunction(() => { const b = document.querySelector('form[data-form="demo-entry"] button[type="submit"]'); return b && !b.disabled; }, null, { timeout: 90000 });
  const enterText = await act(page, 'form[data-form="demo-entry"] button[type="submit"]', 'entry submit');
  step('entry submit', enterText === '进入现场', `submit reads 「${enterText}」`);

  // 4. 第一次来 card → 人海那张
  await page.waitForSelector('[data-tour-action="sample:sample-crowd"]', { timeout: 60000 });
  await sleep(1500);
  const tourTitle = await page.evaluate(() => document.querySelector('.demo-tour-title')?.innerText.replace(/\s+/g, ' ').trim());
  step('tour card', /^第一次来 1\/4/.test(tourTitle || ''), `title 「${tourTitle}」`);
  await grab(page, 'room-tour'); await shot(page, '03-room-tour');
  const status = await page.evaluate(() => document.querySelector('#render-status')?.innerText.trim());
  report.texts['render-status'] = status;
  const sampleText = await act(page, '[data-tour-action="sample:sample-crowd"]', 'tour 人海那张');
  step('tour sample button', sampleText === '人海那张', `button reads 「${sampleText}」`);

  // 5. upload form with the sample photo, AI settles
  await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
  const ai = await page.waitForFunction(() => /^(sure|unsure|off)/.test(document.querySelector('form[data-form="upload"] [data-ai-line]')?.getAttribute('data-ai-key') || ''), null, { timeout: 90000 }).then(() => true).catch(() => false);
  await sleep(600);
  const aiKey = await page.evaluate(() => document.querySelector('form[data-form="upload"] [data-ai-line]')?.getAttribute('data-ai-key'));
  const aiLine = await page.evaluate(() => document.querySelector('form[data-form="upload"] [data-ai-line]')?.innerText.trim());
  step('upload AI settled', ai, `data-ai-key=${aiKey}; line 「${aiLine}」`);
  await grab(page, 'upload', '#panel'); await shot(page, '04-upload');
  await page.evaluate(() => { const p = document.querySelector('#panel'); p.scrollTop = p.scrollHeight; }); await sleep(300); await shot(page, '04-upload-end');
  const pressed = await page.evaluate(() => Boolean(document.querySelector('form[data-form="upload"] .moment-chip[aria-pressed="true"]')));
  if (!pressed) { await act(page, 'form[data-form="upload"] .moment-chip[data-moment-viewpoint="crowd"]', 'viewpoint chip 人海'); }
  const saveText = await act(page, 'form[data-form="upload"] button[type="submit"]', 'upload save');
  step('upload save button', saveText === '保存这张照片', `submit reads 「${saveText}」 (a viewpoint was ${pressed ? 'preselected' : 'picked by hand'})`);

  // 6. wall with the pairing → 和 TA 交换这个视角
  let offer = await page.locator('#panel [data-exchange-offer]').first().waitFor({ state: 'visible', timeout: 30000 }).then(() => true).catch(() => false);
  const afterSave = await panelKind(page);
  if (!offer) {
    step('wall after save', false, `panel after save: ${afterSave}; opening the wall from the nav`);
    await page.evaluate(() => { const o = document.createElement('button'); o.dataset.open = 'wall'; o.style.position = 'fixed'; o.style.left = '-9999px'; document.body.append(o); o.click(); o.remove(); });
    offer = await page.locator('#panel [data-exchange-offer]').first().waitFor({ state: 'visible', timeout: 30000 }).then(() => true).catch(() => false);
  } else step('wall after save', true, `panel after save: ${afterSave}`);
  await sleep(800);
  await grab(page, 'wall', '#panel'); await shot(page, '05-wall');
  if (!offer) throw new Error('no exchange offer on the wall');
  const offerText = await act(page, '#panel [data-exchange-offer]', 'wall exchange offer');
  step('wall offer button', offerText === '和 TA 交换这个视角', `button reads 「${offerText}」`);

  // 7. exchange compose: consent → 把这两张交给对方确认 ↗
  await page.waitForSelector('.photo-exchanges:not([hidden]) [data-x-consent]', { timeout: 30000 });
  await sleep(800);
  await grab(page, 'exchange-compose', '.photo-exchanges'); await shot(page, '06-exchange-compose');
  await act(page, '.photo-exchanges [data-x-consent]', 'exchange consent');
  await page.waitForFunction(() => { const b = document.querySelector('.photo-exchanges [data-x-send]'); return b && !b.disabled; }, null, { timeout: 30000 });
  const sendText = await act(page, '.photo-exchanges [data-x-send]', 'exchange send');
  const sentAt = Date.now();
  step('exchange send button', sendText === '把这两张交给对方确认 ↗', `button reads 「${sendText}」`);
  await page.waitForSelector('.photo-exchanges .exchange-status', { timeout: 30000 });
  await sleep(300);
  await grab(page, 'exchange-pending', '.photo-exchanges'); await shot(page, '07-exchange-pending');
  const accepted = await page.waitForFunction(() => /交换已接受/.test(document.querySelector('.photo-exchanges .exchange-status')?.innerText || ''), null, { timeout: 45000 }).then(() => true).catch(() => false);
  const statusText = await page.evaluate(() => document.querySelector('.photo-exchanges .exchange-status')?.innerText.trim());
  step('exchange accepted', accepted, `status 「${statusText}」 after ${((Date.now() - sentAt) / 1000).toFixed(1)} s`);
  await sleep(1500);
  await grab(page, 'exchange-accepted', '.photo-exchanges'); await shot(page, '08-exchange-accepted');
  await page.locator('.photo-exchanges [data-x-close]').first().evaluate(el => el.click()).catch(() => {});
  await sleep(800);
  if (await panelKind(page)) await closeSheet(page);
  await grab(page, 'room-after-exchange'); await shot(page, '09-room-after-exchange');
  report.texts['render-status-after'] = await page.evaluate(() => document.querySelector('#render-status')?.innerText.trim());

  // 8. chat reply: people → an open member → 招个手 → accepted → 私聊 → write → reply
  await page.evaluate(() => { const o = document.createElement('button'); o.dataset.open = 'people'; o.style.position = 'fixed'; o.style.left = '-9999px'; document.body.append(o); o.click(); o.remove(); });
  await page.waitForFunction(() => document.querySelector('#panel')?.dataset.kind === 'people' && !document.querySelector('#panel').hidden, null, { timeout: 15000 });
  await sleep(700);
  await grab(page, 'people', '#panel'); await shot(page, '10-people');
  const people = await page.evaluate(() => [...document.querySelectorAll('#panel [data-person], #panel [data-open="person"]')].map(b => ({ id: b.dataset.person || b.dataset.id, text: b.innerText.replace(/\s+/g, ' ').trim() })));
  report.texts['people-list'] = JSON.stringify(people);
  const target = people.find(p => /北屿/.test(p.text)) || people.find(p => /小满/.test(p.text));
  if (!target) throw new Error('no open cast member in the people list: ' + JSON.stringify(people));
  const sel = `#panel [data-person="${target.id}"], #panel [data-open="person"][data-id="${target.id}"]`;
  await act(page, sel, `people → ${target.text}`);
  await page.waitForFunction(() => document.querySelector('#panel')?.dataset.kind === 'person' && !document.querySelector('#panel').hidden, null, { timeout: 20000 });
  await page.waitForSelector('#panel [data-social-send]', { timeout: 20000 }).catch(() => {});
  await sleep(600);
  await grab(page, 'person', '#panel'); await shot(page, '11-person');
  const waveText = await act(page, '#panel [data-social-send]', 'person wave');
  step('wave button', /^向 .+ 招个手$/.test(waveText), `button reads 「${waveText}」`);
  await sleep(800);
  await grab(page, 'person-waved', '#panel'); await shot(page, '12-person-waved');
  // the cast member accepts after a few seconds: the person sheet turns into friends
  const friends = await page.waitForFunction(() => /你们已经是朋友了|私聊/.test(document.querySelector('#panel')?.innerText || '') && !/等待对方回应/.test(document.querySelector('#panel')?.innerText || ''), null, { timeout: 30000 }).then(() => true).catch(() => false);
  await sleep(600);
  await grab(page, 'person-friend', '#panel'); await shot(page, '13-person-friend');
  step('wave accepted', friends, (await page.evaluate(() => document.querySelector('#panel')?.innerText.replace(/\n+/g, ' | ').slice(0, 300))) || '');
  // open the private chat with them
  const chatButton = page.locator('#panel [data-open="chat"], #panel [data-chat-open], #panel [data-open="chats"]').filter({ visible: true }).first();
  if (await chatButton.count()) await act(page, '#panel [data-open="chat"], #panel [data-chat-open], #panel [data-open="chats"]', 'person → chat');
  else await page.evaluate(() => { const o = document.createElement('button'); o.dataset.open = 'chats'; o.style.position = 'fixed'; o.style.left = '-9999px'; document.body.append(o); o.click(); o.remove(); });
  await page.waitForSelector('.private-chat:not([hidden]), section.private-chat', { timeout: 15000 }).catch(() => {});
  await sleep(1200);
  const inThread = await page.evaluate(() => { const t = document.querySelector('.chat-thread'); return t && !t.hidden; });
  if (!inThread) { await act(page, `[data-chat-peer="${target.id}"]`, 'chat list → thread'); await sleep(1000); }
  const welcome = await page.waitForFunction(() => /你拍到的是哪一面/.test(document.querySelector('.chat-messages')?.innerText || ''), null, { timeout: 30000 }).then(() => true).catch(() => false);
  step('welcome lines', welcome, (await page.evaluate(() => document.querySelector('.chat-messages')?.innerText.replace(/\n+/g, ' | ').slice(0, 300))) || '');
  await grab(page, 'chat-welcome', '.private-chat'); await shot(page, '14-chat-welcome');
  await page.locator('#chat-text').fill('我在二楼拍到了人海，你呢？');
  await act(page, '.chat-composer button[type="submit"]', 'chat send');
  const replied = await page.waitForFunction(() => /今晚的返场太好听了/.test(document.querySelector('.chat-messages')?.innerText || ''), null, { timeout: 30000 }).then(() => true).catch(() => false);
  await sleep(800);
  step('chat reply', replied, (await page.evaluate(() => document.querySelector('.chat-messages')?.innerText.replace(/\n+/g, ' | ').slice(0, 400))) || '');
  await grab(page, 'chat-reply', '.private-chat'); await shot(page, '15-chat-reply');
  await page.locator('.private-chat .chat-close').first().evaluate(el => el.click()).catch(() => {});
  await sleep(800);
  if (await panelKind(page)) await closeSheet(page);

  // 9. About (footer button) — the one disclosure
  await page.evaluate(() => { const o = document.createElement('button'); o.dataset.open = 'about'; o.style.position = 'fixed'; o.style.left = '-9999px'; document.body.append(o); o.click(); o.remove(); });
  await page.waitForFunction(() => /关于 Music Space/.test(document.querySelector('#panel')?.innerText || ''), null, { timeout: 15000 }).catch(() => {});
  await sleep(600);
  await grab(page, 'about', '#panel'); await shot(page, '16-about');
  await page.evaluate(() => { const p = document.querySelector('#panel'); p.scrollTop = p.scrollHeight; }); await sleep(300); await shot(page, '16-about-end');
  await closeSheet(page);

  // 10. the other screens of §5 (bottom nav and top buttons), text only, through their own buttons when visible
  report.visibleNav = await page.evaluate(() => [...document.querySelectorAll('button')].filter(b => b.getClientRects().length && !b.closest('#panel')).map(b => `${b.id || b.dataset.view || b.dataset.open || ''}:${(b.innerText || b.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim()}`));
  for (const [label, selector] of [['room-info', '#room-info'], ['social-inbox', '#social-inbox'], ['my-look', '#my-look'], ['room-panel', '#join'], ['my-space', '#my-space'], ['people-view', 'button[data-view="person"]'], ['photos-view', 'button[data-view="photos"]'], ['overview', 'button[data-view="overview"]'], ['music-explore', '#music-map-entry']]) {
    const visible = await page.locator(selector).filter({ visible: true }).count();
    if (!visible) { report.texts[`nav-${label}`] = '(not visible)'; continue; }
    const before = report.pageErrors.length + report.consoleErrors.length;
    await act(page, selector, `nav ${label}`, { timeout: 5000 }).catch(e => log('nav fail', label, e.message.split('\n')[0]));
    await sleep(1800);
    await grab(page, `nav-${label}`); await shot(page, `20-${label}`);
    if (report.pageErrors.length + report.consoleErrors.length > before) log('errors after', label);
    // close whatever opened: the sheet, a dialog section, the music map, the wardrobe
    if (await panelKind(page)) await closeSheet(page);
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(500);
    for (const close of ['.private-chat:not([hidden]) .chat-close', '.photo-exchanges:not([hidden]) [data-x-close]', '.community-panel:not([hidden]) [data-group="close"]', '[data-map-close]', '.wardrobe:not([hidden]) [data-wardrobe-cancel]']) {
      const c = page.locator(close).filter({ visible: true }).first();
      if (await c.count()) { await c.evaluate(el => el.click()).catch(() => {}); await sleep(400); }
    }
  }
  // back from the Music Map page to the room
  const back = page.locator('.space-map-return button').filter({ visible: true }).first();
  if (await back.count()) {
    await act(page, '.space-map-return button', 'map ← 返回现场');
    const again = await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 }).then(() => true).catch(() => false);
    await sleep(2500);
    step('return from music map', again, `url ${page.url()}`);
    await grab(page, 'room-after-map'); await shot(page, '21-room-after-map');
  } else step('return from music map', false, 'no return bar visible');
  step('done', true, `${report.api.length} /api requests, ${report.thirdParty.length} third-party, ${report.consoleErrors.length} console errors, ${report.pageErrors.length} page errors`);
  await context.close();
  await finish(0);
})().catch(async e => { step('exception', false, String(e.message).split('\n')[0].slice(0, 300)); await finish(1); });
