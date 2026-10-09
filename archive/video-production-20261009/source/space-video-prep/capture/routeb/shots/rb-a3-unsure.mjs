// RB-A3 (5 s) the honest case, on a fresh visitor: 「舞台 · 示例照片」 -> 「不确定，请选择」 with two dashed suggestions and nothing pre-selected -> the person taps 舞台.
// Selectors: ui.mjs (moment-upload.js: .moment-ai-tag--unsure, button[data-moment-viewpoint=stage]).  UNTESTED against a booted Route B page.
import { open, enterShowcase, warmModel, OUT, UI } from '../rb.mjs';
export const meta = { id: 'RB-A3', seconds: 5, mode: 'static' };
export async function run({ browser, base }) {
  const A = await open(browser, base); await enterShowcase(A); await warmModel(A);
  await A.hideCursor(); await A.freeze(); await A.directorOn({ k: 5 }); const P = A.page;
  A.startRecording(OUT('RB-A3'));
  await A.hold(0.3); await A.showCursor();
  await A.click(P.locator(UI.tourSample('sample-stage')), { move: 0.7, post: 0.3 });
  A.track(UI.panel, { pad: 1.05, zmax: 1.7 });
  await A.until(() => /不确定，请选择/.test(document.body.innerText), { max: 400 });
  await A.hold(1.4);
  await A.click(P.locator(UI.chip('stage')).first(), { move: 0.5, post: 0.5 });          // the person decides, the AI only suggested
  await A.frames(Math.max(0, 300 - A.frame));
  const r = await A.stopRecording(); await A.close(); return r;
}
