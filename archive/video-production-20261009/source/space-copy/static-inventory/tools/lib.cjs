// Read-only walk helpers for the static copy inventory (never touches the repo).
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const path = require('path');
const BASE = process.env.SPACE_URL || 'http://127.0.0.1:5190/';
const OUT = process.env.OUT || '/tmp/space-copy/static-inventory/out';
const VP = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
function watchdog(seconds = 270) { const t = setTimeout(() => { console.log('WATCHDOG: giving up'); process.exit(3); }, seconds * 1000); t.unref(); }
const launch = () => chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });

const LOGGER = () => {
  window.__copyLog = [];
  const push = (kind, text) => { text = String(text || '').replace(/\s+/g, ' ').trim(); if (text) window.__copyLog.push([kind, text, Date.now()]); };
  const watch = () => {
    const toast = document.getElementById('toast');
    if (toast) new MutationObserver(() => push('toast', toast.textContent)).observe(toast, { childList: true, characterData: true, subtree: true });
    const conn = document.getElementById('connection-banner');
    if (conn) new MutationObserver(() => { if (!conn.hidden) push('connection-banner', conn.textContent); }).observe(conn, { childList: true, characterData: true, subtree: true, attributes: true });
    const status = document.getElementById('render-status');
    if (status) new MutationObserver(() => push('render-status', status.textContent)).observe(status, { childList: true, characterData: true, subtree: true });
    const loading = document.querySelector('#loading small');
    if (loading) new MutationObserver(() => push('loading-small', loading.textContent)).observe(loading, { childList: true, characterData: true, subtree: true });
    new MutationObserver(records => { for (const r of records) for (const n of r.addedNodes) if (n.id === 'space-boot-banner' || n.id === 'space-rescue') push(n.id, n.textContent); }).observe(document.body, { childList: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();
  const origConfirm = window.confirm; window.confirm = q => { push('confirm', q); return false; };
};

async function open(browser, kind, { context: given } = {}) {
  const context = given || await browser.newContext({ ...VP[kind], locale: 'zh-CN', acceptDownloads: true });
  if (!given) await context.addInitScript(LOGGER);
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  page.on('pageerror', e => console.log('[pageerror]', String(e.message).slice(0, 200)));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 120000 });
  await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 60000 }).catch(() => {});
  return { context, page, kind, touch: Boolean(VP[kind].hasTouch) };
}

async function press(run, selector) {
  const l = run.page.locator(selector).first();
  await l.waitFor({ state: 'visible', timeout: 60000 });
  if (run.touch) await l.tap(); else await l.click();
}
const clickHidden = (page, dataset) => page.evaluate(dataset => { const o = document.createElement('button'); Object.assign(o.dataset, dataset); o.style.position = 'fixed'; o.style.left = '-9999px'; document.body.append(o); o.click(); o.remove(); }, dataset);

/** Every text node and every read-aloud attribute under `selector`: [{ t, hidden }]. */
function harvest(page, selector = 'body') {
  return page.evaluate(selector => {
    const roots = [...document.querySelectorAll(selector)];
    const seen = new Map();
    const add = (t, hidden) => { t = t.replace(/\s+/g, ' ').trim(); if (!t || !/[㐀-鿿A-Za-z]/.test(t)) return; if (!seen.has(t) || (seen.get(t) && !hidden)) seen.set(t, hidden); };
    for (const root of roots) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.parentElement && !['SCRIPT', 'STYLE', 'svg'].includes(n.parentElement.tagName) && !n.parentElement.closest('svg,script,style') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
      for (let n = walker.nextNode(); n; n = walker.nextNode()) add(n.data, !n.parentElement.getClientRects().length);
      for (const el of [root, ...root.querySelectorAll('[aria-label],[title],[placeholder],[alt],[data-confirm],input[value]')]) {
        for (const a of ['aria-label', 'title', 'placeholder', 'alt', 'data-confirm']) { const v = el.getAttribute?.(a); if (v) add(`@${a}= ${v}`, !el.getClientRects().length); }
      }
    }
    return [...seen].map(([t, hidden]) => (hidden ? `(hidden) ${t}` : t));
  }, selector);
}

const results = {};
async function grab(page, label, selector = 'body') {
  const texts = await harvest(page, selector);
  results[label] = texts;
  console.log(`\n=== ${label} (${selector}) ===`);
  for (const t of texts) console.log('  ' + t);
}
async function log(page, label = 'log') {
  const entries = await page.evaluate(() => (window.__copyLog || []).map(([k, t]) => `${k}: ${t}`));
  const uniq = [...new Set(entries)];
  results[label] = uniq;
  console.log(`\n=== ${label} ===`);
  for (const t of uniq) console.log('  ' + t);
}
async function shot(page, name) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}
function save(name) { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(results, null, 1)); }

async function enter(run) {
  const { page } = run;
  await press(run, '#join');
  await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 30000 });
  await page.check('form[data-form="demo-entry"] input[name="consent"]', { force: true });
  await page.waitForFunction(() => { const b = document.querySelector('form[data-form="demo-entry"] button[type="submit"]'); return b && !b.disabled; }, null, { timeout: 90000 });
  await press(run, 'form[data-form="demo-entry"] button[type="submit"]');
  await page.waitForSelector('[data-tour-action="sample:sample-crowd"]', { timeout: 60000 });
  await sleep(500);
}
async function closeSheet(run) {
  const { page } = run;
  if (await page.evaluate(() => !document.querySelector('#panel').hidden)) { await page.locator('#panel-close').evaluate(b => b.click()); await sleep(400); }
}
module.exports = { BASE, OUT, VP, sleep, watchdog, launch, open, press, clickHidden, harvest, grab, log, shot, save, enter, closeSheet, results, LOGGER };
