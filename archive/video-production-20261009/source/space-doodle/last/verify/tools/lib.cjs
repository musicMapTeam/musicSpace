// Final verifier helpers (read-only on the repo): fresh browser contexts on the production Pages build, request/console logging,
// the judge route, and in-page measurements of #panel sheets and their round ×.
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const path = require('path');

const OUT = '/tmp/space-doodle/last/verify';
const VP = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  narrow: { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
function watchdog(seconds = 280) { const t = setTimeout(() => { console.log('WATCHDOG: giving up'); process.exit(3); }, seconds * 1000); t.unref(); }
const launch = () => chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });

/** A fresh context + page with every request, failure, console error and page error recorded. */
async function open(browser, kind, base) {
  const context = await browser.newContext({ ...VP[kind], locale: 'zh-CN', acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  const origin = new URL(base).origin;
  const log = { requests: 0, api: [], foreign: [], failedRequests: [], consoleErrors: [], consoleWarnings: [], pageErrors: [] };
  page.on('request', r => {
    log.requests++;
    let u; try { u = new URL(r.url()); } catch { return; }
    if (u.protocol === 'data:' || u.protocol === 'blob:') return;
    if (/\/api(\/|$)/.test(u.pathname)) log.api.push(r.method() + ' ' + r.url());
    if ((u.protocol === 'http:' || u.protocol === 'https:') && u.origin !== origin) log.foreign.push(r.url());
  });
  const t0 = Date.now();
  log.step = 'boot';
  log.trace = [];
  const traced = u => /\/ai\/|\.wasm(\?|$)|\.onnx(\?|$)/.test(u);
  page.on('request', r => { if (traced(r.url())) log.trace.push(`${((Date.now() - t0) / 1000).toFixed(2)} ${log.step} REQ ${r.resourceType()} ${r.url().replace(base, '')} worker=${!!r.frame ? (() => { try { return r.frame() ? 'no' : 'yes'; } catch { return 'yes'; } })() : '?'}`); });
  page.on('requestfinished', r => { if (traced(r.url())) log.trace.push(`${((Date.now() - t0) / 1000).toFixed(2)} ${log.step} DONE ${r.url().replace(base, '')}`); });
  page.on('requestfailed', r => { if (traced(r.url())) log.trace.push(`${((Date.now() - t0) / 1000).toFixed(2)} ${log.step} FAILED ${r.url().replace(base, '')} ${r.failure()?.errorText}`); });
  page.on('requestfailed', r => log.failedRequests.push(`${r.url().slice(0, 160)} ${r.failure()?.errorText} @${log.step} ${((Date.now() - t0) / 1000).toFixed(1)}s`));
  page.on('response', r => { if (r.status() >= 400) log.failedRequests.push(`${r.status()} ${r.url().slice(0, 160)}`); });
  page.on('console', m => { if (m.type() === 'error') log.consoleErrors.push(m.text().slice(0, 300)); else if (m.type() === 'warning') log.consoleWarnings.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => log.pageErrors.push(String(e.message).slice(0, 300)));
  if (process.env.CDP_TRACE) { // byte accounting of the traced requests, to tell a real failure from a late "aborted" report
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    const ids = new Map(), got = new Map();
    cdp.on('Network.requestWillBeSent', e => { if (traced(e.request.url)) ids.set(e.requestId, e.request.url.replace(base, '')); });
    cdp.on('Network.responseReceived', e => { if (ids.has(e.requestId)) log.trace.push(`${((Date.now() - t0) / 1000).toFixed(2)} cdp RESP ${ids.get(e.requestId)} ${e.response.status} len=${e.response.headers['Content-Length'] || e.response.headers['content-length']}`); });
    cdp.on('Network.dataReceived', e => { if (ids.has(e.requestId)) got.set(e.requestId, (got.get(e.requestId) || 0) + e.dataLength); });
    cdp.on('Network.loadingFinished', e => { if (ids.has(e.requestId)) log.trace.push(`${((Date.now() - t0) / 1000).toFixed(2)} cdp FINISHED ${ids.get(e.requestId)} received=${got.get(e.requestId)}`); });
    cdp.on('Network.loadingFailed', e => { if (ids.has(e.requestId)) log.trace.push(`${((Date.now() - t0) / 1000).toFixed(2)} cdp FAILED ${ids.get(e.requestId)} ${e.errorText} canceled=${e.canceled} received=${got.get(e.requestId)}`); });
  }
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready' || String(window.__SPACE_BOOT__ || '').startsWith('fail'), null, { timeout: 120000 });
  const boot = await page.evaluate(() => window.__SPACE_BOOT__);
  if (boot !== 'ready') throw new Error('boot ' + boot);
  await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 60000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  return { context, page, kind, base, log, touch: Boolean(VP[kind].hasTouch) };
}

async function press(run, selector) {
  const l = typeof selector === 'string' ? run.page.locator(selector).first() : selector;
  await l.waitFor({ state: 'visible', timeout: 60000 });
  if (run.touch) await l.tap(); else await l.click();
}

/** 「进入示例现场」 → consent → 「进入示例现场」: returns the labels the judge sees. */
async function enter(run) {
  const { page } = run;
  const joinLabel = (await page.locator('#join').innerText()).trim();
  await press(run, '#join');
  await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 30000 });
  await sleep(500);
  const formOpen = await page.evaluate(() => ({ st: Math.round(document.querySelector('#panel').scrollTop), submit: document.querySelector('form[data-form="demo-entry"] button[type="submit"]')?.textContent.trim() }));
  await page.check('form[data-form="demo-entry"] input[name="consent"]', { force: true });
  await page.waitForFunction(() => { const b = document.querySelector('form[data-form="demo-entry"] button[type="submit"]'); return b && !b.disabled; }, null, { timeout: 90000 });
  await press(run, 'form[data-form="demo-entry"] button[type="submit"]');
  await page.waitForSelector('[data-tour-action="sample:sample-crowd"]', { timeout: 60000 });
  await page.waitForFunction(() => document.querySelectorAll('#hotspots [data-kind="person"]').length > 1, null, { timeout: 30000 }).catch(() => {});
  await sleep(800);
  const sample = (await page.locator('[data-tour-action="sample:sample-crowd"]').first().innerText()).trim().replace(/\s+/g, ' ');
  return { joinLabel, formOpen, sample };
}

const aiSettled = page => page.waitForFunction(() => /^(sure|unsure|off)/.test(document.querySelector('form[data-form="upload"] [data-ai-line]')?.getAttribute('data-ai-key') || ''), null, { timeout: 90000 }).then(() => true).catch(() => false);

/** The sheet's scroll state and its × right now: in the sheet's visible box, the top element at its centre, and any text/control under it. */
function closeState(page, { root = '#panel', close = '#panel-close' } = {}) {
  return page.evaluate(({ root, close }) => {
    const s = document.querySelector(root), c = document.querySelector(close);
    if (!s || s.hidden || !c) return { missing: true };
    const sr = s.getBoundingClientRect(), cr = c.getBoundingClientRect();
    const nav = document.querySelector('.camera-nav')?.getBoundingClientRect();
    const visBottom = Math.min(sr.bottom, innerHeight);
    const hit = document.elementFromPoint(cr.left + cr.width / 2, cr.top + cr.height / 2);
    const onTop = !!hit && (hit === c || c.contains(hit));
    const inView = cr.width > 0 && cr.top >= Math.max(0, sr.top) - 1 && cr.bottom <= visBottom + 1 && cr.left >= sr.left - 1 && cr.right <= sr.right + 1;
    const inset = 4, R = { l: cr.left + inset, t: cr.top + inset, r: cr.right - inset, b: cr.bottom - inset };
    const meet = b => b.width > 0 && b.height > 0 && b.left < R.r && b.right > R.l && b.top < R.b && b.bottom > R.t;
    const under = new Set();
    const walker = document.createTreeWalker(s, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.data.trim() || c.contains(n)) continue;
      const el = n.parentElement;
      if (!el || getComputedStyle(el).visibility === 'hidden' || !el.getClientRects().length) continue;
      const cs = getComputedStyle(el); if (cs.position === 'absolute' && parseFloat(cs.width) <= 1) continue; // screen-reader only
      const range = document.createRange(); range.selectNodeContents(n);
      for (const b of range.getClientRects()) if (meet(b)) { under.add('text「' + n.data.trim().slice(0, 16) + '」'); break; }
    }
    for (const el of s.querySelectorAll('button,input,select,textarea,a,label')) {
      if (el === c || c.contains(el) || !el.getClientRects().length || getComputedStyle(el).visibility === 'hidden') continue;
      if (meet(el.getBoundingClientRect())) under.add(el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '') + '「' + el.textContent.trim().slice(0, 12) + '」');
    }
    return { kind: s.dataset.kind, st: Math.round(s.scrollTop), sh: s.scrollHeight, ch: s.clientHeight, close: [Math.round(cr.left), Math.round(cr.top), Math.round(cr.right), Math.round(cr.bottom)], sheetTop: Math.round(sr.top), sheetRight: Math.round(sr.right), fromTop: Math.round(cr.top - sr.top), fromRight: Math.round(sr.right - cr.right), inView, onTop, hit: onTop ? '#panel-close' : hit ? hit.tagName.toLowerCase() + '.' + (hit.getAttribute('class') || '') : null, under: [...under], focused: document.activeElement === c };
  }, { root, close });
}

/** Scroll the sheet in 30px steps (and to the very end): at every offset the × must be in the sheet's visible box and the top element. */
function scan(page, root = '#panel', close = '#panel-close') {
  return page.evaluate(async ({ root, close }) => {
    const p = document.querySelector(root), c = document.querySelector(close);
    const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const start = p.scrollTop, bad = [], seen = new Set(), tops = [], rights = [];
    const max = p.scrollHeight - p.clientHeight;
    let steps = 0;
    const offsets = []; for (let y = 0; y < max; y += 30) offsets.push(y); offsets.push(max);
    for (const y of offsets) {
      p.scrollTop = y; await frame(); steps++;
      const r = c.getBoundingClientRect(), pr = p.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const inside = r.top >= Math.max(0, pr.top) - 1 && r.bottom <= Math.min(innerHeight, pr.bottom) + 1;
      seen.add(`${Math.round(r.top - pr.top)},${Math.round(pr.right - r.right)}`);
      tops.push(r.top - pr.top); rights.push(pr.right - r.right);
      if (!hit || !(hit === c || c.contains(hit)) || !inside) bad.push({ y: Math.round(p.scrollTop), hit: hit ? hit.tagName + '.' + (hit.getAttribute('class') || '') : null, inside });
    }
    p.scrollTop = start; await frame();
    const span = a => +(Math.max(...a) - Math.min(...a)).toFixed(2);
    return { kind: p.dataset.kind, max: Math.round(max), steps, bad, closeOffsets: [...seen], drift: { top: span(tops), right: span(rights), topRange: [+Math.min(...tops).toFixed(2), +Math.max(...tops).toFixed(2)] } };
  }, { root, close });
}

const scrollTo = (page, y, selector = '#panel') => page.evaluate(([y, selector]) => { const p = document.querySelector(selector); p.scrollTop = y === 'end' ? p.scrollHeight : y === 'mid' ? Math.round((p.scrollHeight - p.clientHeight) / 2) : y; return Math.round(p.scrollTop); }, [y, selector]);

async function shot(page, file, opts = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await sleep(opts.settle ?? 450);
  await page.screenshot({ path: file, ...(opts.clip ? { clip: opts.clip } : {}), ...(opts.fullPage ? { fullPage: true } : {}) });
  return file;
}

/** Waits for a transient toast to go so it is not mistaken for part of the screen. */
const toastGone = page => page.waitForFunction(() => { const t = document.querySelector('#toast'); if (!t || !t.textContent.trim()) return true; const cs = getComputedStyle(t); return cs.visibility === 'hidden' || +cs.opacity < 0.05 || !t.getClientRects().length; }, null, { timeout: 6000 }).catch(() => {});

module.exports = { OUT, VP, sleep, watchdog, launch, open, press, enter, aiSettled, closeState, scan, scrollTo, shot, toastGone };
