// RB-A1 (10 s) the wall grouped by moment: 「21:47 · 同一刻 · 3 个视角：舞台 · 人海 · 细节」 and 「按拍摄时间分组（相差不超过 3 分钟），规则判断，不是 AI」.
// Selectors: ui.mjs (moment-wall.js: .moment-group__title / .moment-group__note).  UNTESTED against a booted Route B page.
import { open, enterShowcase, btn, OUT, UI } from '../rb.mjs';
export const meta = { id: 'RB-A1', seconds: 10, mode: 'static' };
export async function run({ browser, base }) {
  const A = await open(browser, base); await enterShowcase(A); await A.hideCursor(); await A.freeze(); await A.directorOn({ k: 5 }); const P = A.page;
  A.startRecording(OUT('RB-A1'));
  await A.hold(0.4); await A.showCursor();
  await A.click(P.locator(UI.hotspotPhoto), { move: 0.7, post: 1.2 });          // camera glides to the 3D wall
  await A.click(btn(P, UI.wallOpen), { move: 0.5, post: 0.8 });                  // wall list
  A.track(UI.panel, { pad: 1.05, zmax: 1.65 });
  await A.until(() => /同一刻 · \d+ 个视角/.test(document.body.innerText), { max: 180 });
  await A.hold(1.6);
  await A.focusOn(P.locator(UI.groupTitle).first(), { pad: 1.8, zmax: 1.75 });  // the header + the rule line under it
  await A.hold(3.2); A.unfocus();
  await A.frames(Math.max(0, 600 - A.frame));
  const r = await A.stopRecording(); await A.close(); return r;
}
