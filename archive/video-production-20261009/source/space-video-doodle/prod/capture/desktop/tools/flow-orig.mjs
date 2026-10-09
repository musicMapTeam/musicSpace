// Shared steps for the capture tests: real-time setup (not recorded) and recorded helpers (frame-stepped).
import { Session, PHONE, DESKTOP, sleep, OUT_FPS } from './rec2.mjs';
export const BASE = process.env.SPACE_BASE || 'http://127.0.0.1:47811/musicSpace/';
export const OUT = f => `/tmp/space-video-doodle/capture-test/clips/${f}`;
export const SEL = {
  landingEnter: p => p.getByRole('button', { name: '进入示例现场', exact: true }).first(),
  consent: '#panel form[data-form=demo-entry] input[name=consent]',
  submit: '#panel form[data-form=demo-entry] button[type=submit]',
  tourSample: id => `.demo-tour [data-tour-action="sample:${id}"]`,
  person: name => `#hotspots .hotspot[data-kind=person]:has-text("${name}")`,
  nav: v => `nav.camera-nav button[data-view=${v}]`,
  aiTag: '.moment-ai-tag',
  save: '#panel form[data-form="upload"] button[type=submit]',
  badge: '[data-moment-badge="other-side"]',
  offer: '[data-exchange-offer]',
  xChoice: 'select[data-x-choice]', xConsent: '[data-x-consent]', xSend: '[data-x-send]',
  panel: '#panel', panelClose: '#panel-close',
};

/** fresh visitor (new context = empty IndexedDB/localStorage), booted, fonts ready, clock still following real time */
export async function openApp(browser, V, { cursor, name } = {}) {
  const s = await Session.open(browser, { url: BASE, ...V, cursor: cursor ?? (V.mobile ? 'touch' : 'arrow'), name: name || (V.mobile ? 'phone' : 'desktop') });
  await s.page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 60000 });
  await s.page.evaluate(() => document.fonts.ready);
  await sleep(2500);
  return s;
}
/** real time: landing -> entry sheet -> consent -> enter; returns when the room (cast + tour card) is on screen */
export async function enterRoom(s) {
  const p = s.page;
  await SEL.landingEnter(p).click(); await sleep(900);
  await p.locator(SEL.consent).check(); await sleep(250);
  await p.locator(SEL.submit).click();
  await p.waitForFunction(() => /回声现场/.test(document.body.innerText) && document.querySelector('#panel')?.hidden && document.querySelector('.demo-tour:not([hidden])'), null, { timeout: 30000 });
  await sleep(1800);
}
/** real time: run the on-device model once (stage sample), then close the sheet without saving, so the recorded take never waits on
 *  the WASM compile / session start (those are real-time work and would make the 'thinking' state last a random number of frames) */
export async function warmModel(s, sample = 'sample-stage') {
  const p = s.page; const t = Date.now();
  await p.locator(SEL.tourSample(sample)).click();
  await p.waitForFunction(() => /AI 判断：|不确定，请选择/.test(document.querySelector('#panel')?.innerText || ''), null, { timeout: 90000 });
  const ms = Date.now() - t;
  await sleep(400); await p.locator(SEL.panelClose).click();
  await p.waitForFunction(() => document.querySelector('#panel')?.hidden && document.querySelector('.demo-tour:not([hidden])'), null, { timeout: 15000 });
  await sleep(900);
  return ms;
}
/** real time: crowd sample -> AI verdict -> save -> wall with the other-side badge (desktop exchange setup) */
export async function crowdOnWall(s) {
  const p = s.page;
  await p.locator(SEL.tourSample('sample-crowd')).click();
  await p.waitForFunction(() => /AI 判断：|不确定，请选择/.test(document.querySelector('#panel')?.innerText || ''), null, { timeout: 90000 });
  await sleep(500);
  await p.locator(SEL.save).click();
  await p.waitForFunction(sel => !!document.querySelector(sel), SEL.badge, { timeout: 30000 });
  await sleep(1500);
}
/** the scroll container of an element (first ancestor that really scrolls) */
const SCROLLER = `(el => { let sc = el.parentElement; while (sc && !(sc.scrollHeight > sc.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement; return sc || document.scrollingElement; })`;
/** instant (real-time setup) scroll so that `selector` sits at `block` of its scroller */
export async function scrollNow(s, selector, { block = 'center', offset = 0 } = {}) {
  return s.page.evaluate(([sel, block, offset, SC]) => {
    const el = document.querySelector(sel); if (!el) return false; const sc = eval(SC)(el);
    const er = el.getBoundingClientRect(), sr = sc === document.scrollingElement ? { top: 0, height: innerHeight } : sc.getBoundingClientRect();
    const to = sc.scrollTop + (er.top - sr.top) - (block === 'center' ? (sr.height - er.height) / 2 : block === 'end' ? sr.height - er.height : 0) + offset;
    sc.scrollTo({ top: Math.max(0, Math.min(sc.scrollHeight - sc.clientHeight, to)), behavior: 'instant' }); return true;
  }, [selector, block, offset, SCROLLER]);
}
/** recorded, eased scroll of the element's scroller so that `selector` ends at `block` (frame-exact, no CSS smooth scrolling) */
export async function scrollTo(s, selector, { seconds = 0.6, block = 'center', offset = 0 } = {}) {
  const info = await s.page.evaluate(([sel, block, offset, SC]) => {
    const el = document.querySelector(sel); if (!el) return null; const sc = eval(SC)(el);
    const er = el.getBoundingClientRect(), sr = sc === document.scrollingElement ? { top: 0, height: innerHeight } : sc.getBoundingClientRect();
    let to = sc.scrollTop + (er.top - sr.top) - (block === 'center' ? (sr.height - er.height) / 2 : block === 'end' ? sr.height - er.height : 0) + offset;
    to = Math.max(0, Math.min(sc.scrollHeight - sc.clientHeight, to)); window.__scrollEl = sc; return { from: sc.scrollTop, to };
  }, [selector, block, offset, SCROLLER]);
  if (!info) return null;
  if (Math.abs(info.to - info.from) < 2) return info;
  const n = Math.max(1, Math.round(seconds * OUT_FPS)); const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  for (let i = 1; i <= n; i++) {
    const y = info.from + (info.to - info.from) * ease(i / n);
    await s.page.evaluate(v => window.__scrollEl.scrollTo({ top: v, behavior: 'instant' }), y);
    await s.frames(1);
  }
  return info;
}
export const camState = s => s.page.evaluate(() => { const c = window.__SPACE_EVENT_QA__().camera; return { view: c.view, moving: c.moving }; });
/** step (and capture) until the 3D camera move has finished */
export async function untilCameraSettled(s, max = 240) { await s.frames(2); return s.until(() => !window.__SPACE_EVENT_QA__().camera.moving, { max }); }
export { PHONE, DESKTOP, sleep };
/** director: aim at the union box of several elements (CSS px) so it fills ~1/pad of the frame (zoom clamped) */
export async function focusUnion(s, sels, { pad = 1.2, zmin = 1.0, zmax = 1.8, dy = 0, k } = {}) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const sel of sels) { const b = await s.page.locator(sel).first().boundingBox().catch(() => null); if (!b) continue; x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height); }
  if (x1 < x0) return false;
  const w = x1 - x0, h = y1 - y0, z = Math.max(zmin, Math.min(zmax, Math.min(s.W / (w * pad), s.H / (h * pad))));
  s.focus({ x: (x0 + x1) / 2, y: (y0 + y1) / 2 + dy, z, k }); return { x0, y0, x1, y1, z };
}
