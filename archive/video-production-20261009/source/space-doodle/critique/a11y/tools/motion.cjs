// Reduced-motion pass: with prefers-reduced-motion: reduce, record every CSS animation/transition that runs
// (event hooks + getAnimations polling), and check that the 3D canvas (line boil) is static.
// usage: node motion.cjs <vp> <reduce|no-preference>
const L = require('./lib.cjs');
const fs = require('fs');
const path = require('path');
const [, , vp = 'w390', mode = 'reduce'] = process.argv;
setTimeout(() => { console.error('watchdog'); process.exit(2); }, 9 * 60 * 1000).unref();
const sleep = L.sleep;
const OUT = path.join(L.ROOT, 'motion'); fs.mkdirSync(OUT, { recursive: true });

const RECORDER = () => {
  const seen = new Map();
  const sel = el => { if (!el || el.nodeType !== 1) return String(el); const p = []; for (let n = el, d = 0; n && n.nodeType === 1 && d < 3; n = n.parentElement, d++) { let s = n.tagName.toLowerCase(); if (n.id) { p.unshift(s + '#' + n.id); break; } const c = [...n.classList].slice(0, 2); if (c.length) s += '.' + c.join('.'); p.unshift(s); } return p.join(' > '); };
  const note = (kind, target, name, dur, iter, pseudo) => {
    const key = `${kind}|${sel(target)}${pseudo || ''}|${name}`;
    const prev = seen.get(key);
    if (prev) { prev.count++; prev.last = performance.now(); return; }
    seen.set(key, { kind, target: sel(target) + (pseudo || ''), name, dur, iter, count: 1, first: performance.now(), last: performance.now(), phase: window.__phase || '' });
  };
  document.addEventListener('animationstart', e => { const cs = getComputedStyle(e.target, e.pseudoElement || null); note('animationstart', e.target, e.animationName, cs.animationDuration, cs.animationIterationCount, e.pseudoElement); }, true);
  document.addEventListener('transitionstart', e => { const cs = getComputedStyle(e.target, e.pseudoElement || null); note('transitionstart', e.target, e.propertyName, cs.transitionDuration, '', e.pseudoElement); }, true);
  setInterval(() => {
    for (const a of document.getAnimations()) {
      if (a.playState !== 'running') continue;
      const t = a.effect && a.effect.getTiming ? a.effect.getTiming() : {};
      const target = a.effect && a.effect.target;
      const name = a.animationName || a.transitionProperty || a.id || a.constructor.name;
      note('running:' + a.constructor.name, target, name, t.duration, t.iterations, a.effect && a.effect.pseudoElement);
    }
  }, 60);
  window.__motionLog = () => [...seen.values()];
};

async function canvasStill(page, label) {
  const rect = await page.evaluate(() => { const c = document.querySelector('#world canvas'); if (!c) return null; const r = c.getBoundingClientRect(); const vw = innerWidth, vh = innerHeight; return { x: Math.max(0, r.left), y: Math.max(0, r.top), width: Math.min(vw, r.right) - Math.max(0, r.left), height: Math.min(vh, r.bottom) - Math.max(0, r.top) }; });
  if (!rect || rect.width < 10 || rect.height < 10) return { label, error: 'no canvas in view' };
  // hide every HTML overlay above the canvas so only WebGL pixels are compared
  const h = await page.addStyleTag({ content: '#hotspots,.scene-heading,.scene-code,.view-label,#context-actions,#demo-tour,.presence,#toast,#panel,.photo-exchanges,.loading{visibility:hidden!important}' });
  await sleep(300);
  const frames = [];
  for (let i = 0; i < 5; i++) { frames.push(L.PNG.sync.read(await page.screenshot({ clip: rect }))); await sleep(400); }
  await h.evaluate(n => n.remove());
  const res = [];
  for (let i = 1; i < frames.length; i++) {
    const A = frames[i - 1], B = frames[i]; let changed = 0;
    for (let k = 0; k < A.data.length; k += 4) { const d = Math.abs(A.data[k] - B.data[k]) + Math.abs(A.data[k + 1] - B.data[k + 1]) + Math.abs(A.data[k + 2] - B.data[k + 2]); if (d > 30) changed++; }
    res.push(+(changed / (A.width * A.height) * 100).toFixed(3));
  }
  fs.writeFileSync(path.join(OUT, `${vp}-${mode}-${label}-canvas.png`), L.PNG.sync.write(frames[0]));
  return { label, rect, changedPct: res };
}
async function domStill(page, label) {
  // whole-page diff with the canvas hidden: any DOM motion left?
  const h = await page.addStyleTag({ content: '#world canvas{visibility:hidden!important}' });
  await sleep(200);
  const A = L.PNG.sync.read(await page.screenshot()); await sleep(1300); const B = L.PNG.sync.read(await page.screenshot());
  await h.evaluate(n => n.remove());
  let changed = 0; let box = null;
  for (let y = 0; y < A.height; y++) for (let x = 0; x < A.width; x++) { const k = (y * A.width + x) * 4; const d = Math.abs(A.data[k] - B.data[k]) + Math.abs(A.data[k + 1] - B.data[k + 1]) + Math.abs(A.data[k + 2] - B.data[k + 2]); if (d > 40) { changed++; box = box ? { l: Math.min(box.l, x), t: Math.min(box.t, y), r: Math.max(box.r, x), b: Math.max(box.b, y) } : { l: x, t: y, r: x, b: y }; } }
  return { label, changed, box };
}
async function phase(page, name) { await page.evaluate(n => { window.__phase = n; }, name); }

(async () => {
  const b = await L.launch();
  const out = { vp, mode, canvas: [], dom: [], log: null };
  try {
    const ctx = await b.newContext({ ...L.VP[vp], reducedMotion: mode });
    await ctx.addInitScript(RECORDER);
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 160)));
    await page.goto(L.URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { window.__phase = 'loading'; });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
    await page.evaluate(() => document.fonts.ready); await sleep(1500);
    await phase(page, 'first');
    out.canvas.push(await canvasStill(page, 'first'));
    out.dom.push(await domStill(page, 'first'));
    await phase(page, 'join');
    await page.locator('#join').click(); await page.waitForSelector('form[data-form="demo-entry"]'); await sleep(1200);
    out.dom.push(await domStill(page, 'join'));
    await page.locator('form[data-form="demo-entry"] input[name=consent]').check();
    await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button[type=submit]')?.disabled, null, { timeout: 60000 });
    await phase(page, 'enter');
    await page.locator('form[data-form="demo-entry"] button[type=submit]').click();
    await page.waitForSelector(".frame[data-stage='room']", { timeout: 30000 }); await sleep(2500);
    const close = page.locator('#panel-close'); if (await close.isVisible().catch(() => false)) { await close.click(); await sleep(600); }
    await phase(page, 'room');
    out.canvas.push(await canvasStill(page, 'room'));
    out.dom.push(await domStill(page, 'room'));
    await phase(page, 'upload');
    await page.click('[data-tour-action="sample:sample-crowd"]');
    await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
    await page.waitForSelector('form[data-form="upload"] .moment-chip.is-ai, form[data-form="upload"] .moment-ai-tag', { timeout: 45000 }).catch(() => {});
    await sleep(800);
    out.dom.push(await domStill(page, 'upload'));
    const hasView = await page.evaluate(() => Boolean(document.querySelector('form[data-form="upload"] .moment-chip[aria-pressed="true"]')));
    if (!hasView) await page.click('form[data-form="upload"] .moment-chip[data-moment-viewpoint="crowd"]');
    await phase(page, 'wall');
    await page.click('form[data-form="upload"] button[type="submit"]');
    await page.waitForSelector('.moment-wall, .panel .photo-grid', { timeout: 30000 }); await sleep(2500);
    out.dom.push(await domStill(page, 'wall'));
    await phase(page, 'compose');
    await page.click('[data-moment-badge] [data-exchange-offer]');
    await page.waitForSelector('.photo-exchanges:not([hidden]) .exchange-pair', { timeout: 20000 }); await sleep(1500);
    out.dom.push(await domStill(page, 'compose'));
    await page.check('.photo-exchanges [data-x-consent]');
    await page.waitForFunction(() => !document.querySelector('.photo-exchanges [data-x-send]')?.disabled, null, { timeout: 20000 });
    await phase(page, 'pending');
    await page.click('.photo-exchanges [data-x-send]');
    await page.waitForFunction(() => /交换已接受/.test(document.querySelector('.photo-exchanges .exchange-status')?.textContent || ''), null, { timeout: 70000 }).catch(() => {});
    await phase(page, 'accepted'); await sleep(1500);
    out.dom.push(await domStill(page, 'accepted'));
    await L.closeEverything(page);
    await phase(page, 'photos-view');
    await page.locator('nav.camera-nav button[data-view="photos"]').click(); await sleep(3000);
    await L.closeEverything(page);
    out.canvas.push(await canvasStill(page, 'photos-view'));
    await phase(page, 'social');
    await L.openKind(page, 'conversation'); await sleep(2500);
    out.dom.push(await domStill(page, 'community'));
    await L.closeEverything(page);
    await page.locator('#my-look').click(); await sleep(2500);
    await phase(page, 'wardrobe');
    out.dom.push(await domStill(page, 'wardrobe'));
    await L.closeEverything(page);
    await phase(page, 'end');
    out.log = await page.evaluate(() => window.__motionLog());
  } catch (e) { console.log('FATAL', e.message.split('\n').slice(0, 3).join(' | ')); }
  finally {
    fs.writeFileSync(path.join(L.ROOT, 'data', `motion-${vp}-${mode}.json`), JSON.stringify(out, null, 1));
    console.log(JSON.stringify(out.canvas)); console.log(JSON.stringify(out.dom));
    for (const r of (out.log || [])) console.log(`${r.phase.padEnd(10)} ${r.kind.padEnd(26)} ${String(r.name).padEnd(22)} dur ${r.dur} it ${r.iter} x${r.count} ${r.target}`);
    await b.close();
  }
})();
