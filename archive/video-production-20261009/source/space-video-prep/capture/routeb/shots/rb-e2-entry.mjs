// RB-E2 (10-13 s raw; assembly speeds it to 10 s) entry: 「进入示例现场」 -> panel 「带上小人，进入示例现场」 -> 「现在换个造型 ↗」 (the product's own wardrobe: nickname + one look + 「保存这个我」, then back to the landing) -> 「进入示例现场」 again -> the ONE consent tick -> submit.
// Flow read from web/event-room/app.js (saveWardrobeProfile: the wardrobe saves the identity and returns to the page, the entry form then shows the saved name read-only) and entry-panel.js.
// E2_WARDROBE=0 records the short path instead (default avatar: nickname typed in the entry form -> tick -> submit, ~7 s).  UNTESTED against a booted Route B page.
import { open, btn, sleep, OUT, UI } from '../rb.mjs';
export const meta = { id: 'RB-E2', seconds: 11, mode: 'static' };
const WARDROBE = process.env.E2_WARDROBE !== '0';
export async function run({ browser, base }) {
  const A = await open(browser, base); const P = A.page;
  await A.hideCursor(); await A.freeze(); await A.directorOn({ k: 5 });
  A.startRecording(OUT('RB-E2'));
  await A.hold(0.3); await A.showCursor();
  await A.click(btn(P, UI.enter), { move: 0.6, post: 0.5 });
  A.track(UI.panel, { pad: 1.05, zmax: 1.5 });
  if (WARDROBE) {
    await A.click(btn(P, UI.wardrobeOpen), { move: 0.4, post: 0.6 });                  // wardrobe replaces the panel
    A.unfocus();
    await P.locator('.wardrobe-name input').fill('', { force: true });                 // the default 访客1234 is replaced (force: the clock is frozen, Playwright's rAF-based actionability would hang)
    await A.type(P.locator('.wardrobe-name input'), '阿宁', { cps: 6 });
    await A.click(P.locator('.wardrobe-examples summary'), { move: 0.4, post: 0.3 });
    await A.click(P.locator('.wardrobe button[data-preset="3"]'), { move: 0.3, post: 0.8 });
    await A.click(btn(P, UI.wardrobeSave), { move: 0.4, post: 0.8 });                  // toast 「小人已保存，下次碰面也能认出你」, back to the landing
    await A.click(btn(P, UI.enter), { move: 0.5, post: 0.5 });                         // the entry form again, now with the saved look
    A.track(UI.panel, { pad: 1.05, zmax: 1.5 });
  } else {
    await P.locator(UI.nickname).fill('', { force: true });
    await A.type(P.locator(UI.nickname), '阿宁', { cps: 6 });
  }
  await A.click(P.locator(UI.consentEntry), { move: 0.4, post: 0.4 });
  await A.click(P.locator('#panel form[data-form=demo-entry] button[type=submit]'), { move: 0.4, post: 0.3 });
  await A.until(() => /回声现场/.test(document.body.innerText), { max: 240 });
  A.unfocus(); await A.hold(1.0);
  const r = await A.stopRecording(); await A.close(); return r;
}
