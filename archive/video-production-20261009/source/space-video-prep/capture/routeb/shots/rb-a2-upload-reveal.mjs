// RB-A2 (~22 s, cut in assembly into A2a 7.5 s / A2b 2.5 s / M1 10 s): tour-card button 「人海 · 示例照片」 -> form (拍摄于 21:48 · 来自照片自带的信息, 「AI 判断：人海」) -> 保存 -> wall: badge 「同一刻的另一面」 + reason + button (+ the pipeline ribbon).
// Selectors: ui.mjs (read from web/event-room/moment-upload.js + moment-wall.js).  UNTESTED against a booted Route B page.
import { open, enterShowcase, warmModel, btn, OUT, UI } from '../rb.mjs';
export const meta = { id: 'RB-A2', seconds: 22, mode: 'static (model pre-warmed in real time; the 10 MB download is never recorded)' };
export async function run({ browser, base }) {
  const A = await open(browser, base); await enterShowcase(A); await warmModel(A);
  await A.hideCursor(); await A.freeze(); await A.directorOn({ k: 5 }); const P = A.page;
  A.startRecording(OUT('RB-A2'));
  await A.hold(0.5); await A.showCursor();
  await A.click(P.locator(UI.tourSample('sample-crowd')), { move: 0.8, post: 0.5 });   // tour card inline sample button
  A.track(UI.panel, { pad: 1.05, zmax: 1.7 });
  await A.until(() => /拍摄于 \d{1,2}:\d{2}/.test(document.body.innerText) && /AI 判断：|不确定，请选择/.test(document.body.innerText), { max: 400 });
  await A.hold(2.6);                                                                  // reading time: time line + AI chip
  await A.click(btn(P, UI.save), { move: 0.6, post: 0.5 });
  A.unfocus();
  await A.until(() => !!document.querySelector('[data-moment-badge="other-side"]'), { max: 300 });   // the wall opens with the badge
  await A.focusOn(P.locator(UI.badgeBlock), { pad: 1.4, zmax: 1.75 }); await A.hold(4.2);          // badge + reason + button, readable
  A.track(UI.panel, { pad: 1.05, zmax: 1.55 }); await A.hold(3.0);                                  // the ribbon 「AI 建议视角 → 规则找同一刻 → 双方同意才交换」 and the byline 「AI 建议，未改动」
  await A.frames(Math.max(0, 1320 - A.frame));
  const r = await A.stopRecording(); await A.close(); return r;
}
