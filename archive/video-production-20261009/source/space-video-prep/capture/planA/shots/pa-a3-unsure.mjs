// PA-A3 (7.5 s): the honest case.  A photo the model is not sure about: 「不确定，请选择」 + the two likeliest viewpoints dashed, nothing pre-selected; the person chooses.
import { open, toDemo, openMake, warmModel, PHOTOS, CLIP, btn, sleep, focusUnion, scrollDialog, DIALOG } from '../pa.mjs';
export const meta = { id: 'PA-A3', seconds: 7.5, mode: 'static (live 0.16)' };
export async function run({ browser, base }) {
  const s = await open(browser, base); const p = s.page;
  await toDemo(p); await openMake(p); await warmModel(p);
  await btn(p, /取消/).click(); await sleep(2400); await openMake(p);        // fresh editor: the custom tile opens the file chooser again
  await s.hideCursor(); await s.freeze(); await s.directorOn({ k: 5 });
  s.startRecording(CLIP('PA-A3'));
  await s.hold(0.3); await s.showCursor();
  s.track(DIALOG, { pad: 1.04, zmax: 1.55 });
  const chooser = p.waitForEvent('filechooser');
  await s.click(p.locator('button[data-photo=custom]'), { move: 0.8, post: 0.15 });
  (await chooser).setFiles(PHOTOS.unsure);
  await s.until(() => /不确定，请选择|AI 判断/.test(document.body.innerText), { max: 400 });
  await scrollDialog(s, 150, 0.7);
  s.unfocus(); await focusUnion(s, [p.locator('[data-ai-line]'), p.locator('.sp-viewpoint-options')], { pad: 1.12, zmax: 1.75 });
  await s.hold(2.0);
  await s.click(p.locator('button[data-viewpoint=crowd]'), { move: 0.7, post: 0.3 });   // the person chooses
  await s.hold(1.2);
  s.unfocus();
  await s.frames(Math.max(0, 450 - s.frame));
  const r = await s.stopRecording(); await s.close(); return r;
}
