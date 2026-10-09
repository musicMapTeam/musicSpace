// RB-E1 (5 s) landing: the status line, the presence card 「同一刻，另一面。」 and the solid button 「进入示例现场」; director eases onto the card.
import { open, btn, sleep, OUT, UI } from '../rb.mjs';
export const meta = { id: 'RB-E1', seconds: 5, mode: 'static' };
export async function run({ browser, base }) {
  const A = await open(browser, base);
  await A.hideCursor(); await A.freeze(); await A.directorOn({ k: 4 });
  A.startRecording(OUT('RB-E1'));
  await A.hold(0.6);
  await A.focusOn('.presence', { pad: 1.5, zmax: 1.45 }); await A.hold(1.6);
  await A.showCursor(); await A.moveTo(...Object.values(await A.centerOf(btn(A.page, UI.enter))), 0.8); await A.hold(0.4);
  A.unfocus();
  await A.frames(Math.max(0, 300 - A.frame));
  const r = await A.stopRecording(); await A.close(); return r;
}
