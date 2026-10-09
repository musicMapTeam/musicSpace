// verify-14: independent repro of "upload sheet opens pre-scrolled" (read-only; never touches the repo)
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const URL = process.env.SPACE_URL || 'http://127.0.0.1:5190/';
const OUT = '/tmp/space-doodle/verify-14/prod';
const KINDS = (process.env.KINDS || 'phone,desktop').split(',');
const VP = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
  phoneTouch: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  desktop1280: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  desktop1920: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
setTimeout(() => { console.log('watchdog'); process.exit(3); }, 270000).unref();

const measure = () => {
  const p = document.querySelector('#panel');
  if (!p || p.hidden) return { panel: 'hidden' };
  const r = el => { if (!el) return null; const b = el.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height) }; };
  const pb = p.getBoundingClientRect();
  const cs = getComputedStyle(p);
  const close = document.querySelector('#panel-close');
  const cb = close.getBoundingClientRect();
  const h2 = p.querySelector('#panel-body h2');
  const hb = h2 && h2.getBoundingClientRect();
  const innerTop = pb.top + parseFloat(cs.borderTopWidth);
  const innerBottom = pb.bottom - parseFloat(cs.borderBottomWidth);
  const nav = document.querySelector('nav.camera-nav');
  return {
    scrollTop: Math.round(p.scrollTop), scrollHeight: p.scrollHeight, clientHeight: p.clientHeight,
    panel: r(p), panelPosition: cs.position, overflowY: cs.overflowY, scrollPaddingTop: cs.scrollPaddingTop,
    closePos: getComputedStyle(close).position, close: r(close), closeVisible: cb.bottom > innerTop + 2 && cb.top < innerBottom,
    h2: hb ? { top: Math.round(hb.top), bottom: Math.round(hb.bottom), text: h2.textContent.trim() } : null,
    h2FullyVisible: hb ? hb.top >= innerTop - 0.5 : null,
    h2HiddenPx: hb ? Math.max(0, Math.round(innerTop - hb.top)) : null,
    eyebrow: r(p.querySelector('#panel-body .eyebrow')),
    taken: r(p.querySelector('.moment-taken')), view: r(p.querySelector('.moment-view')),
    aiTag: !!p.querySelector('.moment-chip.is-ai, .moment-ai-tag, [data-moment-ai]'),
    nav: r(nav),
    photo: !!p.querySelector('form[data-form="upload"] .photo-review'),
    focus: document.activeElement ? (document.activeElement.id || document.activeElement.className || document.activeElement.tagName) : null,
  };
};

async function run(kind) {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const ctx = await browser.newContext(VP[kind]);
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log(kind, '[pageerror]', e.message.slice(0, 160)));
  await page.addInitScript(() => {
    window.__V14 = [];
    const t0 = () => Math.round(performance.now());
    const orig = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (...a) {
      const p = document.querySelector('#panel');
      const before = p ? p.scrollTop : null;
      const res = orig.apply(this, a);
      window.__V14.push({ t: t0(), what: 'scrollIntoView', el: (this.className || this.tagName) + '', arg: JSON.stringify(a[0]), before, after: p ? p.scrollTop : null, stack: (new Error().stack || '').split('\n').slice(2, 5).map(s => s.trim()).join(' | ') });
      return res;
    };
    const ofocus = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function (o) {
      const p = document.querySelector('#panel');
      const before = p ? p.scrollTop : null;
      const res = ofocus.call(this, o);
      if (p && !p.hidden && p.contains(this)) window.__V14.push({ t: t0(), what: 'focus', el: (this.id || this.className || this.tagName) + '', arg: JSON.stringify(o || null), before, after: p.scrollTop });
      return res;
    };
    let last = -1;
    document.addEventListener('scroll', e => { if (e.target && e.target.id === 'panel' && e.target.scrollTop !== last) { last = e.target.scrollTop; window.__V14.push({ t: t0(), what: 'scroll', top: last }); } }, true);
  });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
  await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 60000 }).catch(() => console.log('loading never hid'));
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await sleep(800);
  // judge route: 进入示例现场 -> consent -> 进入示例现场
  if (!(await page.locator('form[data-form="demo-entry"]').count())) await page.locator('button:visible', { hasText: '进入示例现场' }).first().click();
  await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 20000 });
  await page.locator('form[data-form="demo-entry"] input[name=consent]').check();
  await page.waitForSelector('form[data-form="demo-entry"] button[type=submit]:not([disabled])', { timeout: 60000 });
  await page.locator('form[data-form="demo-entry"] button[type=submit]').click();
  await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"]'), null, { timeout: 60000 });
  await sleep(2500);
  // route card 「人海 · 示例照片」
  const card = page.locator('[data-tour-action^="sample:"]:visible', { hasText: '人海' }).first();
  await card.waitFor({ timeout: 30000 });
  console.log(kind, 'route card button text:', (await card.textContent()).trim());
  await page.evaluate(() => { window.__V14.length = 0; window.__V14T = Math.round(performance.now()); });
  await card.click();
  const samples = [];
  for (const t of [150, 400, 800, 1500, 3000, 6000]) {
    const since = samples.length ? samples[samples.length - 1].t : 0;
    await sleep(t - since);
    const m = await page.evaluate(measure);
    samples.push({ t, ...m });
    console.log(kind, 't=' + t, JSON.stringify({ scrollTop: m.scrollTop, clientH: m.clientHeight, scrollH: m.scrollHeight, closeVisible: m.closeVisible, h2HiddenPx: m.h2HiddenPx, ai: m.aiTag, photo: m.photo, focus: m.focus }));
    if (t === 800) await page.screenshot({ path: `${OUT}/${kind}-t800.png` });
  }
  const last = samples[samples.length - 1];
  console.log(kind, 'final geometry', JSON.stringify(last));
  await page.screenshot({ path: `${OUT}/${kind}-t6000.png` });
  const log = await page.evaluate(() => window.__V14.map(e => ({ ...e, t: e.t - window.__V14T })));
  console.log(kind, 'events', JSON.stringify(log, null, 0));
  // what does the top of the sheet look like (the intended resting state)?
  await page.evaluate(() => { document.querySelector('#panel').scrollTop = 0; });
  await sleep(300);
  const top = await page.evaluate(measure);
  console.log(kind, 'at scrollTop 0', JSON.stringify({ closeVisible: top.closeVisible, h2HiddenPx: top.h2HiddenPx, view: top.view, taken: top.taken, panel: top.panel, clientH: top.clientHeight, nav: top.nav }));
  await page.screenshot({ path: `${OUT}/${kind}-scrolltop0.png` });
  await ctx.close();
  await browser.close();
}
(async () => { for (const k of KINDS) { try { await run(k); } catch (e) { console.log(k, 'FAILED', e.message.slice(0, 300)); } } process.exit(0); })();
