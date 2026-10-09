// Audit helpers (read-only on the repo): fresh contexts, a logger for every transient text, and a text harvester per state.
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const path = require('path');
const BASE = process.env.SPACE_URL || 'http://127.0.0.1:5491/musicSpace/';
const OUT = process.env.OUT || '/tmp/space-copy/final-work/audit/shots';
const CORPUS = process.env.CORPUS || '/tmp/space-copy/final-work/audit/corpus';
const VP = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  narrow: { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
function watchdog(seconds = 280) { const t = setTimeout(() => { console.log('WATCHDOG: giving up'); flush(); process.exit(3); }, seconds * 1000); t.unref(); }
const launch = () => chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });

// Every transient text: live regions, toasts, banners, the status pill, dialogs, the document title.
const LOGGER = () => {
  try { window.__audit = JSON.parse(sessionStorage.getItem('__audit') || '[]'); } catch { window.__audit = []; }
  window.__audit.push(['load', location.pathname + location.search, Date.now()]);
  window.__confirmAnswer = false;
  const push = (kind, text) => { text = String(text || '').replace(/\s+/g, ' ').trim(); if (!text) return; const last = window.__audit[window.__audit.length - 1]; if (last && last[0] === kind && last[1] === text) return; window.__audit.push([kind, text, Date.now()]); try { sessionStorage.setItem('__audit', JSON.stringify(window.__audit.slice(-400))); } catch {} };
  window.__auditPush = push;
  const LIVE = '[role="status"],[role="alert"],[role="alertdialog"],[aria-live],#toast,.toast,#connection-banner,#space-boot-banner,#space-rescue,#render-status,#loading,#view-label';
  let pending = new Set(), scheduled = false;
  const flushLive = () => { scheduled = false; for (const el of pending) { if (!el.isConnected) continue; const hidden = el.hidden || !el.getClientRects().length; push(`live:${el.id || el.getAttribute('role') || el.className.split(' ')[0]}${hidden ? '(hidden)' : ''}`, el.textContent); } pending = new Set(); };
  const watch = () => {
    new MutationObserver(records => {
      for (const r of records) {
        const node = r.target.nodeType === 1 ? r.target : r.target.parentElement;
        const live = node && node.closest && node.closest(LIVE);
        if (live) pending.add(live);
        for (const n of r.addedNodes || []) if (n.nodeType === 1) { if (n.matches(LIVE)) pending.add(n); for (const k of n.querySelectorAll ? n.querySelectorAll(LIVE) : []) pending.add(k); }
      }
      if (pending.size) flushLive();
    }).observe(document.documentElement, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class'] });
    new MutationObserver(() => push('title', document.title)).observe(document.querySelector('title') || document.head, { childList: true, characterData: true, subtree: true });
    push('title', document.title);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();
  window.confirm = q => { push('confirm', q); return window.__confirmAnswer; };
  window.alert = q => { push('alert', q); };
  window.prompt = q => { push('prompt', q); return null; };
};

const corpus = { states: [], logs: {} };
let corpusName = 'corpus';
function setCorpus(name) { corpusName = name; }
function flush() { try { fs.mkdirSync(CORPUS, { recursive: true }); fs.writeFileSync(path.join(CORPUS, `${corpusName}.json`), JSON.stringify(corpus, null, 1)); } catch (e) { console.log('flush failed', e.message); } }

async function open(browser, kind, { context: given, url = BASE, init } = {}) {
  const context = given || await browser.newContext({ ...VP[kind], locale: 'zh-CN', acceptDownloads: true, timezoneId: 'Asia/Shanghai' });
  if (!given) { await context.addInitScript(LOGGER); if (init) await context.addInitScript(init); }
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  page.__errors = [];
  page.on('pageerror', e => { page.__errors.push(String(e.message).slice(0, 200)); console.log('[pageerror]', String(e.message).slice(0, 200)); });
  page.on('dialog', d => { console.log('[dialog]', d.type(), d.message()); d.dismiss().catch(() => {}); });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  return { context, page, kind, touch: Boolean(VP[kind].hasTouch) };
}
async function ready(run) {
  const { page } = run;
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 120000 });
  await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true || !document.querySelector('#loading')?.getClientRects().length, null, { timeout: 60000 }).catch(() => {});
}

async function press(run, selector) {
  const l = run.page.locator(selector).first();
  await l.waitFor({ state: 'visible', timeout: 60000 });
  if (run.touch) await l.tap(); else await l.click();
}
const js = (page, selector) => page.locator(selector).first().evaluate(b => b.click());
const clickHidden = (page, dataset) => page.evaluate(dataset => { const o = document.createElement('button'); Object.assign(o.dataset, dataset); o.style.position = 'fixed'; o.style.left = '-9999px'; document.body.append(o); o.click(); o.remove(); }, dataset);

/** innerText (what is rendered), every attribute a screen reader or tooltip may read, and text that is in the DOM but not rendered now. */
function harvest(page, selector = 'body') {
  return page.evaluate(selector => {
    const roots = [...document.querySelectorAll(selector)].filter(r => r.getClientRects().length);
    const visible = roots.map(r => r.innerText).join('\n---\n');
    const attrs = new Set(), hidden = new Set();
    for (const root of roots) {
      for (const el of [root, ...root.querySelectorAll('*')]) {
        if (el.closest('svg') && !['svg'].includes(el.tagName.toLowerCase()) && !el.getAttribute('aria-label')) continue;
        for (const a of ['aria-label', 'title', 'placeholder', 'alt', 'data-confirm', 'aria-description', 'aria-valuetext', 'aria-roledescription']) {
          const v = el.getAttribute(a); if (v && /[㐀-鿿A-Za-z]/.test(v)) attrs.add(`@${a}=${v.replace(/\s+/g, ' ').trim()}${el.getClientRects().length ? '' : ' (hidden el)'}`);
        }
        if (el.tagName === 'OPTION' && !el.closest('select')?.getClientRects().length) hidden.add(el.textContent.trim());
        if (el.tagName === 'INPUT' && ['submit', 'button'].includes(el.type) && el.value) attrs.add(`@value=${el.value}`);
      }
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const t = n.data.replace(/\s+/g, ' ').trim();
        if (!t || !/[㐀-鿿A-Za-z]/.test(t)) continue;
        const p = n.parentElement; if (!p || p.closest('style,script')) continue;
        if (!p.getClientRects().length) hidden.add(t);
      }
    }
    return { visible, attrs: [...attrs], hidden: [...hidden] };
  }, selector);
}

async function grab(page, label, selector = 'body', { quiet = false } = {}) {
  const h = await harvest(page, selector);
  const vp = page.__vp || '';
  corpus.states.push({ vp, label, selector, ...h, at: Date.now() });
  if (!quiet) {
    console.log(`\n=== ${vp} ${label} (${selector}) ===`);
    console.log(h.visible.replace(/\n{2,}/g, '\n').split('\n').map(l => '  | ' + l).join('\n'));
    if (h.attrs.length) console.log('  attrs: ' + h.attrs.join(' ‖ '));
    if (h.hidden.length) console.log('  hidden: ' + h.hidden.join(' ‖ '));
  }
  return h;
}
async function log(page, label = 'log') {
  const entries = await page.evaluate(() => (window.__audit || []).map(([k, t]) => `${k}: ${t}`)).catch(() => []);
  corpus.logs[`${page.__vp || ''} ${label}`] = entries;
  console.log(`\n=== LOG ${page.__vp || ''} ${label} ===`);
  for (const t of [...new Set(entries)]) console.log('  ' + t);
}
async function shot(page, name, { full = false } = {}) {
  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, `${page.__vp || 'x'}-${name}.png`);
  await page.screenshot({ path: file, fullPage: full }).catch(e => console.log('shot failed', e.message));
  return file;
}
/** Screenshot a scrolling element page by page. */
async function shotScroll(page, name, scroller = '#panel', max = 5) {
  const total = await page.evaluate(sel => { const s = document.querySelector(sel); if (!s) return 0; s.scrollTop = 0; return Math.ceil(s.scrollHeight / Math.max(1, s.clientHeight - 80)); }, scroller);
  for (let i = 0; i < Math.min(max, Math.max(1, total)); i++) {
    await page.evaluate(([sel, i]) => { const s = document.querySelector(sel); if (s) s.scrollTop = i * Math.max(1, s.clientHeight - 80); }, [scroller, i]);
    await sleep(250);
    await shot(page, `${name}-${i}`);
  }
  await page.evaluate(sel => { const s = document.querySelector(sel); if (s) s.scrollTop = 0; }, scroller);
}

/** Layout problems inside a root: horizontal overflow, things sticking out, labels/buttons wrapping to 3+ lines, orphan single chars. */
function layout(page, root) {
  return page.evaluate(root => {
    const r = document.querySelector(root);
    if (!r || !r.getClientRects().length) return { missing: root };
    const flat = document.createElement('style');
    flat.textContent = '*{transform:none!important;rotate:none!important;animation:none!important;transition:none!important}';
    document.head.append(flat);
    try {
    const vw = document.documentElement.clientWidth;
    const rb = r.getBoundingClientRect();
    const out = [], tall = [], orphan = [];
    for (const el of r.querySelectorAll('*')) {
      if (!el.getClientRects().length || el.closest('svg')) continue;
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden') continue;
      if (cs.position === 'absolute' && cs.clipPath && cs.clipPath !== 'none') continue;
      const b = el.getBoundingClientRect();
      if (b.width > 2 && (b.right > Math.min(vw, rb.right) + 1.5 || b.left < Math.max(0, rb.left) - 1.5) && !el.closest('.conversation-actions,.entry-list,.camera-nav') && cs.position !== 'fixed') out.push(`${el.tagName.toLowerCase()}.${(el.getAttribute('class') || '').split(' ')[0]}「${(el.textContent || '').trim().slice(0, 18)}」 ${Math.round(b.left)}-${Math.round(b.right)} vs ${Math.round(rb.left)}-${Math.round(rb.right)}`);
      if (el.scrollWidth > el.clientWidth + 1 && ['auto', 'scroll', 'hidden'].includes(cs.overflowX) && el.clientWidth > 0 && !['CANVAS', 'svg'].includes(el.tagName)) out.push(`${el.tagName.toLowerCase()}.${(el.getAttribute('class') || '').split(' ')[0]} scrolls inside ${el.scrollWidth}>${el.clientWidth}「${(el.textContent || '').trim().slice(0, 18)}」`);
      // line count of own text, and a last line that holds a single CJK character
      const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.data.trim());
      if (!hasText) continue;
      const range = document.createRange(); range.selectNodeContents(el);
      const rows = new Map();
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.parentElement.getClientRects().length) continue;
        for (let i = 0; i < n.data.length; i++) { const ch = n.data[i]; if (/\s/.test(ch)) continue; const rg = document.createRange(); rg.setStart(n, i); rg.setEnd(n, i + 1); const bb = rg.getBoundingClientRect(); if (!bb.width) continue; const key = Math.round(bb.top / 5); const row = rows.get(key) || []; row.push([bb.left, ch]); rows.set(key, row); }
      }
      const lines = [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, row]) => row.sort((a, b) => a[0] - b[0]).map(x => x[1]).join(''));
      if (/^(BUTTON|SUMMARY|LABEL|LEGEND|H2|H3|B|STRONG|A)$/.test(el.tagName) && lines.length >= 3) tall.push(`${el.tagName.toLowerCase()}「${el.textContent.trim().slice(0, 30)}」 ${lines.length} lines: ${lines.join(' / ')}`);
      if (lines.length >= 2) { const last = lines[lines.length - 1].replace(/[。，、！？：；」』）)…·.!?,:;"'\s]/g, ''); if (last.length === 1 && /[㐀-鿿]/.test(last)) orphan.push(`${el.tagName.toLowerCase()}.${(el.getAttribute('class') || '').split(' ')[0]}: ${lines.join(' / ')}`); }
    }
    return { pageOverflow: document.documentElement.scrollWidth > vw + 1, out: [...new Set(out)].slice(0, 14), tall: tall.slice(0, 14), orphan: orphan.slice(0, 14) };
    } finally { flat.remove(); }
  }, root);
}
async function check(page, label, root) {
  const res = await layout(page, root);
  const bad = res.missing || res.pageOverflow || res.out?.length || res.tall?.length || res.orphan?.length;
  console.log(`--- layout ${page.__vp} ${label}: ${bad ? JSON.stringify(res) : 'ok'}`);
  corpus.states.push({ vp: page.__vp, label: `layout:${label}`, selector: root, layout: res });
  return res;
}

async function enter(run, { participation } = {}) {
  const { page } = run;
  await press(run, '#join');
  await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 30000 });
  if (participation === 'quiet') await page.check('form[data-form="demo-entry"] input[value="quiet"]', { force: true });
  await page.check('form[data-form="demo-entry"] input[name="consent"]', { force: true });
  await page.waitForFunction(() => { const b = document.querySelector('form[data-form="demo-entry"] button[type="submit"]'); return b && !b.disabled; }, null, { timeout: 90000 });
  await js(page, 'form[data-form="demo-entry"] button[type="submit"]');
  await page.waitForFunction(() => document.querySelector('[data-tour-action]') || /本场信息/.test(document.querySelector('#join')?.textContent || ''), null, { timeout: 60000 });
  await sleep(800);
}
async function closeSheet(page) {
  if (await page.evaluate(() => !document.querySelector('#panel').hidden)) { await page.locator('#panel-close').evaluate(b => b.click()); await sleep(400); }
}
/** Wait until the AI chip settles (not 正在判断). */
async function aiSettled(page) {
  await page.waitForFunction(() => { const f = document.querySelector('form[data-form="upload"]'); if (!f) return true; const t = f.textContent || ''; return !/正在判断|AI 正在|判断中/.test(t); }, null, { timeout: 40000 }).catch(() => console.log('ai not settled'));
}
module.exports = { BASE, OUT, VP, sleep, watchdog, launch, open, ready, press, js, clickHidden, harvest, grab, log, shot, shotScroll, check, layout, enter, closeSheet, aiSettled, corpus, setCorpus, flush, LOGGER };
