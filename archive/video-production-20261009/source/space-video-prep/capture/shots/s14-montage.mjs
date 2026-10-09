// S14 (4 x 2.5 s) breadth montage: a) 我的空间  b) 专辑世界杯 (four fictional albums)  c) 一起玩 (games)  d) Music Map record-table flip.  Mode: STATIC-capable, RC4 verified.
import { hostRoom, outClip } from '../world.mjs';
import { Session, sleep } from '../rec.mjs';
export const meta = { id: 'S14', mode: 'static+rc4', seconds: 10 };
const closeAll = async p => { await p.keyboard.press('Escape'); await sleep(700); };   // one Escape = back from the world-cup panel to the chat room (more Escapes close the chat)
export async function run({ browser, base }) {
  const out = [];
  // a) 我的空间
  { const A = await hostRoom(browser, base); await A.hideCursor(); await A.freeze(); A.startRecording(outClip('S14a'));
    await A.hold(0.3); await A.showCursor(); await A.click('#my-space', { move: 0.6, post: 0.3 }); await A.frames(Math.max(0, 150 - A.frame));
    out.push(await A.stopRecording()); await A.close(); }
  // b) world cup + c) games share one chat-room session (joined in real time)
  { const A = await hostRoom(browser, base); const p = A.page;
    await p.locator('#room-recap').click(); await sleep(1400);
    await p.getByRole('button', { name: /回到这一场的聊天室/ }).click(); await sleep(1400);
    await p.locator('.music-community input[name=consent]').check(); await p.getByRole('button', { name: /明确加入，继续聊/ }).click(); await sleep(2400);
    await p.getByRole('button', { name: /专辑世界杯/ }).click(); await sleep(1600);
    const f = p.locator('.worldcup-panel form'); await f.locator('input[name=title]').fill('今晚想先选哪张？'); await f.locator('input[name=consent]').check();
    await p.getByRole('button', { name: '发起四张专辑的世界杯' }).click(); await sleep(2400);
    await A.hideCursor(); await A.freeze(); A.startRecording(outClip('S14b'));
    await A.hold(0.5); await A.showCursor();
    await A.page.mouse.move(1000, 520); await A.hold(0.15);
    for (let i = 0; i < 10; i++) { await A.page.mouse.wheel(0, 70); await A.frames(5); }          // slow scroll through the four album cards
    await A.frames(Math.max(0, 150 - A.frame)); out.push(await A.stopRecording());
    await A.unfreeze(); await p.getByRole('button', { name: '回到聊天室讨论' }).click(); await sleep(1200);
    await p.getByRole('button', { name: /一起玩/ }).click(); await sleep(2200);
    await A.hideCursor(); await A.freeze(); A.frame = 0; A.startRecording(outClip('S14c'));
    await A.hold(0.6); await A.frames(Math.max(0, 150 - A.frame)); out.push(await A.stopRecording()); await A.close(); }
  // d) Music Map flip
  { const M = await Session.open(browser, { url: `${base}/music-map/#/explore`, name: 'map' }); await sleep(4500); await M.hideCursor(); await M.freeze(); M.startRecording(outClip('S14d'));
    await M.hold(0.4); await M.showCursor(); await M.click('button:has-text("翻开")', { move: 0.6, post: 0.3 }); await M.frames(Math.max(0, 150 - M.frame));
    out.push(await M.stopRecording()); await M.close(); }
  return { parts: out.map(o => ({ file: o.file, s: +o.seconds.toFixed(2) })) };
}
