// S05 (7.5 s) + S06 (5 s): upload -> capture time + on-device AI viewpoint chip (confident case), then the honest "不确定，请选择" case.
// RC4 has NO AI yet: without AI_BUILD=1 this records the upload flow only (useful as a rehearsal / fallback).  Mode: AI-BUILD (STATIC-capable; model pre-warmed in Cache Storage).
// Photos (EXIF times fictional): stage 21:47:12 -> AI "舞台" (sure, margin .057), crowd 21:48:03 -> "人海" (sure), unsure 21:50:20 -> "不确定" (3 min 8 s later = "not the same moment").
import { hostRoom, PHOTO, outClip } from '../world.mjs';
import { sleep } from '../rec.mjs';
import fs from 'node:fs';
const UI = JSON.parse(fs.readFileSync(new URL('../ui-map.json', import.meta.url), 'utf8'));
export const meta = { id: 'S05+S06', mode: 'ai-build', seconds: 12.5 };
const AI = process.env.AI_BUILD === '1';
export async function run({ browser, base }) {
  const A = await hostRoom(browser, base);
  const P = A.page;
  if (AI) {   // warm the model/runtime cache in real time (first download is ~10 MB and must not be in the video)
    await P.locator('#room-first-photo').click(); await sleep(400);
    await P.locator('#panel input[type=file]').setInputFiles(PHOTO.stage);
    await P.locator(UI.aiChip).first().waitFor({ timeout: 60000 }).catch(() => console.log('WARN: AI chip not found - check ui-map.json'));
    await P.locator('#panel-close').click(); await sleep(500);
  }
  await A.hideCursor(); await A.freeze(); await A.directorOn({ k: 5 });
  A.startRecording(outClip('S05'));
  await A.hold(0.3); await A.showCursor();
  await A.click(P.locator('#room-first-photo'), { move: 0.7, post: 0.4 });
  A.track('#panel', { pad: 1.06, zmax: 1.75 });                              // director: ease in on the upload panel and keep it framed
  await P.locator('#panel input[type=file]').setInputFiles(PHOTO.stage);                       // choosing a file has no cursor visual; the preview appears
  if (AI) { await A.until(([sel]) => !!document.querySelector(sel), { arg: [UI.aiChip.split(',')[0]], max: 300 }); await A.hold(2.0); }
  else await A.hold(1.2);
  await A.click(P.getByRole('button', { name: '保存这张照片' }), { move: 0.6, post: 0.6 });
  A.unfocus();
  await A.frames(Math.max(0, 450 - A.frame));
  const r1 = await A.stopRecording();
  // S06: the honest case on a third photo
  A.frame = 0; A.startRecording(outClip('S06'));
  await A.click(P.getByRole('button', { name: /放上我的一张/ }), { move: 0.6, post: 0.4 }).catch(() => {});
  A.track('#panel', { pad: 1.06, zmax: 1.75 });
  await P.locator('#panel input[type=file]').setInputFiles(PHOTO.unsure);
  if (AI) { await A.until(([sel]) => !!document.querySelector(sel), { arg: [UI.aiChipUnsure.replace('text=', '')], max: 300 }).catch(() => {}); }
  await A.hold(2.0);
  await A.frames(Math.max(0, 300 - A.frame));
  const r2 = await A.stopRecording(); await A.close();
  return { S05: r1, S06: r2 };
}
