// S04 (7.5 s) wardrobe "今晚，我这样。": hair, glasses, top; save; back to the venue.  Mode: STATIC-capable, RC4 verified.
import { hostRoom, outClip } from '../world.mjs';
export const meta = { id: 'S04', mode: 'static+rc4', seconds: 7.5 };
export async function run({ browser, base }) {
  const A = await hostRoom(browser, base);
  await A.freeze();
  A.startRecording(outClip('S04'));
  const P = A.page;
  await A.hold(0.25);
  await A.click('#my-look', { move: 0.45, post: 0.2 });
  await A.hold(0.3);
  await A.click(P.locator('.wardrobe button', { hasText: '高马尾' }), { move: 0.35, post: 0.3 });
  await A.click(P.locator('.wardrobe-angle button', { hasText: '侧面' }), { move: 0.3, post: 0.45 });
  await A.click(P.locator('.wardrobe-angle button', { hasText: '3/4' }), { move: 0.25, post: 0.1 });
  await A.click(P.locator('.wardrobe button', { hasText: /^眼镜$/ }), { move: 0.3, post: 0.1 });
  await A.click(P.locator('.wardrobe button', { hasText: '厚方框' }), { move: 0.3, post: 0.3 });
  await A.click(P.locator('.wardrobe button', { hasText: /^上装$/ }), { move: 0.3, post: 0.1 });
  await A.click(P.locator('.wardrobe button', { hasText: '工装夹克' }), { move: 0.3, post: 0.35 });
  await A.click(P.getByRole('button', { name: /保存这个我/ }), { move: 0.4, post: 0.1 });
  await A.until(() => !document.querySelector('.wardrobe'), { max: 120 });
  await A.hold(0.6);
  await A.frames(Math.max(0, 450 - A.frame));          // exactly 7.50 s
  const r = await A.stopRecording(); await A.close(); return r;
}
