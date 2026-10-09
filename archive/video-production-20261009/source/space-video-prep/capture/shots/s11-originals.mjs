// S11 (7.5 s) "散场以后，也能回来看": from the recap, open 查看我的照片交换 and the accepted exchange with both originals.  Mode: NODE x2 for the setup; the recorded part is one browser.
import { hostRoom, guestRoom, uploadReal, sendExchangeReal, acceptExchangeReal, PHOTO, outClip } from '../world.mjs';
import { sleep } from '../rec.mjs';
export const meta = { id: 'S11', mode: 'node-x2 setup, single-browser recording', seconds: 7.5 };
export async function run({ browser, base }) {
  const A = await hostRoom(browser, base);
  const B = await guestRoom(browser, base, A.room, { session: { width: 1440, height: 744 } });
  await uploadReal(A, PHOTO.stage); await uploadReal(B, PHOTO.crowd); await sleep(4500);
  await sendExchangeReal(A); await acceptExchangeReal(B); await B.close();
  await A.page.getByRole('button', { name: '核对最新状态' }).click().catch(() => {}); await sleep(1500);
  for (let i = 0; i < 3; i++) { await A.page.keyboard.press('Escape'); await sleep(400); }              // close panels
  await A.page.locator('nav.camera-nav button[data-view=overview]').click().catch(() => {}); await sleep(2800);   // back to the overview (the recap button lives in the overview's presence box)
  await A.hideCursor(); await A.freeze();
  A.startRecording(outClip('S11'));
  const P = A.page;
  await A.hold(0.3); await A.showCursor();
  await A.click(P.locator('#room-recap'), { move: 0.6, post: 0.8 });
  await A.click(P.getByRole('button', { name: /查看我的照片交换/ }), { move: 0.6, post: 0.8 });
  await A.click(P.locator('section.photo-exchanges button', { hasText: 'Lin' }).first(), { move: 0.5, post: 0.6 });
  await A.until(() => /交换已接受/.test(document.querySelector('section.photo-exchanges')?.innerText || ''), { max: 180 });
  await A.frames(Math.max(0, 450 - A.frame));
  const r = await A.stopRecording(); await A.close(); return r;
}
