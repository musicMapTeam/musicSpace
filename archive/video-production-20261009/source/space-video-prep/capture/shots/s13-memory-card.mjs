// S13 (~10 s) recap -> "保存我的纪念卡" -> real PNG preview (+ the downloaded 1080x1440 PNG saved for the fly-in overlay).  Mode: STATIC-capable, RC4 verified.
import { hostRoom, uploadReal, PHOTO, outClip } from '../world.mjs';
import { sleep } from '../rec.mjs';
import fs from 'node:fs';
export const meta = { id: 'S13', mode: 'static+rc4', seconds: 10 };
export async function run({ browser, base }) {
  const A = await hostRoom(browser, base);
  await uploadReal(A, PHOTO.stage);
  await A.hideCursor();
  await A.freeze(); await A.directorOn({ k: 5 });
  A.startRecording(outClip('S13'));
  const P = A.page;
  let png = null; P.on('download', async d => { png = '/tmp/space-video-prep/clips/final/memory-card-A.png'; await d.saveAs(png); });
  await A.hold(0.4); await A.showCursor();
  await A.click(P.locator('#room-recap'), { move: 0.7, post: 0.9 });
  A.track('#panel', { pad: 1.05, zmax: 1.6 });
  await A.click(P.getByRole('button', { name: /保存我的纪念卡/ }), { move: 0.6, post: 0.7 });
  await A.click(P.locator('.memory-photo-options input').first(), { move: 0.5, post: 0.2 }).catch(() => {});
  await A.click(P.locator('.memory-avatar input'), { move: 0.4, post: 0.2 }).catch(() => {});
  await A.click(P.locator('.memory-materials .consent input'), { move: 0.4, post: 0.3 });
  await A.click(P.getByRole('button', { name: /下载纪念卡 PNG/ }), { move: 0.5, post: 0.4 });
  await A.until(() => /你的纪念卡/.test(document.querySelector('#panel')?.innerText || ''), { max: 300 });
  await A.hold(1.0);
  const r = await A.stopRecording(); await A.close(); return { ...r, png: png && fs.existsSync(png) ? png : null };
}
