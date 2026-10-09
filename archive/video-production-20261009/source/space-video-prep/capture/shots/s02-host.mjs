// S02 (10 s) host opens a livehouse room through the real UI (typing, consent, "开房并进入现场").  Mode: STATIC-capable, RC4 verified.
import { Session, sleep } from '../rec.mjs';
import { connected, outClip } from '../world.mjs';
export const meta = { id: 'S02', mode: 'static+rc4', seconds: 10 };
export async function run({ browser, base }) {
  const A = await Session.open(browser, { url: `${base}/event-room/`, name: 'host' });
  await connected(A.page); await sleep(800);
  await A.freeze();
  A.startRecording(outClip('S02'));
  const P = A.page;
  await A.hold(0.5);
  await A.click(P.getByRole('button', { name: '带上小人，进入现场' }), { move: 0.55, post: 0.2 });
  await A.click(P.getByRole('button', { name: /我是主办方/ }), { move: 0.4, post: 0.2 });
  await A.type(P.locator('#panel input[name=name]'), '阿遥', { cps: 7 });
  await A.click(P.getByRole('button', { name: '保存昵称，继续' }), { move: 0.4, post: 0.2 });
  await A.type(P.locator('#panel input[name=title]'), '返场夜', { cps: 8 });
  await A.type(P.locator('#panel input[name=venue]'), '月台 Livehouse', { cps: 16 });
  await A.click(P.locator('#panel input[name=participation][value=open]'), { move: 0.35, post: 0.1 });
  await A.click(P.locator('#panel input[name=consent]'), { move: 0.3, post: 0.1 });
  await A.click(P.getByRole('button', { name: '开房并进入现场' }), { move: 0.4, post: 0.1 });
  await A.until(() => /位已加入|正在进行/.test(document.querySelector('.scene-code')?.innerText || ''), { max: 180 });
  await A.hold(0.9);
  const r = await A.stopRecording(); await A.close(); return r;
}
