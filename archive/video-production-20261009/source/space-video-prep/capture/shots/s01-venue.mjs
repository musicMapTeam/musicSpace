// S01 (5.0 s) venue tour, no cursor: overview -> Lin close-up -> photo wall.  Mode: STATIC-capable (single viewer), RC4 verified.
import { hostRoom, guestRoom, uploadReal, PHOTO, outClip } from '../world.mjs';
import { sleep } from '../rec.mjs';
export const meta = { id: 'S01', mode: 'static+rc4', seconds: 5 };
export async function run({ browser, base }) {
  const A = await hostRoom(browser, base);
  const B = await guestRoom(browser, base, A.room, { session: { width: 1440, height: 744 } });
  await uploadReal(A, PHOTO.stage); await uploadReal(B, PHOTO.crowd);
  await B.close();
  await sleep(4500);                                   // A's poll picks up Lin + both photos (real time, before freezing)
  const x = A.page.locator('#panel-close'); if (await x.isVisible().catch(() => false)) { await x.click(); }
  await sleep(2600);                                   // camera settles back to the overview before we freeze the clock
  await A.hideCursor();
  await A.freeze();
  A.startRecording(outClip('S01'));
  await A.hold(0.4);
  await A.tap(A.page.locator('.hotspot', { hasText: 'Lin' }));          // camera glides to Lin (close-up)
  await A.hold(1.9);
  await A.tap(A.page.locator('nav.camera-nav button[data-view=photos]'));   // ...then to the photo wall
  await A.frames(Math.max(0, 300 - A.frame));          // exactly 5.00 s
  const r = await A.stopRecording(); await A.close(); return r;
}
