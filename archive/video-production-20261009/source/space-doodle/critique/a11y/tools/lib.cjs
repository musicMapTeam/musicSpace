// Shared helpers for the a11y lens: browser/context presets, boot, navigation, and scanState()
// (DOM scan + text-hidden screenshot sampling for contrast).
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const { PNG } = require('/tmp/space-video-prep/tools/node_modules/pngjs');
const fs = require('fs');
const path = require('path');
const ROOT = '/tmp/space-doodle/critique/a11y';
const RUN = process.env.RUN || 'r1';
const URL = process.env.SPACE_URL || 'http://127.0.0.1:5190/';
const INPAGE = fs.readFileSync(path.join(ROOT, 'tools/inpage.js'), 'utf8');
const VP = {
  w320: { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  w390: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  w768: { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  w1440: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function launch() {
  return chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
}
async function open(browser, vp, opts = {}) {
  const ctx = await browser.newContext({ ...VP[vp], reducedMotion: opts.reducedMotion || 'no-preference', acceptDownloads: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(25000);
  const errors = [];
  page.on('pageerror', e => { errors.push(e.message.slice(0, 200)); console.log('[pageerror]', e.message.slice(0, 200)); });
  await page.goto(opts.url || URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
  await page.evaluate(() => document.fonts.ready);
  await sleep(1200);
  return { ctx, page, errors };
}
async function inject(page) { await page.evaluate(INPAGE); }
async function openKind(page, kind, id) {
  await page.evaluate(([k, i]) => { const b = document.createElement('button'); b.dataset.open = k; if (i) b.dataset.id = i; b.style.position = 'fixed'; b.style.left = '-9999px'; document.body.append(b); b.click(); b.remove(); }, [kind, id]);
  await sleep(1000);
}
async function people(page) { return page.evaluate(() => [...document.querySelectorAll('#hotspots [data-kind="person"]')].map(n => ({ id: n.dataset.sceneTarget, label: n.textContent.trim() }))); }
async function closeEverything(page) {
  await page.evaluate(() => { for (const s of ['.wardrobe:not([hidden]) .wardrobe-header>button', '.private-chat:not([hidden]) .chat-close', '.room-moderation:not([hidden]) header>button', '.photo-exchanges:not([hidden]) [data-x-close]']) { const b = document.querySelector(s); if (b && b.getClientRects().length) b.click(); } }).catch(() => {});
  await sleep(300);
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape').catch(() => {}); await sleep(150); }
  await page.evaluate(() => { for (const b of document.querySelectorAll('.community-panel:not([hidden])>header>button')) if (b.getClientRects().length) b.click(); const c = document.querySelector('#panel-close'); if (c && !document.querySelector('#panel').hidden) c.click(); }).catch(() => {});
  await sleep(400);
}
async function enter(page) {
  if (!(await page.locator('form[data-form="demo-entry"]').count())) await page.locator('#join').click();
  await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 20000 });
  await page.locator('form[data-form="demo-entry"] input[name=consent]').check();
  await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button[type=submit]')?.disabled, null, { timeout: 60000 });
  await page.locator('form[data-form="demo-entry"] button[type=submit]').click();
  await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"]'), null, { timeout: 60000 });
  await sleep(1500);
}

// ---------- pixel helpers ----------
const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lum = c => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const over = (top, a, base) => ({ r: top.r * a + base.r * (1 - a), g: top.g * a + base.g * (1 - a), b: top.b * a + base.b * (1 - a) });
function sampleItem(png, dpr, item) {
  const vals = []; const bgs = [];
  for (const rc of item.rects) {
    const x0 = Math.max(0, Math.floor(rc.l * dpr)), x1 = Math.min(png.width - 1, Math.ceil(rc.r * dpr) - 1);
    const y0 = Math.max(0, Math.floor(rc.t * dpr)), y1 = Math.min(png.height - 1, Math.ceil(rc.b * dpr) - 1);
    if (x1 <= x0 || y1 <= y0) continue;
    const sx = Math.max(1, Math.floor((x1 - x0) / 36)), sy = Math.max(1, Math.floor((y1 - y0) / 8));
    for (let y = y0; y <= y1; y += sy) for (let x = x0; x <= x1; x += sx) {
      const i = (y * png.width + x) * 4; const p = { r: png.data[i], g: png.data[i + 1], b: png.data[i + 2] };
      const t = over(item.color, item.alpha, p);
      let c = contrast(t, p);
      if (item.stroke) { const s = over(item.stroke.c, item.stroke.c.a * item.opacity, p); c = Math.max(c, contrast(s, p)); }
      vals.push(c); bgs.push(p);
      if (vals.length > 900) break;
    }
  }
  if (!vals.length) return null;
  const sorted = [...vals].sort((a, b) => a - b);
  const pick = q => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  const lumSorted = bgs.map(p => ({ p, l: lum(p) })).sort((a, b) => a.l - b.l);
  const med = lumSorted[Math.floor(lumSorted.length / 2)].p;
  // worst-case background colour (closest in luminance to the text)
  const tl = lum(item.color);
  const worst = bgs.reduce((w, p) => Math.abs(lum(p) - tl) < Math.abs(lum(w) - tl) ? p : w, bgs[0]);
  const hex = p => '#' + [p.r, p.g, p.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  return { p10: +pick(0.1).toFixed(2), p50: +pick(0.5).toFixed(2), min: +sorted[0].toFixed(2), n: vals.length, bgMedian: hex(med), bgWorst: hex(worst), textHex: hex(item.color) };
}

const HIDE_TEXT = `*,*::before,*::after{-webkit-text-fill-color:transparent!important;-webkit-text-stroke-color:transparent!important;text-shadow:none!important;text-decoration-color:transparent!important;caret-color:transparent!important}
::placeholder{-webkit-text-fill-color:transparent!important;color:transparent!important}`;

async function scanOnce(page, vp, label, k) {
  await inject(page);
  const data = await page.evaluate(() => window.__a11y.scan());
  const dir = path.join(ROOT, 'shots', RUN, vp); fs.mkdirSync(dir, { recursive: true });
  const shotFile = path.join(dir, `${label}${k ? '-' + k : ''}.png`);
  await page.screenshot({ path: shotFile });
  const handle = await page.addStyleTag({ content: HIDE_TEXT });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const buf = await page.screenshot();
  await handle.evaluate(n => n.remove());
  const png = PNG.sync.read(buf);
  for (const item of data.text) if (item.inView && item.rects.length) item.px = sampleItem(png, data.dpr, item);
  data.label = label; data.step = k; data.vp = vp; data.shot = shotFile; data.time = new Date().toISOString();
  const ddir = path.join(ROOT, 'data', RUN, vp); fs.mkdirSync(ddir, { recursive: true });
  fs.writeFileSync(path.join(ddir, `${label}${k ? '-' + k : ''}.json`), JSON.stringify(data));
  return data;
}

// scan the state; then page through the biggest visible inner scroller (and the document if it scrolls)
async function scanState(page, vp, label, opts = {}) {
  await page.evaluate(() => document.activeElement && document.activeElement !== document.body && document.activeElement.blur && document.activeElement.blur()).catch(() => {});
  await page.mouse.move(1, 1).catch(() => {});
  await sleep(opts.settle ?? 500);
  const out = [];
  try { out.push(await scanOnce(page, vp, label, 0)); } catch (e) { console.log(`[scan ${label}] failed`, e.message.split('\n')[0]); return out; }
  if (opts.noScroll) return out;
  await inject(page);
  const scs = await page.evaluate(() => window.__a11y.scrollers());
  // pick up to 2 scrollers: inner ones first (largest client height), then the root
  const idx = scs.map((s, i) => ({ ...s, i })).sort((a, b) => (a.sel === ':root') - (b.sel === ':root') || b.ch - a.ch).slice(0, opts.maxScrollers || 2);
  let k = 1;
  for (const s of idx) {
    const step = Math.max(120, Math.floor(s.ch * 0.8));
    const orig = s.top;
    for (let top = step; top < s.sh - s.ch + step && k < 12; top += step) {
      const got = await page.evaluate(([i, t]) => window.__a11y.scrollTo(i, t), [s.i, Math.min(top, s.sh - s.ch)]);
      if (got === null) break;
      await sleep(350);
      try { const d = await scanOnce(page, vp, label, k); d.scroller = s.sel; d.scrollTop = got; out.push(d); } catch (e) { console.log(`[scan ${label}-${k}] failed`, e.message.split('\n')[0]); }
      k++;
    }
    await page.evaluate(([i, t]) => window.__a11y.scrollTo(i, t), [s.i, orig]);
  }
  console.log(`[scan] ${vp} ${label}: ${out.length} positions, text ${out.reduce((n, d) => n + d.text.length, 0)}`);
  return out;
}

module.exports = { RUN, launch, open, inject, openKind, people, closeEverything, enter, scanState, scanOnce, sleep, VP, URL, ROOT, contrast, lum, over, sampleItem, PNG };
