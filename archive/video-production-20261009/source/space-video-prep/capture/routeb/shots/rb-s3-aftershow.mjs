// RB-S3 (10 s) after-show room: 散场聊天室 (seeded lines, labelled automatic), the album cup, the preference game.  Steps follow the RC4 S14 script (recap -> 回到这一场的聊天室 -> consent -> world cup / 一起玩).
import { open, enterShowcase, btn, OUT, UI, sleep } from '../rb.mjs';
export const meta = { id: 'RB-S3', seconds: 10, mode: 'static' };
export async function run({ browser, base }) {
  const A = await open(browser, base); await enterShowcase(A); const P = A.page;
  await P.locator(UI.recap).click(); await sleep(1400); await P.getByRole('button', { name: /回到这一场的聊天室/ }).click(); await sleep(1400);
  const c = P.locator('.music-community input[name=consent]'); if (await c.count()) { await c.check(); await P.getByRole('button', { name: /明确加入，继续聊/ }).click(); await sleep(2400); }
  await A.hideCursor(); await A.freeze(); await A.directorOn({ k: 5 });
  A.startRecording(OUT('RB-S3'));
  await A.hold(0.4); A.track(UI.panel, { pad: 1.05, zmax: 1.5 }); await A.hold(3.0);        // chat room with the seeded lines
  await A.click(P.getByRole('button', { name: /专辑世界杯|专辑杯/ }), { move: 0.6, post: 2.0 });                // the album cup
  await A.click(P.getByRole('button', { name: /一起玩/ }), { move: 0.5, post: 2.0 }).catch(() => {});             // the game
  A.unfocus(); await A.frames(Math.max(0, 600 - A.frame));
  const r = await A.stopRecording(); await A.close(); return r;
}
