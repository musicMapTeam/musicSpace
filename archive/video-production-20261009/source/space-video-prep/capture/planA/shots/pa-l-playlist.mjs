// PA-L (~24 s, ONE take, cut into L1 / K2 / ABOUT with the marks file): back from the ceremony -> 切到Lin -> 「同一刻的另一面」 under 阿遥's card + 「那晚的歌单」 (QQ 音乐搜索 link, not playback)
//   -> 收藏 (the stored double memory on the 3D shelf) -> the About sheet (what is real, what is fictional).
import fs from 'node:fs';
import { open, setupAgreed, CLIP, btn, focusUnion, scrollDialog, drift, sleep } from '../pa.mjs';
export const meta = { id: 'PA-L', seconds: 24, mode: 'static (live 0.16)' };
export async function run({ browser, base }) {
  const s = await open(browser, base); const p = s.page;
  await setupAgreed(p);                                                   // real time: through the ceremony
  await btn(p, /返回现场/).click(); await sleep(2400);
  await s.hideCursor(); await s.freeze(); await s.directorOn({ k: 5 });
  s.startRecording(CLIP('PA-L'));
  const marks = {}; const t = () => +(s.frame / 60).toFixed(2);
  marks.l1 = 0;
  s.track('#sp-local-scene', { pad: 1.05, zmax: 1.45 }); await s.hold(0.7); await s.showCursor();
  await s.click(btn(p, /切到Lin/), { move: 0.9, post: 0.3 });
  await s.hold(1.6);                                                      // Lin's page: 阿遥's card now carries 「同一刻的另一面」 + the reason
  await scrollDialog(s, 780, 1.4, 'main#main-content');
  s.unfocus();
  const list = p.getByText('那晚的歌单').first();
  await focusUnion(s, [list, p.getByRole('link', { name: /QQ 音乐搜索/ })], { pad: 1.5, zmin: 1.4, zmax: 1.8, dy: 30 });
  const link = p.getByRole('link', { name: /QQ 音乐搜索/ }); await s.moveTo((await link.boundingBox()).x + 60, (await link.boundingBox()).y + 8, 0.8);   // hover only: opening it would leave the page
  await drift(s, 3.0, { dz: 0.1, k: 0.45 });
  // ---------- K2: the keepsake shelf ----------
  marks.k2 = t();
  s.unfocus(); await s.click(p.locator('[data-world-view=records]').first(), { move: 0.9, post: 0.3 });
  await s.until(() => /交换后的双联记忆/.test(document.body.innerText), { max: 300 });
  s.track('main#main-content section, #main-content > *:last-child', { pad: 1.05, zmax: 1.1 });
  await drift(s, 3.8, { dz: 0.06, k: 0.4, x: s.W * 0.72, y: s.H * 0.5 });
  // ---------- About ----------
  marks.about = t();
  s.unfocus(); await s.click(p.locator('#demo-help'), { move: 0.9, post: 0.3 });
  await s.until(() => !!document.querySelector('dialog[open]') && /关于|示例/.test(document.querySelector('dialog[open]').innerText), { max: 240 });
  await drift(s, 3.2, { dz: 0.06, k: 0.4 });
  marks.end = t();
  const r = await s.stopRecording();
  fs.writeFileSync(CLIP('PA-L').replace(/\.mp4$/, '.marks.json'), JSON.stringify(marks, null, 1));
  await s.close(); return { ...r, marks };
}
