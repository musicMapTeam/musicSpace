// PA-A2 (22.5 s): make a card with the visitor's OWN photo: EXIF capture time + on-device AI viewpoint, song title, save -> the photo becomes a big polaroid on the 3D wall.
// Real UI only.  The model is warmed in real time first (the 10 MB first download is never in the take).  Photo = demo pack stage shot (EXIF 21:47:12, AI: 舞台, sure).
import { open, toDemo, openMake, warmModel, PHOTOS, CLIP, sleep, btn, focusUnion, scrollDialog, drift, DIALOG } from '../pa.mjs';
export const meta = { id: 'PA-A2', seconds: 22.5, mode: 'static (live 0.16)' };
export async function run({ browser, base }) {
  const s = await open(browser, base); const p = s.page;
  await toDemo(p); await openMake(p); await warmModel(p);
  await btn(p, /取消/).click(); await sleep(2600);                       // dialog closed, camera back on the photo wall + demo panel
  await s.hideCursor(); await s.freeze(); await s.directorOn({ k: 5 });
  s.startRecording(CLIP('PA-A2'));
  await s.hold(0.6); await s.showCursor();
  // 1) 「做一张卡」 -> the camera glides to the work desk, the card maker opens
  await s.click(btn(p, /做一张卡/), { move: 0.9, post: 0.2 });
  await s.until(() => !!document.querySelector('dialog.sp-dialog[open]'), { max: 300 });
  s.track(DIALOG, { pad: 1.04, zmax: 1.55 });
  await s.hold(1.1);
  // 2) 「用自己的照片」 -> the file chooser (answered by the harness; no native dialog in the frame)
  const tile = p.locator('button[data-photo=custom]');
  const chooser = p.waitForEvent('filechooser');
  await s.click(tile, { move: 0.8, post: 0.15 });
  (await chooser).setFiles(PHOTOS.stage);
  await s.until(() => /AI 判断|不确定/.test(document.body.innerText), { max: 400 });
  await s.hold(0.5);
  // 3) read it: capture time from the photo's own info + the AI line
  s.unfocus(); await focusUnion(s, [p.locator('.sp-photo-options'), p.locator('[data-ai-line]'), p.locator('[data-taken]')], { pad: 1.12, zmax: 1.75, dy: 10 });
  await drift(s, 3.6, { dz: 0.12, k: 0.45 });
  // 4) scroll to the song field, write 《晴天》
  s.unfocus(); s.track(DIALOG, { pad: 1.04, zmax: 1.55 });
  await scrollDialog(s, 420, 0.9);
  await s.type(p.locator('#sp-song-input'), '晴天', { cps: 3.2 });
  await s.hold(0.6);
  // 5) save -> the card becomes a polaroid on the 3D wall
  await s.click(p.getByRole('button', { name: /保存现场卡/ }), { move: 0.7, post: 0.3 });
  await s.until(() => /卡片已保存/.test(document.body.innerText), { max: 300 });
  s.unfocus(); await drift(s, 2.4, { dz: 0.1, k: 0.45, x: 700, y: 360 });
  s.unfocus();
  await s.frames(Math.max(0, 1350 - s.frame));                              // exactly 22.5 s
  const r = await s.stopRecording(); await s.close(); return r;
}
