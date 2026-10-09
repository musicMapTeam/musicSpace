// Helpers for the photos fixer (read-only on the repo): boot a fresh example world on the shared dev server and walk the judge route.
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const path = require('path');

const BASE = process.env.SPACE_URL || 'http://127.0.0.1:5190/';
const OUT = process.env.OUT || '/tmp/space-doodle/shots/panels';
const VP = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  narrow: { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  p360: { viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  short: { viewport: { width: 390, height: 664 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  big: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
  laptop: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 },
  tablet: { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

// every run ends: a hung browser must not outlive the 5-minute shell budget
function watchdog(seconds = 240) { const t = setTimeout(() => { console.log('WATCHDOG: giving up'); process.exit(3); }, seconds * 1000); t.unref(); }

async function launch() { return chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }); }

async function open(browser, kind) {
  const context = await browser.newContext({ ...VP[kind], locale: 'zh-CN', acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  page.__errors = [];
  page.on('pageerror', e => { page.__errors.push(String(e.message).slice(0, 200)); console.log('[pageerror]', String(e.message).slice(0, 200)); });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 120000 });
  await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 60000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  return { context, page, kind, touch: Boolean(VP[kind].hasTouch) };
}

async function press(run, selector) {
  const l = run.page.locator(selector).first();
  await l.waitFor({ state: 'visible', timeout: 60000 });
  if (run.touch) await l.tap(); else await l.click();
}

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

const aiSettled = page => page.waitForFunction(() => /^(sure|unsure|off)/.test(document.querySelector('form[data-form="upload"] [data-ai-line]')?.getAttribute('data-ai-key') || ''), null, { timeout: 90000 }).then(() => true).catch(() => false);

/** Where the upload sheet sits: scroll, close button, heading, photo block, chips, AI line (rects relative to the viewport). */
async function uploadState(page) {
  return page.evaluate(() => {
    const panel = document.querySelector('#panel');
    const pr = panel.getBoundingClientRect();
    const R = sel => { const e = document.querySelector(sel); if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom)]; };
    const close = document.querySelector('#panel-close').getBoundingClientRect();
    const nav = document.querySelector('.camera-nav')?.getBoundingClientRect();
    const visTop = pr.top, visBottom = Math.min(pr.bottom, innerHeight, nav && nav.top > pr.top + 100 ? nav.top : innerHeight);
    const seen = sel => { const r = R(sel); return r ? (r[0] >= visTop - 1 && r[1] <= visBottom + 1 ? 'full' : r[1] <= visTop || r[0] >= visBottom ? 'out' : 'cut') : 'none'; };
    return {
      scrollTop: Math.round(panel.scrollTop), panel: [Math.round(pr.top), Math.round(pr.bottom)], visBottom: Math.round(visBottom),
      close: { top: Math.round(close.top), visible: close.bottom > pr.top + 2 && close.top >= pr.top - 2 },
      h2: seen('#panel-body > h2'), taken: R('form.moment-upload .moment-taken'), legend: seen('form.moment-upload .moment-view legend'), chips: seen('form.moment-upload .moment-chips'),
      aiTag: seen('form.moment-upload .moment-ai-tag'), hint: seen('form.moment-upload [data-viewpoint-hint]'), aiKey: document.querySelector('form.moment-upload [data-ai-line]')?.getAttribute('data-ai-key'),
      docScroll: document.scrollingElement.scrollTop, view: R('form.moment-upload .moment-view'), samples: seen('form.moment-upload .moment-samples'), polaroid: seen('form.moment-upload .photo-review'),
    };
  });
}

async function wallState(page) {
  return page.evaluate(() => {
    const panel = document.querySelector('#panel');
    const pr = panel.getBoundingClientRect();
    const nav = document.querySelector('.camera-nav')?.getBoundingClientRect();
    const visBottom = Math.min(pr.bottom, innerHeight, nav && nav.top > pr.top + 100 ? nav.top : innerHeight);
    const R = sel => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom)]; };
    const card = document.querySelector('#panel .moment-card--best');
    const kids = card ? [...card.children].map(c => c.className.split(' ')[0]) : [];
    const focusables = card ? [...card.querySelectorAll('button')].map(b => b.dataset.exchangeOffer ? 'offer' : b.classList.contains('photo-item') ? 'photo' : b.className) : [];
    return { scrollTop: Math.round(panel.scrollTop), visBottom: Math.round(visBottom), card: R('#panel .moment-card--best'), photo: R('#panel .moment-card--best .photo-item > span'), badgeTitle: R('#panel .moment-badge__title'), reason: R('#panel .moment-badge__reason'), offer: R('#panel [data-exchange-offer]'), meta: R('#panel .moment-card--best .moment-meta'), kids, focusables, overflowX: panel.scrollWidth > panel.clientWidth };
  });
}

async function shot(page, file, opts = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await sleep(opts.settle ?? 400);
  await page.screenshot({ path: file, ...(opts.clip ? { clip: opts.clip } : {}) });
  console.log('saved', file);
}

module.exports = { BASE, OUT, VP, sleep, watchdog, launch, open, press, enter, aiSettled, uploadState, wallState, shot };
