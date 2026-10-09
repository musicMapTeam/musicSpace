// The Livehouse story on the production build: room panel → 散场聊天室 → 这家 Livehouse 的乐迷社群 → join → 下一场预告; plus the
// Livehouse 乐迷社群 list and the recap. Records /api, third-party requests, console and page errors; dumps visible copy.
//   node community.cjs <phone|desktop> [base]
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const kind = process.argv[2] || 'phone';
const BASE = process.argv[3] || 'http://127.0.0.1:5471/musicSpace/';
const OUT = `/tmp/space-copy/ci-work/shots/community-${kind}`;
fs.mkdirSync(OUT, { recursive: true });
const VP = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desktop: { viewport: { width: 1440, height: 900 } } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
const report = { steps: [], api: [], thirdParty: [], consoleErrors: [], pageErrors: [], failedResponses: [], texts: {} };
let browser;
const watchdog = setTimeout(() => { console.log('WATCHDOG'); finish(3); }, 270000); watchdog.unref();
async function finish(code) { fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2)); try { await browser?.close(); } catch {} process.exit(code); }
function step(name, ok, detail = '') { report.steps.push({ name, ok, detail }); log(ok ? 'OK  ' : 'FAIL', name, detail); }
async function grab(page, label, selector = 'body') {
  const text = await page.evaluate(sel => { const out = []; for (const root of document.querySelectorAll(sel)) { if (!root.getClientRects().length) continue; out.push(root.innerText); for (const el of [root, ...root.querySelectorAll('*')]) { if (!el.getClientRects().length) continue; for (const a of ['aria-label', 'title', 'placeholder', 'alt', 'data-confirm']) { const v = el.getAttribute(a); if (v && /[一-鿿]/.test(v)) out.push(`@${a}: ${v}`); } } } return out.join('\n'); }, selector);
  report.texts[label] = text; return text;
}
async function shot(page, label) { await sleep(300); await page.screenshot({ path: `${OUT}/${label}.png` }); }
const clickHidden = (page, dataset) => page.evaluate(dataset => { const o = document.createElement('button'); Object.assign(o.dataset, dataset); o.style.position = 'fixed'; o.style.left = '-9999px'; document.body.append(o); o.click(); o.remove(); }, dataset);
async function tap(page, selector) { const l = page.locator(selector).filter({ visible: true }).first(); await l.waitFor({ state: 'visible', timeout: 20000 }); try { await l.scrollIntoViewIfNeeded({ timeout: 4000 }); if (VP[kind].hasTouch) await l.tap({ timeout: 6000 }); else await l.click({ timeout: 6000 }); } catch (e) { log('programmatic click', selector, e.message.split('\n')[0].slice(0, 120)); await l.evaluate(el => el.click()); } }

(async () => {
  browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const ctx = await browser.newContext({ ...VP[kind], locale: 'zh-CN' });
  const page = await ctx.newPage(); page.setDefaultTimeout(30000);
  const base = new URL(BASE);
  page.on('request', req => { const u = new URL(req.url()); if (!/^https?:$/.test(u.protocol)) return; if (/(^|\/)api(\/|$)/.test(u.pathname)) report.api.push(`${req.method()} ${u.pathname}`); if (u.host !== base.host) report.thirdParty.push(req.url().slice(0, 160)); });
  page.on('response', r => { if (r.status() >= 400) report.failedResponses.push(`${r.status()} ${r.url().slice(0, 160)}`); });
  page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push(m.text().slice(0, 300)); });
  page.on('pageerror', e => report.pageErrors.push(String(e.message).slice(0, 300)));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 120000 });
  await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 60000 }).catch(() => {});
  await tap(page, '#join');
  await page.waitForSelector('form[data-form="demo-entry"]');
  await page.check('form[data-form="demo-entry"] input[name="consent"]', { force: true });
  await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button[type="submit"]')?.disabled, null, { timeout: 90000 });
  await tap(page, 'form[data-form="demo-entry"] button[type="submit"]');
  await page.waitForSelector('[data-tour-action="sample:sample-crowd"]', { timeout: 60000 });
  await sleep(1200);
  step('entered', true);
  // room panel → 散场聊天室
  await tap(page, '#room-info');
  await page.waitForFunction(() => document.querySelector('#panel')?.dataset.kind === 'room' && !document.querySelector('#panel').hidden, null, { timeout: 15000 });
  await sleep(600);
  await grab(page, 'room-panel', '#panel'); await shot(page, '01-room-panel');
  await tap(page, '#panel [data-open="conversation"]');
  await page.waitForSelector('.community-panel:not([hidden])', { timeout: 20000 });
  const P = '.community-panel:not([hidden])';
  await page.waitForFunction(P => /加入，继续聊|留一句/.test(document.querySelector(P)?.innerText || ''), P, { timeout: 20000 }).catch(() => {});
  await sleep(800);
  await grab(page, 'room-chat', P); await shot(page, '02-room-chat');
  // join the room chat (consent), then the seeded lines are readable
  const roomConsent = page.locator(`${P} form[data-group-join] input[name="consent"]`).first();
  if (await roomConsent.count()) { await roomConsent.check({ force: true }); await page.locator(`${P} form[data-group-join] button[type="submit"]`).first().evaluate(b => b.click()); }
  const chatLoaded = await page.waitForFunction(P => /我是月台的阿遥/.test(document.querySelector(P)?.innerText || '') && /人海这一面/.test(document.querySelector(P)?.innerText || '') && /看台边的一盏灯/.test(document.querySelector(P)?.innerText || ''), P, { timeout: 20000 }).then(() => true).catch(() => false);
  await sleep(1200);
  step('room chat (joined) shows the three seeded lines', chatLoaded);
  await grab(page, 'room-chat-joined', P); await shot(page, '02b-room-chat-joined');
  // settings menu → 这家 Livehouse 的乐迷社群
  const menu = page.locator(`${P} details.conversation-management > summary`).first();
  if (await menu.count()) { await menu.evaluate(s => s.click()); await sleep(500); await grab(page, 'room-chat-menu', P); await shot(page, '03-room-chat-menu'); }
  await page.locator(`${P} [data-group="linked"]`).first().evaluate(b => b.click());
  const community = await page.waitForFunction(P => /月台 Livehouse 乐迷社群/.test(document.querySelector(P)?.innerText || ''), P, { timeout: 20000 }).then(() => true).catch(() => false);
  await sleep(1500);
  step('linked community opens', community, (await page.evaluate(P => document.querySelector(P)?.innerText.replace(/\n+/g, ' | ').slice(0, 300), P)) || '');
  await grab(page, 'community-before-join', P); await shot(page, '04-community-before-join');
  const consent = page.locator(`${P} form[data-group-join] input[name="consent"]`).first();
  if (await consent.count()) {
    await consent.check({ force: true });
    await page.locator(`${P} form[data-group-join] button[type="submit"]`).first().evaluate(b => b.click());
    const joined = await page.waitForFunction(P => document.querySelector(P)?.classList.contains('conversation-layout') && /月台 Livehouse 乐迷社群/.test(document.querySelector(P)?.innerText || ''), P, { timeout: 20000 }).then(() => true).catch(() => false);
    await sleep(1800);
    step('joins the community', joined);
    await grab(page, 'community-joined', P); await shot(page, '05-community-joined');
    report.texts['scene-sticker'] = await page.evaluate(() => [...document.querySelectorAll('.scene-heading, #scene-heading, #scene-code, #render-status')].map(n => n.innerText.replace(/\n+/g, ' / ')).join(' | '));
    const space = page.locator(`${P} [data-group-space]`).first();
    if (await space.count()) {
      await space.evaluate(b => b.click());
      await sleep(2000);
      await grab(page, 'next-show', 'body'); await shot(page, '06-next-show');
      const vol2 = /回声现场 Vol\.2/.test(report.texts['next-show']);
      step('next show posted', vol2);
    } else step('next show button', false, 'no [data-group-space]');
  } else step('community join form', false, 'no join form');
  // the communities list from the room panel
  await page.keyboard.press('Escape').catch(() => {}); await sleep(600);
  for (const sel of ['[aria-label="返回社群"]', '.community-panel:not([hidden]) [data-group="close"]']) { const c = page.locator(sel).filter({ visible: true }).first(); if (await c.count()) { await c.evaluate(b => b.click()).catch(() => {}); await sleep(600); } }
  await clickHidden(page, { open: 'communities' }); await sleep(2000);
  await grab(page, 'communities-list', 'body'); await shot(page, '07-communities-list');
  await page.keyboard.press('Escape').catch(() => {}); await sleep(600);
  for (const sel of ['.community-panel:not([hidden]) [data-group="close"]', '#panel-close']) { const c = page.locator(sel).filter({ visible: true }).first(); if (await c.count()) { await c.evaluate(b => b.click()).catch(() => {}); await sleep(600); } }
  // recap
  await clickHidden(page, { open: 'recap' }); await sleep(2500);
  await grab(page, 'recap', '#panel'); await shot(page, '08-recap');
  await page.evaluate(() => { const p = document.querySelector('#panel'); if (p) p.scrollTop = p.scrollHeight; }); await sleep(400); await shot(page, '08-recap-end');
  step('done', true, `${report.api.length} /api, ${report.thirdParty.length} third-party, ${report.consoleErrors.length} console errors, ${report.pageErrors.length} page errors`);
  await finish(0);
})().catch(async e => { step('exception', false, String(e.message).split('\n')[0].slice(0, 300)); await finish(1); });
