// RB-K1 (6-8 s) recap -> 「保存我的纪念卡」 -> PNG preview; also saves the downloaded PNG for cards/card-k-memory.html (copy to cards/assets/memory-card.png).
import fs from 'node:fs';
import { open, enterShowcase, warmModel, btn, OUT, UI, sleep } from '../rb.mjs';
export const meta = { id: 'RB-K1', seconds: 8, mode: 'static' };
export async function run({ browser, base }) {
  const A = await open(browser, base); await enterShowcase(A); await warmModel(A); const P = A.page; let png = null;
  P.on('download', async d => { png = '/tmp/space-video-prep/clips/routeb/memory-card.png'; fs.mkdirSync('/tmp/space-video-prep/clips/routeb', { recursive: true }); await d.saveAs(png); });
  await A.hideCursor(); await A.freeze(); await A.directorOn({ k: 5 });
  A.startRecording(OUT('RB-K1'));
  await A.hold(0.3); await A.showCursor();
  await A.click(P.locator(UI.recap), { move: 0.7, post: 0.8 }); A.track(UI.panel, { pad: 1.05, zmax: 1.55 });
  await A.click(btn(P, UI.memorySave), { move: 0.5, post: 0.6 });
  await A.click(P.locator('.memory-materials .consent input'), { move: 0.4, post: 0.3 });
  await A.click(btn(P, UI.memoryDownload), { move: 0.5, post: 0.4 });
  await A.until(() => /你的纪念卡/.test(document.querySelector('#panel')?.innerText || ''), { max: 400 }); await A.hold(1.2);
  A.unfocus(); const r = await A.stopRecording(); await A.close(); return { ...r, png };
}
