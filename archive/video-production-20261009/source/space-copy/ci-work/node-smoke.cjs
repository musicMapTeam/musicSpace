// Node room service smoke (/event-room/ on a throwaway server with a fresh DATA_DIR): a host opens a room and uploads a photo; a guest
// opens the invite link, joins and uploads. Dumps the visible copy of every screen for the real-room wording check.
//   node node-smoke.cjs [base=http://127.0.0.1:8931/event-room/]
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const BASE = process.argv[2] || 'http://127.0.0.1:8931/event-room/';
const OUT = '/tmp/space-copy/ci-work/shots/node';
fs.mkdirSync(OUT, { recursive: true });
const VP = { desktop: { viewport: { width: 1440, height: 900 } }, phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
const report = { steps: [], consoleErrors: [], pageErrors: [], failedResponses: [], toasts: [], texts: {} };
let browser;
const watchdog = setTimeout(() => { console.log('WATCHDOG'); finish(3); }, 270000); watchdog.unref();
async function finish(code) { fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2)); try { await browser?.close(); } catch {} process.exit(code); }
function step(name, ok, detail = '') { report.steps.push({ name, ok, detail }); log(ok ? 'OK  ' : 'FAIL', name, detail); }
async function grab(page, label, selector = 'body') {
  const text = await page.evaluate(sel => { const out = []; for (const root of document.querySelectorAll(sel)) { if (!root.getClientRects().length) continue; out.push(root.innerText); for (const el of [root, ...root.querySelectorAll('*')]) { if (!el.getClientRects().length) continue; for (const a of ['aria-label', 'title', 'placeholder', 'alt', 'data-confirm']) { const v = el.getAttribute(a); if (v && /[一-鿿]/.test(v)) out.push(`@${a}: ${v}`); } } } return out.join('\n'); }, selector);
  report.texts[label] = text; return text;
}
async function shot(page, label) { await sleep(300); await page.screenshot({ path: `${OUT}/${label}.png` }); }
function watch(page, who) {
  page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push(`${who}: ${m.text().slice(0, 300)}`); });
  page.on('pageerror', e => report.pageErrors.push(`${who}: ${String(e.message).slice(0, 300)}`));
  page.on('response', r => { if (r.status() >= 400) report.failedResponses.push(`${who}: ${r.status()} ${r.request().method()} ${r.url().slice(0, 140)}`); });
}
async function toastWatch(page, who) {
  await page.exposeFunction('__toast', t => report.toasts.push(`${who}: ${t}`));
  await page.addInitScript(() => {
    const seen = new Set();
    new MutationObserver(() => {
      for (const n of document.querySelectorAll('[role="status"],[role="alert"],.toast,#toast')) { const t = n.textContent.trim(); if (t && !seen.has(t) && n.getClientRects().length) { seen.add(t); window.__toast(t); } }
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });
}
const clickHidden = (page, dataset) => page.evaluate(dataset => { const o = document.createElement('button'); Object.assign(o.dataset, dataset); o.style.position = 'fixed'; o.style.left = '-9999px'; document.body.append(o); o.click(); o.remove(); }, dataset);
/** A JPEG with no EXIF, drawn in the page (like a screenshot or a messenger-forwarded photo). */
async function canvasJpeg(page) {
  const data = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 960; c.height = 720; const g = c.getContext('2d'); const grad = g.createLinearGradient(0, 0, 960, 720); grad.addColorStop(0, '#1b1030'); grad.addColorStop(1, '#ff5a8a'); g.fillStyle = grad; g.fillRect(0, 0, 960, 720); g.fillStyle = '#ffd84d'; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(100 + i * 95, 160, 30, 0, Math.PI * 2); g.fill(); } g.fillStyle = '#111'; g.fillRect(0, 520, 960, 200); return c.toDataURL('image/jpeg', 0.85).split(',')[1]; });
  return Buffer.from(data, 'base64');
}
async function upload(page, who, file, label) {
  await clickHidden(page, { open: 'upload' });
  await page.waitForSelector('form[data-form="upload"] input[name="photo"]', { state: 'attached', timeout: 20000 });
  await sleep(500);
  await grab(page, `${who}-upload-empty`, '#panel'); await shot(page, `${who}-upload-empty`);
  await page.setInputFiles('form[data-form="upload"] input[name="photo"]', file);
  await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
  await page.waitForFunction(() => /^(sure|unsure|off)/.test(document.querySelector('form[data-form="upload"] [data-ai-line]')?.getAttribute('data-ai-key') || ''), null, { timeout: 90000 }).catch(() => {});
  await sleep(600);
  const aiKey = await page.evaluate(() => document.querySelector('form[data-form="upload"] [data-ai-line]')?.getAttribute('data-ai-key'));
  if (!(await page.evaluate(() => Boolean(document.querySelector('form[data-form="upload"] .moment-chip[aria-pressed="true"]'))))) await page.locator('form[data-form="upload"] .moment-chip').first().evaluate(b => b.click());
  await page.selectOption('form[data-form="upload"] select[name="visibility"]', 'members');
  await sleep(300);
  await grab(page, `${who}-upload-${label}`, '#panel'); await shot(page, `${who}-upload-${label}`);
  await page.evaluate(() => { const p = document.querySelector('#panel'); p.scrollTop = p.scrollHeight; }); await sleep(250); await shot(page, `${who}-upload-${label}-end`);
  const before = await page.evaluate(() => document.querySelectorAll('#panel [data-photo]').length);
  await page.locator('form[data-form="upload"] button[type="submit"]').evaluate(b => b.click());
  const saved = await page.waitForFunction(() => document.querySelector('#panel')?.dataset.kind === 'wall' || /已保存|已分享|已上墙|照片墙/.test(document.querySelector('#toast,.toast,[role="status"]')?.textContent || ''), null, { timeout: 30000 }).then(() => true).catch(() => false);
  await sleep(1500);
  step(`${who} upload (${label})`, saved, `ai=${aiKey}; panel=${await page.evaluate(() => document.querySelector('#panel')?.dataset.kind)}; wall photos before ${before}`);
}

(async () => {
  browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  // ---------------- host ----------------
  const hostCtx = await browser.newContext({ ...VP.desktop, locale: 'zh-CN' });
  const host = await hostCtx.newPage(); host.setDefaultTimeout(30000); watch(host, 'host'); await toastWatch(host, 'host');
  await host.goto(BASE, { waitUntil: 'domcontentloaded' });
  await host.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 60000 }).catch(() => log('loading not hidden'));
  await sleep(1500);
  await grab(host, 'host-lobby'); await shot(host, 'host-lobby');
  await host.locator('#join').click(); await sleep(900);
  await grab(host, 'host-entry', '#panel'); await shot(host, 'host-entry');
  await host.locator('#panel [data-open="create"]').click(); await sleep(900);
  await grab(host, 'host-profile', '#panel'); await shot(host, 'host-profile');
  await host.fill('form[data-form="profile"] input[name="name"]', '月台主理人');
  await host.locator('form[data-form="profile"] button[type="submit"]').click(); await sleep(2500);
  await grab(host, 'host-create', '#panel'); await shot(host, 'host-create');
  await host.fill('form[data-form="create"] input[name="title"]', '周五的最后一首');
  await host.fill('form[data-form="create"] input[name="venue"]', '月台 Livehouse');
  await host.check('form[data-form="create"] input[name="consent"]', { force: true });
  await host.locator('form[data-form="create"] button[type="submit"]').click();
  const created = await host.waitForFunction(() => /room=/.test(location.search), null, { timeout: 20000 }).then(() => true).catch(() => false);
  await sleep(3000);
  step('host creates a room', created, host.url());
  await grab(host, 'host-room'); await shot(host, 'host-room');
  await clickHidden(host, { open: 'room' }); await sleep(1200);
  await grab(host, 'host-room-panel', '#panel'); await shot(host, 'host-room-panel');
  const invite = host.url();
  await upload(host, 'host', '/Users/alakazan/workplace/tme/musicSpace/web/static-runtime/demo-assets/sample-crowd.jpg', 'exif');
  await grab(host, 'host-wall', '#panel'); await shot(host, 'host-wall');

  // ---------------- guest (phone) ----------------
  const guestCtx = await browser.newContext({ ...VP.phone, locale: 'zh-CN' });
  const guest = await guestCtx.newPage(); guest.setDefaultTimeout(30000); watch(guest, 'guest'); await toastWatch(guest, 'guest');
  await guest.goto(invite, { waitUntil: 'domcontentloaded' });
  const preview = await guest.waitForFunction(() => document.querySelector('#panel')?.dataset.kind === 'preview' && !document.querySelector('#panel').hidden, null, { timeout: 60000 }).then(() => true).catch(() => false);
  await sleep(1200);
  step('guest sees the invite preview', preview);
  await grab(guest, 'guest-preview', '#panel'); await shot(guest, 'guest-preview');
  await guest.locator('#panel [data-open="profile"]').first().evaluate(b => b.click()); await sleep(900);
  await grab(guest, 'guest-profile', '#panel');
  await guest.fill('form[data-form="profile"] input[name="name"]', '小鹿');
  await guest.locator('form[data-form="profile"] button[type="submit"]').evaluate(b => b.click()); await sleep(2500);
  await grab(guest, 'guest-join', '#panel'); await shot(guest, 'guest-join');
  await guest.check('form[data-form="join"] input[name="consent"]', { force: true });
  await guest.locator('form[data-form="join"] input[name="participation"][value="open"]').check({ force: true });
  await guest.locator('form[data-form="join"] button[type="submit"]').evaluate(b => b.click());
  const joined = await guest.waitForFunction(() => /2 位/.test(document.body.innerText), null, { timeout: 20000 }).then(() => true).catch(() => false);
  await sleep(2500);
  step('guest joins', joined, (await guest.evaluate(() => document.querySelector('.presence')?.innerText.replace(/\n+/g, ' | ').slice(0, 200))) || '');
  await grab(guest, 'guest-room'); await shot(guest, 'guest-room');
  const jpeg = await canvasJpeg(guest);
  await upload(guest, 'guest', { name: 'IMG_0420.jpg', mimeType: 'image/jpeg', buffer: jpeg }, 'noexif');
  await grab(guest, 'guest-wall', '#panel'); await shot(guest, 'guest-wall');
  // host sees the guest's photo on the wall
  await clickHidden(host, { open: 'wall' }); await sleep(3000);
  const hostSees = await host.evaluate(() => document.querySelectorAll('#panel [data-photo]').length);
  step('host wall shows both photos', hostSees >= 2, `${hostSees} photos`);
  await grab(host, 'host-wall-2', '#panel'); await shot(host, 'host-wall-2');
  // host: people, communities (Livehouse 乐迷社群), room chat
  await clickHidden(host, { open: 'people' }); await sleep(1200); await grab(host, 'host-people', '#panel');
  await guest.close(); await host.close();
  step('done', true, `${report.consoleErrors.length} console errors, ${report.pageErrors.length} page errors, ${report.failedResponses.length} failed responses`);
  await finish(0);
})().catch(async e => { step('exception', false, String(e.message).split('\n')[0].slice(0, 300)); await finish(1); });
