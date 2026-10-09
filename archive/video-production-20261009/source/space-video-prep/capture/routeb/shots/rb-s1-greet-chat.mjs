// RB-S1 (15 s) social: open 小满·示例 -> 「向 小满·示例 招个手」 -> accepted (~3-5 s, two welcome lines) -> 「和 小满·示例 私聊」 -> type a line -> automatic reply (~3-5 s).
import { open, enterShowcase, btn, OUT, UI, sleep } from '../rb.mjs';
export const meta = { id: 'RB-S1', seconds: 15, mode: 'static (cast answers automatically)' };
export async function run({ browser, base }) {
  const A = await open(browser, base); await enterShowcase(A); await A.hideCursor(); await A.freeze(); await A.directorOn({ k: 5 }); const P = A.page;
  A.startRecording(OUT('RB-S1'));
  await A.hold(0.3); await A.showCursor();
  await A.click(P.locator(UI.hotspot, { hasText: '小满' }), { move: 0.7, post: 1.0 });
  await A.click(P.getByRole('button', { name: /认识一下/ }), { move: 0.4, post: 0.4 }).catch(() => {});
  A.track(UI.panel, { pad: 1.05, zmax: 1.55 });
  await A.click(btn(P, UI.greetBtn), { move: 0.5, post: 0.5 });
  await A.until(() => /已愿意认识|欢迎|朋友/.test(document.body.innerText) && /私聊/.test(document.body.innerText), { max: 700 });   // NPC accepts after ~2.5-5 s virtual
  await A.hold(0.8);
  await A.click(btn(P, UI.chatBtn), { move: 0.5, post: 0.5 });
  await A.type(P.locator('#chat-text'), '你拍到的舞台好美！', { cps: 7 });
  await A.click(P.getByRole('button', { name: /^发送/ }), { move: 0.4, post: 0.4 });
  await A.hold(4.5);                                                                // automatic reply arrives inside this window (frames keep stepping)
  A.unfocus(); await A.frames(Math.max(0, 900 - A.frame));
  const r = await A.stopRecording(); await A.close(); return r;
}
