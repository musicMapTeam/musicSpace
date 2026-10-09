// Shell fixer helpers (read-only against the repo; screenshots only).
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const path = require('path');
const URL = process.env.SPACE_URL || 'http://127.0.0.1:5190/';
const OUT = process.env.OUT || '/tmp/space-doodle/fix/shell';
const VP = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  desktop790: { viewport: { width: 1440, height: 790 }, deviceScaleFactor: 1 },
  d1366: { viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 },
  d1280: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  d1100: { viewport: { width: 1100, height: 700 }, deviceScaleFactor: 1 },
  d1920: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
  tablet: { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  w360: { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  narrow: { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  w820: { viewport: { width: 820, height: 1000 }, deviceScaleFactor: 1 },
  w750: { viewport: { width: 750, height: 900 }, deviceScaleFactor: 1 },
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function launch() { return chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }); }
async function open(browser, kind, { waitReady = true, query = '', url = URL } = {}) {
  const ctx = await browser.newContext({ ...VP[kind], acceptDownloads: true, locale: 'zh-CN' });
  const page = await ctx.newPage();
  page.__logs = [];
  page.on('pageerror', e => { page.__logs.push('pageerror: ' + e.message.slice(0, 200)); console.log('[pageerror]', e.message.slice(0, 200)); });
  page.on('console', m => { if (m.type() === 'error') page.__logs.push('console.error: ' + m.text().slice(0, 200)); });
  await page.goto(url + query, { waitUntil: 'domcontentloaded' });
  if (waitReady) await ready(page);
  return { ctx, page };
}
async function ready(page) {
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
  await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 60000 }).catch(() => console.log('loading never hid'));
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await sleep(900);
}
async function enter(page) {
  if (!(await page.locator('form[data-form="demo-entry"]').count())) await page.locator('#join').click();
  await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 20000 });
  await page.locator('form[data-form="demo-entry"] input[name=consent]').check();
  await page.waitForSelector('form[data-form="demo-entry"] button[type=submit]:not([disabled])', { timeout: 60000 });
  await page.locator('form[data-form="demo-entry"] button[type=submit]').click();
  await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"]'), null, { timeout: 60000 });
  await page.waitForFunction(() => (window.__SPACE_EVENT_QA__?.()?.members || []).length > 1, null, { timeout: 30000 }).catch(() => console.log('members never arrived'));
  await sleep(2600);
}
async function shot(page, name, opts = {}) {
  fs.mkdirSync(opts.dir || OUT, { recursive: true });
  const file = path.join(opts.dir || OUT, `${name}.png`);
  if (!opts.keepFocus) await page.evaluate(() => document.activeElement?.blur?.()).catch(() => {});
  await sleep(opts.settle ?? 500);
  await page.screenshot({ path: file, fullPage: !!opts.fullPage, ...(opts.clip ? { clip: opts.clip } : {}) });
  console.log('saved', file);
  return file;
}
async function openKind(page, kind, id) {
  await page.evaluate(([k, i]) => { const b = document.createElement('button'); b.dataset.open = k; if (i) b.dataset.id = i; b.style.position = 'fixed'; b.style.left = '-9999px'; document.body.append(b); b.click(); b.remove(); }, [kind, id]);
  await sleep(1000);
}
async function closeEverything(page) {
  await page.evaluate(() => { for (const sel of ['.wardrobe:not([hidden]) .wardrobe-header>button', '.private-chat:not([hidden]) .chat-close', '.room-moderation:not([hidden]) header>button', '.photo-exchanges:not([hidden]) [data-x-close]']) { const b = document.querySelector(sel); if (b && b.getClientRects().length) b.click(); } }).catch(() => {});
  await sleep(300);
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape').catch(() => {}); await sleep(150); }
  await page.evaluate(() => { const c = document.querySelector('#panel-close'); if (c && !document.querySelector('#panel').hidden) c.click(); });
  await sleep(400);
}
// presence card vs. hotspots coverage
async function cover(page) {
  return page.evaluate(() => {
    const pres = document.querySelector('.presence');
    const card = pres.getBoundingClientRect();
    const shell = document.querySelector('.world-shell').getBoundingClientRect();
    const tog = document.querySelector('[data-tour-toggle]');
    let togHit = null;
    if (tog && tog.getClientRects().length) { const r = tog.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); togHit = hit && (hit === tog || tog.contains(hit)); }
    const out = { card: [card.left, card.top, card.right, card.bottom].map(Math.round), shell: [shell.left, shell.top, shell.right, shell.bottom].map(Math.round), open: pres.classList.contains('demo-tour-open'), togHit, hotspots: [] };
    for (const h of document.querySelectorAll('#hotspots .hotspot')) {
      if (h.hidden) continue;
      const r = h.getBoundingClientRect(); if (!r.width) continue;
      const lab = h.querySelector('.label').getBoundingClientRect();
      const cx = lab.left + lab.width / 2, cy = lab.top + lab.height / 2;
      const top = document.elementFromPoint(cx, cy);
      const overlap = Math.max(0, Math.min(lab.right, card.right) - Math.max(lab.left, card.left)) * Math.max(0, Math.min(lab.bottom, card.bottom) - Math.max(lab.top, card.top));
      out.hotspots.push({ label: h.textContent.trim().slice(0, 20), kind: h.dataset.kind, rect: [lab.left, lab.top, lab.right, lab.bottom].map(Math.round), coveredPct: Math.round(100 * overlap / (lab.width * lab.height)), centerHit: top ? (h.contains(top) ? 'self' : `${top.tagName.toLowerCase()}.${String(top.className).split(' ')[0]}`) : null });
    }
    return out;
  });
}
// screen rect of every projected person (from the 3D engine if exposed)
function watchdog(sec = 280) { setTimeout(() => { console.error(`watchdog: giving up after ${sec}s`); process.exit(2); }, sec * 1000).unref(); }
module.exports = { launch, open, ready, enter, shot, openKind, closeEverything, cover, sleep, watchdog, URL, OUT, VP };
