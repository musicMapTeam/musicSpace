// RB-S2 (2.5 s) quiet rule: 林间·示例 arrives ~8 s after you joined and cannot be greeted: 「TA 选择安静参与，不接收新招呼」.
import { open, enterShowcase, OUT, UI, sleep } from '../rb.mjs';
export const meta = { id: 'RB-S2', seconds: 2.5, mode: 'static' };
export async function run({ browser, base }) {
  const A = await open(browser, base); await enterShowcase(A); await sleep(9000);              // real time: let 林间 arrive
  await A.hideCursor(); await A.freeze(); await A.directorOn({ k: 6 }); const P = A.page;
  A.startRecording(OUT('RB-S2'));
  await A.tap(P.locator(UI.hotspot, { hasText: '林间' })); await A.hold(1.0);
  await A.focusOn(P.locator('#context-actions, ' + UI.panel), { pad: 1.2, zmax: 1.6 });
  await A.frames(Math.max(0, 150 - A.frame));
  const r = await A.stopRecording(); await A.close(); return r;
}
