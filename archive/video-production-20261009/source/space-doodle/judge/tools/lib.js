// Shared helpers for the judge-path QA runs (production static build served by serve-prefix.mjs).
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const path = require('path');

const ORIGIN = process.env.JUDGE_ORIGIN || 'http://127.0.0.1:47311';
const OUT = '/tmp/space-doodle/critique/judge';
fs.mkdirSync(OUT, { recursive: true });
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const VIEWPORTS = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const baseUrl = channel => (channel === 'preview' ? `${ORIGIN}/musicSpace/preview/` : `${ORIGIN}/musicSpace/`);

async function launch(extraArgs = []) {
  return chromium.launch({ executablePath: CHROME, args: extraArgs });
}

/** A fresh context with full network/console capture. */
async function open(browser, vp, { label = 'run' } = {}) {
  const context = await browser.newContext({ ...VIEWPORTS[vp], acceptDownloads: true, locale: 'zh-CN' });
  const net = [];
  const consoleMsgs = [];
  const pageErrors = [];
  const attach = page => {
    page.on('console', msg => {
      const t = msg.type();
      if (t === 'error' || t === 'warning') consoleMsgs.push({ type: t, text: msg.text().slice(0, 400), loc: msg.location()?.url ? `${msg.location().url}:${msg.location().lineNumber}` : '', at: Date.now() });
    });
    page.on('pageerror', e => pageErrors.push({ message: String(e.message).slice(0, 400), at: Date.now() }));
  };
  context.on('page', attach);
  context.on('requestfinished', async req => {
    let status = 0, bytes = -1;
    try { const res = await req.response(); status = res ? res.status() : 0; } catch {}
    try { const s = await req.sizes(); bytes = s.responseBodySize; } catch {}
    net.push({ url: req.url(), method: req.method(), type: req.resourceType(), status, bytes, ok: true });
  });
  context.on('requestfailed', req => net.push({ url: req.url(), method: req.method(), type: req.resourceType(), status: 0, bytes: -1, ok: false, failure: req.failure()?.errorText }));
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  return { context, page, net, consoleMsgs, pageErrors, vp, label };
}

async function boot(page, url, timeout = 90000) {
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready' || String(window.__SPACE_BOOT__ || '').startsWith('failed'), null, { timeout });
  const state = await page.evaluate(() => window.__SPACE_BOOT__);
  return { ms: Date.now() - t0, state };
}

async function shot(run, name, opts = {}) {
  const file = path.join(OUT, `${run.label}-${name}.png`);
  await sleep(opts.settle ?? 400);
  await run.page.screenshot({ path: file, fullPage: false });
  return file;
}

/** One deliberate user tap; records whether a scroll was needed and whether something covered the target. */
async function tap(run, locator, desc, taps) {
  await locator.waitFor({ state: 'visible', timeout: 45000 });
  const info = await locator.evaluate(el => {
    const r = el.getBoundingClientRect();
    const inView = r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth;
    let covered = '';
    if (inView) {
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (hit && hit !== el && !el.contains(hit) && !(el.control && (hit === el.control)) && !(hit.closest && hit.closest('label') && hit.closest('label').contains(el))) covered = `${hit.tagName.toLowerCase()}#${hit.id}.${String(hit.className).split(' ').join('.')}`;
    }
    return { inView, covered, w: Math.round(r.width), h: Math.round(r.height), text: (el.innerText || el.getAttribute('aria-label') || el.value || '').trim().replace(/\s+/g, ' ').slice(0, 40) };
  });
  taps.push({ n: taps.length + 1, desc, ...info, at: Date.now() });
  if (run.vp === 'phone') await locator.tap(); else await locator.click();
  return info;
}

function summarizeNet(run, origin = ORIGIN) {
  const host = new URL(origin).host;
  const external = run.net.filter(r => { try { const u = new URL(r.url); return !['data:', 'blob:'].includes(u.protocol) && u.host !== host; } catch { return false; } });
  const api = run.net.filter(r => { try { return /\/api(\/|$)/.test(new URL(r.url).pathname); } catch { return false; } });
  const bad = run.net.filter(r => r.status >= 400 || (!r.ok && !/ERR_ABORTED/.test(r.failure || '')));
  const aborted = run.net.filter(r => !r.ok && /ERR_ABORTED/.test(r.failure || ''));
  const fonts = run.net.filter(r => /\/fonts\/doodle\//.test(r.url)).map(r => ({ file: r.url.replace(/^.*\/fonts\/doodle\//, ''), status: r.status, bytes: r.bytes }));
  return { total: run.net.length, external, api, bad, aborted, fonts };
}

function writeJson(name, data) {
  const file = path.join(OUT, name);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  return file;
}

async function serverLog() {
  const res = await fetch(`${ORIGIN}/__log`);
  return res.json();
}
async function clearServerLog() { await fetch(`${ORIGIN}/__clear`); }

async function tourText(page) {
  return page.evaluate(() => {
    const t = document.querySelector('#demo-tour');
    if (!t) return '(no #demo-tour)';
    if (t.hidden) return `(hidden) ${t.textContent.trim().replace(/\s+/g, ' ').slice(0, 80)}`;
    const title = t.querySelector('.demo-tour-title')?.textContent.trim().replace(/\s+/g, ' ');
    const dots = [...t.querySelectorAll('.demo-tour-bar i')].map(i => (i.classList.contains('on') ? '●' : '○')).join('');
    return `${title} [${dots}]`;
  });
}

module.exports = { ORIGIN, OUT, VIEWPORTS, sleep, baseUrl, launch, open, boot, shot, tap, summarizeNet, writeJson, serverLog, clearServerLog, tourText };
