// PA-A1 (10 s): the front door -> 「体验示例」 -> the demo room on the 3D photo wall.  Real clicks, real camera glide.
import { open, CLIP, btn, focusUnion } from '../pa.mjs';
export const meta = { id: 'PA-A1', seconds: 10, mode: 'static (live 0.16)' };
export async function run({ browser, base }) {
  const s = await open(browser, base); const p = s.page;
  await s.hideCursor(); await s.freeze(); await s.directorOn({ k: 4 });
  s.startRecording(CLIP('PA-A1'));
  await s.hold(0.5);
  await focusUnion(s, ['.home-hero', '.home-paper'], { pad: 1.08, zmax: 1.5, k: 3 });      // read the three steps
  await s.hold(2.9);
  await s.showCursor();
  await s.click(btn(p, /体验示例/), { move: 0.9, post: 0.25 });
  s.unfocus({ k: 3 });
  await s.until(() => !!document.querySelector('#sp-local-scene'), { max: 240 });
  s.track('#sp-local-scene', { pad: 1.05, zmax: 1.45 });
  await s.hold(3.0);
  s.unfocus();
  await s.frames(Math.max(0, 600 - s.frame));
  const r = await s.stopRecording(); await s.close(); return r;
}
