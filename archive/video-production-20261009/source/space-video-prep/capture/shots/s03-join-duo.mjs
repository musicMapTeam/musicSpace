// S03 (~7.5 s) two-device split screen: B joins through A's invite; A sees Lin arrive.  Mode: NODE x2 (two browser identities on one real server).
import { twoPhones, hostRoom, guestRoom, PHONE, PHONE_SINK, connected, outClip } from '../world.mjs';
import { Duo, sleep } from '../rec.mjs';
export const meta = { id: 'S03', mode: 'node-x2', seconds: 7.5, compose: 'assembly/compose-duo.mjs S03-A.mp4 S03-B.mp4 -> S03.mp4' };
export async function run({ browser, base }) {
  const A = await hostRoom(browser, base, { session: PHONE });
  // B opens the invite link (real time) and stops at the join preview; the join itself is recorded
  const { Session } = await import('../rec.mjs');
  const B = await Session.open(browser, { url: `${base}/event-room/${A.room}`, name: 'guest', ...PHONE });
  await connected(B.page); await sleep(1000);
  await A.page.locator('#join').click(); await sleep(1200);          // A shows the invite panel (code + QR)
  await A.freeze(); await B.freeze();
  const duo = new Duo(A, B);
  A.startRecording(outClip('S03-A'), PHONE_SINK); B.startRecording(outClip('S03-B'), PHONE_SINK);
  await duo.hold(1.2);                                                // A: invite panel with the QR
  await A.click('#panel-close', { move: 0.01, pre: 0, post: 0.3 });
  const P = B.page;
  await B.click(P.getByRole('button', { name: '用默认小人，继续入场' }), { move: 0.4, post: 0.2 });
  await B.type(P.locator('#panel input[name=name]'), 'Lin', { cps: 7 });
  await B.click(P.getByRole('button', { name: '保存昵称，继续' }), { move: 0.4, post: 0.2 });
  await B.click(P.locator('#panel input[name=participation][value=open]'), { move: 0.3, post: 0.1 });
  await B.click(P.locator('#panel input[name=consent]'), { move: 0.3, post: 0.1 });
  await B.click(P.getByRole('button', { name: '我愿意，进入这一场' }), { move: 0.4, post: 0.1 });
  await A.until(() => /2 位已加入/.test(document.querySelector('.scene-code')?.innerText || ''), { max: 420 });
  await duo.hold(1.2);
  const [ra, rb] = await duo.stopRecording();
  await A.close(); await B.close();
  return { A: ra, B: rb };
}
