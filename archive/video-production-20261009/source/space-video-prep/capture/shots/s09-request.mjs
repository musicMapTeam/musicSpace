// S09 (~10 s) A taps Lin's photo and asks to swap: choose own photo, explicit consent, send.  Mode: STATIC-capable if the static build seeds a second attendee; else NODE x2 (RC4 verified on Node).
import { twoPhones, hostRoom, guestRoom, uploadReal, PHOTO, outClip } from '../world.mjs';
import { sleep } from '../rec.mjs';
export const meta = { id: 'S09', mode: 'node-x2 (A side only is recorded)', seconds: 10 };
export async function run({ browser, base }) {
  const A = await hostRoom(browser, base);
  const B = await guestRoom(browser, base, A.room, { session: { width: 1440, height: 744 } });
  await uploadReal(A, PHOTO.stage); await uploadReal(B, PHOTO.crowd); await B.close();
  await sleep(4500);
  const x = A.page.locator('#panel-close'); if (await x.isVisible().catch(() => false)) { await x.click(); await sleep(600); }
  await A.hideCursor();
  await A.freeze(); await A.directorOn({ k: 5 });
  A.startRecording(outClip('S09'));
  const P = A.page;
  await A.hold(0.4);
  await A.showCursor();
  await A.click(P.locator('.hotspot.photo'), { move: 0.7, post: 1.1 });                 // camera glides to the wall
  await A.click(P.locator('button:has-text("看照片")'), { move: 0.5, post: 0.7 });          // opens the wall list
  if (process.env.SHOT_DEBUG) console.log('PANEL', await P.evaluate(() => (document.querySelector('#panel')?.innerText || '').replace(/\n+/g, ' | ').slice(0, 400)), await P.evaluate(() => document.querySelector('#panel')?.className));
  A.track('#panel', { pad: 1.05, zmax: 1.6 });
  await A.click(P.locator('#panel button.photo-item', { hasText: 'Lin' }), { move: 0.6, post: 0.5 });
  await A.click(P.getByRole('button', { name: /用我的照片，交换这个视角/ }), { move: 0.6, post: 0.5 });
  await A.click(P.locator('section.photo-exchanges select'), { move: 0.5, post: 0.2 });
  await P.locator('section.photo-exchanges select').selectOption({ index: 1 }); await A.hold(0.5);
  await A.click(P.locator('section.photo-exchanges input[type=checkbox]'), { move: 0.45, post: 0.3 });
  await A.click(P.locator('button.exchange-primary'), { move: 0.5, post: 0.2 });
  await A.until(() => /等待本人回应/.test(document.querySelector('section.photo-exchanges')?.innerText || ''), { max: 150 });
  await A.hold(1.0);
  const r = await A.stopRecording(); await A.close(); return r;
}
