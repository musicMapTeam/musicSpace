// PA-M (~36 s, ONE continuous take, cut into M1 / M2 / D1 in assembly with the marks file):
//   M1  the request dialog: 「同一刻的另一面」 + the reason (rules, not AI)             ->  marks.m2
//   M2  send -> 「等待阿遥回应」 -> 切到阿遥 -> 查看申请 (the reason flips) -> 同意交换        ->  marks.d1
//   D1  the double-ticket ceremony (stamp 「双方同意」) -> 保存双联图片 -> the 1600x1800 PNG preview
// The visitor is Lin, the other side is the fictional 阿遥; both live in this one browser (the page says so: 「本地示例」).  The PNG the page exports is saved for the keepsake card.
import fs from 'node:fs';
import { open, setupRequest, downloadTicket, CLIP, btn, focusUnion, scrollDialog, drift, DIALOG } from '../pa.mjs';
export const meta = { id: 'PA-M', seconds: 36, mode: 'static (live 0.16)' };
export async function run({ browser, base }) {
  const s = await open(browser, base); const p = s.page;
  await setupRequest(p);                                                  // real time: own photo (21:47) saved, 阿遥's card opened, the request dialog showing
  await s.hideCursor(); await s.freeze(); await s.directorOn({ k: 5 });
  s.startRecording(CLIP('PA-M'));
  const marks = {}; const t = () => +(s.frame / 60).toFixed(2);
  // ---------- M1 ----------
  marks.m1 = 0;
  s.track(DIALOG, { pad: 1.04, zmax: 1.55 }); await s.hold(0.7);
  const badge = p.locator(DIALOG).getByText('同一刻的另一面').first();
  s.unfocus(); await focusUnion(s, [badge, badge.locator('xpath=..')], { pad: 1.35, zmin: 1.5, zmax: 2.0, dy: 40 });
  await drift(s, 4.6, { dz: 0.14, k: 0.45 });
  s.unfocus(); s.track(DIALOG, { pad: 1.04, zmax: 1.5 });
  await scrollDialog(s, 120, 0.9); await s.hold(2.4);
  // ---------- M2 ----------
  marks.m2 = t();
  await s.showCursor();
  await s.click(btn(p, /发送申请/), { move: 0.9, post: 0.3 });
  s.unfocus(); await s.until(() => /等待阿遥回应/.test(document.body.innerText), { max: 300 });
  s.track('#sp-local-scene', { pad: 1.05, zmax: 1.45 }); await s.hold(1.6);
  await s.click(btn(p, /切到阿遥/), { move: 0.8, post: 0.3 }); await s.hold(1.0);
  await s.click(btn(p, /查看申请/), { move: 0.8, post: 0.3 });
  s.unfocus(); await s.until(() => !!document.querySelector('dialog.sp-dialog[open]') && /要交换这两张卡吗/.test(document.body.innerText), { max: 300 });
  const badge2 = p.locator(DIALOG).getByText('同一刻的另一面').first();
  await focusUnion(s, [badge2, badge2.locator('xpath=..')], { pad: 1.35, zmin: 1.5, zmax: 2.0, dy: 40 }); await drift(s, 2.4, { dz: 0.12, k: 0.5 });
  s.unfocus(); s.track(DIALOG, { pad: 1.04, zmax: 1.5 }); await s.hold(0.4);
  await s.click(btn(p, /同意交换/), { move: 0.8, post: 0.2 });
  s.unfocus();
  await s.until(() => !!document.querySelector('dialog.duet-ceremony[open]'), { max: 300 });
  await s.hold(2.2);
  // ---------- D1 ----------
  marks.d1 = t();
  await s.hold(3.0);                                                      // the stamp lands
  await s.click(btn(p, /保存双联图片/), { move: 0.9, post: 0.3 });
  await s.until(() => /双联图片已生成/.test(document.body.innerText), { max: 300 });
  s.focus({ x: s.W / 2, y: s.H / 2, z: 1.0 }); await drift(s, 3.6, { dz: 0.07, k: 0.4 });
  marks.end = t();
  const r = await s.stopRecording();
  fs.writeFileSync(CLIP('PA-M').replace(/\.mp4$/, '.marks.json'), JSON.stringify(marks, null, 1));
  await s.unfreeze();
  await downloadTicket(p, '/tmp/space-video-prep/cards/assets/ticket-planA.png').catch(e => console.log('WARN: ticket download failed', String(e).slice(0, 120)));
  await s.close(); return { ...r, marks };
}
