// RB-K2 (5 s) 音乐探索: the Map opens in the same site (with a return bar 「返回现场」).
import { open, enterShowcase, OUT, UI, sleep } from '../rb.mjs';
export const meta = { id: 'RB-K2', seconds: 5, mode: 'static' };
export async function run({ browser, base }) {
  const A = await open(browser, base); await enterShowcase(A); const P = A.page;
  await A.hideCursor(); await A.freeze(); A.startRecording(OUT('RB-K2'));
  await A.hold(0.3); await A.showCursor(); await A.click(P.locator(UI.mapEntry), { move: 0.6, post: 0.3 });
  await A.until(() => /Music Map|音乐/.test(document.body.innerText) && !document.querySelector('#world'), { max: 500 }).catch(() => {});
  await A.frames(Math.max(0, 300 - A.frame));
  const r = await A.stopRecording(); await A.close(); return r;
}
