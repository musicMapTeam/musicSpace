// Shared steps for the desktop takes: real-time setup (not recorded) and recorded helpers (frame-stepped).
// Adapted from /tmp/space-video-doodle/capture-test/flow.mjs and animatic/capture/clip-d-room.mjs (visitor 阿宁 in look 失真).
// rc2 (2026-10-08): copy of ../../desktop/tools/flow4k.mjs for the 0.22.0-rc.2 build (/tmp/space-final/dist-pages): new ROOT and port,
// the wardrobe's preset group is now 「试试现成搭配」 (was 「试试组合示例」), and textAudit() greps the visible DOM text for old copy.
import { Session, OUT_FPS, sleep } from './rig.mjs';
export const BASE = process.env.SPACE_BASE || 'http://127.0.0.1:48931/musicSpace/';
export const ROOT = '/tmp/space-video-doodle/prod/capture/desktop-rc2';
export const DRY = !!process.env.DRY;   // dry run: CSS 1440x810 @1, files under dry/ (selector and timing check only)
export const OUT = id => DRY ? ({ master: `${ROOT}/dry/${id}.mp4`, edit: null }) : ({ master: `${ROOT}/master/${id}.mp4`, edit: `${ROOT}/1080/${id}.mp4` });
export const SEL = {
  join: '#join',
  entryForm: 'form[data-form="demo-entry"]',
  consent: '#panel form[data-form=demo-entry] input[name=consent]',
  submit: '#panel form[data-form=demo-entry] button.primary',
  tour: '.demo-tour:not([hidden])',
  tourSkip: '[data-tour-skip]',
  tourSample: id => `.demo-tour [data-tour-action="sample:${id}"]`,
  person: name => `#hotspots .hotspot[data-kind=person]:has-text("${name}")`,
  nav: v => `nav.camera-nav button[data-view=${v}]`,
  aiTag: '.moment-ai-tag',
  save: '#panel form[data-form="upload"] button[type=submit]',
  badge: '[data-moment-badge="other-side"]',
  offer: '[data-exchange-offer]',
  xChoice: 'select[data-x-choice]', xConsent: '[data-x-consent]', xSend: '[data-x-send]', xClose: '[data-x-close]',
  panel: '#panel', panelClose: '#panel-close',
};
export const qa = s => s.page.evaluate(() => { try { const q = window.__SPACE_EVENT_QA__(); return { view: q.camera?.view, moving: q.camera?.moving, members: q.members.map(m => m.name), photos: q.photos.length, pending: q.pending, social: { in: q.social.incoming.length, out: q.social.outgoing.length, friends: q.social.friends.length } }; } catch (e) { return { err: String(e) }; } });

/** fresh visitor (new context = empty IndexedDB/localStorage), booted, fonts ready, clock still following real time */
export async function openApp(browser, V, { cursor = 'touch', name = 'desktop', clockStart } = {}) {
  await clearServerLog();
  const s = await Session.open(browser, { url: BASE, ...V, cursor, name, ...(clockStart ? { clockStart } : {}) });
  await s.page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 60000 });
  await s.page.evaluate(() => document.fonts.ready);
  await sleep(2500);
  return s;
}
/** real time: wait until the model files have been served (the product warms the model itself after entering).  rc2 fetches them off
 *  the main thread (not in the page's resource timeline), so this reads the prefix server's own request log (GET /__log of
 *  serve-prefix.mjs; cleared by clearServerLog() when the take's context opens, and this rig is the only client of its server). */
export const SERVER = new URL(BASE).origin;
export async function clearServerLog() { try { await fetch(`${SERVER}/__clear`); } catch {} }
export async function waitModel(s, { timeout = 30000 } = {}) {
  const t = Date.now(); let ok = false, seen = [];
  while (Date.now() - t < timeout) {
    try { seen = (await (await fetch(`${SERVER}/__log`)).json()).filter(l => /\/ai\//.test(l)); } catch {}
    if (seen.some(l => /\/ai\/tc8\/.*\.onnx/.test(l)) && seen.some(l => /\/ai\/ort\/.*\.wasm/.test(l))) { ok = true; break; }
    await sleep(250);
  }
  await sleep(1500);
  return { ms: Date.now() - t, modelFilesSeen: ok, requests: seen.slice(0, 6) };
}
/** real time: landing -> entry sheet -> wardrobe (look 失真 = preset 4, nickname 阿宁) -> save -> entry sheet -> consent -> enter.
 *  Returns when the room is on screen (panel closed). */
export async function enterAsAning(s, { log = console.log } = {}) {
  const p = s.page;
  await p.locator(SEL.join).click();
  await p.waitForSelector(`${SEL.entryForm} button.primary:not([disabled])`, { timeout: 60000 });
  await p.locator(`${SEL.entryForm} button`, { hasText: '现在换个造型' }).first().click();
  await sleep(1500);
  const sum = p.locator('.wardrobe details:has([data-preset]) > summary').first();   // 「试试现成搭配」 (rc2)
  await sum.scrollIntoViewIfNeeded(); await sum.click(); await sleep(400);
  const pre = p.locator('[data-preset="4"]'); await pre.scrollIntoViewIfNeeded(); await pre.click(); await sleep(600);
  const nick = p.locator('.wardrobe input[aria-label="昵称"]'); if (await nick.count()) await nick.fill('阿宁');
  await p.locator('[data-wardrobe-save]').first().click(); await sleep(1500);
  await p.locator(SEL.join).click();
  await p.waitForSelector(`${SEL.entryForm} button.primary:not([disabled])`, { timeout: 60000 });
  const nameField = p.locator(`${SEL.entryForm} input[name=name]`);
  if (await nameField.count() && await nameField.isEditable()) await nameField.fill('阿宁');
  await p.locator(SEL.consent).check();
  await p.locator(SEL.submit).click();
  await p.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"]') && /回声现场/.test(document.body.innerText), null, { timeout: 60000 });
  await sleep(600);
  log('entered; members', JSON.stringify((await qa(s)).members));
}
/** real time: wait until 林间 has arrived (she joins ~8 s after the visitor), then a little more */
export async function waitForCast(s, { timeout = 30000 } = {}) {
  const t = Date.now();
  await s.page.waitForFunction(() => window.__SPACE_EVENT_QA__().members.some(m => /林间/.test(m.name)) && [...document.querySelectorAll('#hotspots .hotspot[data-kind=person]')].some(e => /林间/.test(e.innerText)), null, { timeout });
  await sleep(1500);
  return Date.now() - t;
}
export async function skipTour(s) {
  const skip = s.page.locator(`${SEL.tourSkip}:visible`);
  if (await skip.count()) { await skip.first().click(); await sleep(900); return true; }
  return false;
}
/** real time: click a camera view and wait for the move to finish */
export async function viewNow(s, v) {
  await s.page.locator(SEL.nav(v)).click();
  await sleep(200);
  await s.page.waitForFunction(() => !window.__SPACE_EVENT_QA__().camera.moving, null, { timeout: 15000 });
  await sleep(600);
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
  // eased (cubic in-out) and quantised to whole CSS pixels (Chrome draws these scrollers on a 1 CSS px grid even at DPR 8/3, so a
  // smaller step would render as a repeated frame): the start waits until the ease moves a full pixel, the tail snaps to the target
  // once the step drops under 1 px -> every captured frame of a scroll moves
  const n = Math.max(1, Math.round(seconds * OUT_FPS)); const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const px = 1; let last = info.from;
  for (let i = 1; i <= n; i++) {
    let y = info.from + (info.to - info.from) * ease(i / n);
    const next = info.from + (info.to - info.from) * ease(Math.min(1, (i + 1) / n));
    if (i > n / 2 && Math.abs(next - y) < px) y = info.to;                       // tail: snap
    y = Math.round(y / px) * px;
    if (Math.abs(y - last) < px * 0.5 && i <= n / 2) continue;                    // head: skip frames that would not move (no frame is captured)
    await s.page.evaluate(v => window.__scrollEl.scrollTo({ top: v, behavior: 'instant' }), y);
    await s.frames(1); last = y;
    if (y === info.to) break;
  }
  return info;
}
export const camState = s => s.page.evaluate(() => { const c = window.__SPACE_EVENT_QA__().camera; return { view: c.view, moving: c.moving }; });
/** step (and capture) until the 3D camera move has finished */
export async function untilCameraSettled(s, max = 400) { await s.frames(2); return s.until(() => !window.__SPACE_EVENT_QA__().camera.moving, { max }); }
/** per-frame probe for the 3D takes: view, moving flag, camera position + target */
export const CAM_PROBE = () => { try { const c = window.__SPACE_EVENT_QA__().camera; return [c.view, c.moving ? 1 : 0, ...c.camera.position.map(v => +v.toFixed(4)), ...c.camera.target.map(v => +v.toFixed(4))]; } catch { return null; } };
export { sleep };

/** words that must not be on screen (the owner's 2026-10-07 copy decisions; COPY-PLAN "Never in UI copy"); 本页 per the capture brief */
export const BANNED = /示例|虚构|本页|演示|自动回复|不是真人|没有服务器|只存在这个浏览器|模拟|本地体验版|在线访问|等待本人回应/;
/** grep the text the camera can see: document.body.innerText (rendered text only: display:none / visibility:hidden / [hidden] are
 *  not in it; text scrolled out of a panel is, so this is a superset of the frame) + title / aria-label / placeholder / alt / value of
 *  rendered elements.  Returns { hits: [..], chars } */
export async function textAudit(s) {
  return s.page.evaluate(src => {
    const re = new RegExp(src, 'g'); const hits = [];
    const txt = document.body.innerText || '';
    for (const line of txt.split('\n')) if (line.match(re)) hits.push('text: ' + line.trim().slice(0, 140));
    for (const el of document.querySelectorAll('[title],[aria-label],[placeholder],[alt],input[value],textarea')) {
      if (!el.getClientRects().length) continue;
      for (const a of ['title', 'aria-label', 'placeholder', 'alt', 'value']) { const v = a === 'value' ? el.value : el.getAttribute(a); if (v && String(v).match(re)) hits.push(`${a}: ${String(v).slice(0, 140)}`); }
    }
    return { hits, chars: txt.length };
  }, BANNED.source);
}
