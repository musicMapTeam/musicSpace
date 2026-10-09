// S10 (~20 s) two-device split screen: A is waiting; B opens 照片交换, reads the preview, ticks consent, accepts; both show "交换已接受".  Mode: NODE x2.
import { twoPhones, sendExchangeReal, openWallReal, PHONE_SINK, outClip } from '../world.mjs';
import { Duo, sleep } from '../rec.mjs';
export const meta = { id: 'S10', mode: 'node-x2', seconds: 20, compose: 'assembly/compose-duo.mjs S10-A.mp4 S10-B.mp4 -> S10.mp4' };
export async function run({ browser, base }) {
  const { A, B } = await twoPhones(browser, base);
  await sleep(4500);
  await sendExchangeReal(A);                                         // A has asked (real time, not recorded: it is S09)
  const bx = B.page.locator('#panel-close'); if (await bx.isVisible().catch(() => false)) await bx.click();
  await openWallReal(B);   // B has the wall open (as a real user would)
  await A.freeze(); await B.freeze();
  const duo = new Duo(A, B);
  A.startRecording(outClip('S10-A'), PHONE_SINK); B.startRecording(outClip('S10-B'), PHONE_SINK);
  const PB = B.page;
  await duo.hold(2.4);                                                // A: 等待本人回应 | B: wall
  await B.click(PB.locator('#panel button:has-text("照片交换")'), { move: 0.5, post: 1.0 });
  await B.click(PB.locator('section.photo-exchanges button', { hasText: '阿遥' }).first(), { move: 0.5, post: 1.5 });
  await duo.hold(3.0);                                                // B reads: 阿遥提供的 限尺寸预览 ... (the viewer needs reading time)
  await B.click(PB.locator('section.photo-exchanges input[type=checkbox]'), { move: 0.5, post: 1.5 });
  await B.click(PB.locator('button.exchange-primary'), { move: 0.5, post: 0.8 });
  await B.until(() => /交换已接受/.test(document.querySelector('section.photo-exchanges')?.innerText || ''), { max: 180 });
  await duo.hold(2.0);
  // A refreshes by its own poll / "核对最新状态"
  await A.click(A.page.getByRole('button', { name: '核对最新状态' }), { move: 0.4, post: 0.6 });
  await A.until(() => /交换已接受/.test(document.querySelector('section.photo-exchanges')?.innerText || ''), { max: 240 });
  await duo.hold(3.0);
  const [ra, rb] = await duo.stopRecording();
  await A.close(); await B.close();
  return { A: ra, B: rb };
}
