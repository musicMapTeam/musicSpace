// Shared helpers for the P2/P3/cut-out pass.  Real-time setup steps (never recorded) + small DOM probes.
// Uses the proven rig read-only: /tmp/space-video-doodle/capture-test/rec2.mjs (Session, fake clock, frame-stepped recording) and
// the pure helpers of flow.mjs (scrollTo / scrollNow / focusUnion / untilCameraSettled).  Never edits the build or the repo.
import { Session, PHONE, sleep } from '/tmp/space-video-doodle/capture-test/rec2.mjs';
export { scrollTo, scrollNow, focusUnion, untilCameraSettled } from '/tmp/space-video-doodle/capture-test/flow.mjs';
export { sleep };

export const BASE = process.env.SPACE_BASE || 'http://127.0.0.1:48311/musicSpace/';
export const ROOT = '/tmp/space-video-doodle/prod/capture/P2P3';
// on-screen clock (chat times, 保存于 date): an evening after the build (built 2026-10-07 04:13 +08:00)
export const CLOCK = process.env.CLOCK_START || '2026-10-07T22:40:00+08:00';   // same as TAKE-P1 and the desktop takes (SHOTS.md §1)
export const VIEW = {
  phone: PHONE,                                                   // 390x845 CSS @ 36/13 = 1080x2340
  desktop: { width: 1440, height: 810, dpr: 4 / 3, mobile: false }, // 1920x1080
  desk4k: { width: 1440, height: 810, dpr: 8 / 3, mobile: false },  // 3840x2160 (stills of the 3D room)
};
export const NICK = '阿宁';
export const PRESET = 4;   // 失真
// the text caret blinks on Chrome's real-time timer, not on the rig's virtual clock: hidden in typing takes (as Playwright's own
// screenshots do with caret:'hide'), otherwise it flickers at random
export const NO_CARET = 'input,textarea,[contenteditable]{caret-color:transparent!important}';

/** fresh visitor (new context = new example world), booted, fonts ready; clock follows real time until s.freeze() */
export async function openApp(browser, V, { cursor, name, clockStart = CLOCK, css = '' } = {}) {
  const s = await Session.open(browser, { url: BASE, ...V, cursor: cursor ?? (V.mobile ? 'touch' : 'arrow'), name: name || (V.mobile ? 'phone' : 'desktop'), clockStart, css });
  await s.page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 60000 });
  await s.page.evaluate(() => document.fonts.ready);
  await sleep(2000);
  return s;
}

/** real time: entry panel -> 「现在换个造型」 -> preset 失真 -> nickname 阿宁 -> save -> entry panel again -> consent -> enter.
 *  Returns when the room is on screen.  (SHOTS.md TAKE-P1 steps 2-5, unrecorded.) */
export async function lookAndEnter(s, { nick = NICK, preset = PRESET, participation = 'open' } = {}) {
  const p = s.page;
  await p.locator('#join').click();
  await p.waitForSelector('form[data-form="demo-entry"] button.primary:not([disabled])', { timeout: 60000 });
  await p.locator('form[data-form="demo-entry"] button', { hasText: '现在换个造型' }).first().click();
  await p.waitForSelector('.wardrobe', { timeout: 30000 }); await sleep(1200);
  const sum = p.locator('.wardrobe summary', { hasText: '试试组合示例' }).first();
  await sum.scrollIntoViewIfNeeded(); await sum.click(); await sleep(400);
  const pre = p.locator(`[data-preset="${preset}"]`); await pre.scrollIntoViewIfNeeded(); await pre.click(); await sleep(500);
  const nickField = p.locator('.wardrobe input[aria-label="昵称"]'); if (await nickField.count()) await nickField.fill(nick);
  await p.locator('[data-wardrobe-save]').first().click();
  await p.waitForFunction(() => { const w = document.querySelector('.wardrobe'); return !w || !w.getClientRects().length; }, null, { timeout: 30000 }).catch(() => {});
  await sleep(1300);
  await p.locator('#join').click();
  await p.waitForSelector('form[data-form="demo-entry"] button.primary:not([disabled])', { timeout: 60000 });
  const nameField = p.locator('form[data-form="demo-entry"] input[name=name]');
  if (await nameField.count() && await nameField.isEditable()) await nameField.fill(nick);
  const part = p.locator(`form[data-form="demo-entry"] input[name=participation][value=${participation}]`);
  if (await part.count()) await part.check();
  await p.locator('form[data-form="demo-entry"] input[name=consent]').check();
  await p.locator('form[data-form="demo-entry"] button.primary').click();
  await p.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"]') && /回声现场/.test(document.body.innerText), null, { timeout: 60000 });
  await sleep(600);
}

/** s.freeze() + keep every animation that already exists where it is.  The rig registers an animation the first time it steps it
 *  and starts it at 0, so entrance animations that had finished (fill: forwards) would replay in the first frames of a take.
 *  Here finished ones are marked done and running ones continue from their current time (boil loops stay in phase). */
export async function freezeKeep(s) {
  await s.freeze();
  return s.page.evaluate(() => {
    let kept = 0, done = 0;
    for (const a of document.getAnimations()) {
      try {
        if (a.playState === 'finished') { window.__done.add(a); done++; continue; }
        const ct = Number(a.currentTime);
        if (Number.isFinite(ct)) { window.__anims.set(a, window.__vnow - ct); a.pause(); kept++; }
      } catch (e) { /* ignore */ }
    }
    return { kept, done };
  });
}

/** the first output frame that showed a state `until` has just confirmed (until checks after each captured frame) */
export const confirmedFrame = s => Math.max(0, s.sink.frames - 1);

/** visible clickable things with their data-* hooks (selector discovery) */
export async function buttons(page, filter = () => true) {
  const all = await page.evaluate(() => [...document.querySelectorAll('button,a,summary,[role=button],input,select,textarea')]
    .filter(b => b.getClientRects().length && getComputedStyle(b).visibility !== 'hidden')
    .map(b => {
      const r = b.getBoundingClientRect();
      const data = Object.entries(b.dataset).map(([k, v]) => `data-${k.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}=${v}`).join(' ');
      return `${b.tagName.toLowerCase()} ${(b.textContent || b.value || b.name || '').trim().replace(/\s+/g, ' ').slice(0, 40)}${b.id ? ' #' + b.id : ''}${b.name ? ' name=' + b.name : ''}${data ? ' [' + data + ']' : ''} @${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`;
    }));
  return all.filter(filter);
}
export const text = (page, sel = 'body') => page.evaluate(s => (document.querySelector(s)?.innerText || '').replace(/\n{2,}/g, '\n').slice(0, 5000), sel);
export const box = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }, sel);
