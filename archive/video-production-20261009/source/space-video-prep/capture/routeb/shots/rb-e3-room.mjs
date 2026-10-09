// RB-E3 (5 s) in the room: right after entering - the cast (阿遥·示例 / 小满·示例 / 北屿·示例 + you), heading 「回声现场 · 示例场」, venue 「月台 Livehouse（虚构场地）」, tour card 「示例路线 1/4」.
import { open, enterShowcase, OUT, UI } from '../rb.mjs';
export const meta = { id: 'RB-E3', seconds: 5, mode: 'static' };
export async function run({ browser, base }) {
  const A = await open(browser, base); await A.hideCursor(); await A.freeze(); await A.directorOn({ k: 4 });
  // enter while frozen would need real time for the runtime; so enter first (real time), freeze after the panel closed
  await A.unfreeze(); await enterShowcase(A); await A.freeze();
  A.startRecording(OUT('RB-E3'));
  await A.hold(1.6); await A.focusOn(A.page.locator('.world-shell'), { pad: 1.0, zmax: 1.18 }); await A.hold(1.8);
  await A.unfocus(); await A.frames(Math.max(0, 300 - A.frame));
  const r = await A.stopRecording(); await A.close(); return r;
}
