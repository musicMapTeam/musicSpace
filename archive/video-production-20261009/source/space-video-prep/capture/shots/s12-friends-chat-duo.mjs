// S12 (~12 s) A waves at Lin (close-up camera), B accepts in the ♡ inbox, they become friends and B sends a first message.  Mode: NODE x2.
import { twoPhones, PHONE_SINK, outClip } from '../world.mjs';
import { Duo, sleep } from '../rec.mjs';
export const meta = { id: 'S12', mode: 'node-x2', seconds: 12.5, compose: 'assembly/compose-duo.mjs S12-A.mp4 S12-B.mp4 -> S12.mp4' };
export async function run({ browser, base }) {
  const { A, B } = await twoPhones(browser, base, { upload: false });
  await sleep(4500);
  for (const s of [A, B]) { const x = s.page.locator('#panel-close'); if (await x.isVisible().catch(() => false)) await x.click(); }
  await sleep(600);
  await A.freeze(); await B.freeze();
  const duo = new Duo(A, B);
  A.startRecording(outClip('S12-A'), PHONE_SINK); B.startRecording(outClip('S12-B'), PHONE_SINK);
  const PA = A.page, PB = B.page;
  await duo.hold(0.6);
  await A.click(PA.locator('.hotspot', { hasText: 'Lin' }), { move: 0.4, post: 1.0 });                  // camera close-up on Lin
  await A.click(PA.getByRole('button', { name: /认识一下/ }), { move: 0.4, post: 0.4 });
  await A.click(PA.getByRole('button', { name: /向 Lin 招个手/ }), { move: 0.4, post: 0.6 });
  await B.click(PB.locator('#social-inbox'), { move: 0.4, post: 0.5 });                                    // B: ♡ inbox (after A's wave is in)
  await B.until(() => /想和你认识一下/.test(document.querySelector('#panel')?.innerText || ''), { max: 300 });
  await duo.hold(0.6);
  await B.click(PB.getByRole('button', { name: '愿意认识你' }), { move: 0.4, post: 0.8 });
  await B.click(PB.getByRole('button', { name: /朋友 · 1/ }), { move: 0.4, post: 0.6 });
  await B.click(PB.locator('#panel button', { hasText: '阿遥' }).first(), { move: 0.4, post: 0.6 });
  await B.click(PB.getByRole('button', { name: /和 阿遥 私聊/ }), { move: 0.4, post: 0.6 });
  await B.type(PB.locator('#chat-text'), '你拍到的人海好震撼！', { cps: 9 });
  await B.click(PB.getByRole('button', { name: /^发送/ }), { move: 0.4, post: 0.8 });
  await duo.hold(0.8);
  const [ra, rb] = await duo.stopRecording();
  await A.close(); await B.close();
  return { A: ra, B: rb };
}
