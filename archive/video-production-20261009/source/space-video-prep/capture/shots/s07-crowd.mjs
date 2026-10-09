// S07 (2.5 s) Lin (second identity) saves the crowd photo: capture time + AI chip "人海".  RC4 has no AI chip: records the upload flow only.  Mode: AI-BUILD; NODE x2 (Lin's browser) or static with a seeded second attendee.
import { hostRoom, guestRoom, PHOTO, outClip } from '../world.mjs';
import { sleep } from '../rec.mjs';
import fs from 'node:fs';
const UI = JSON.parse(fs.readFileSync(new URL('../ui-map.json', import.meta.url), 'utf8'));
export const meta = { id: 'S07', mode: 'ai-build', seconds: 2.5 };
export async function run({ browser, base }) {
  const A = await hostRoom(browser, base);
  const B = await guestRoom(browser, base, A.room, { session: { width: 1440, height: 744 } });
  await A.close();
  const P = B.page;
  await B.hideCursor(); await B.freeze();
  B.startRecording(outClip('S07'));
  await B.hold(0.2); await B.showCursor();
  await B.click(P.locator('#room-first-photo'), { move: 0.4, post: 0.2 });
  await P.locator('#panel input[type=file]').setInputFiles(PHOTO.crowd);
  if (process.env.AI_BUILD === '1') await B.until(([sel]) => !!document.querySelector(sel), { arg: [UI.aiChip.split(',')[0]], max: 240 }).catch(() => {});
  await B.hold(0.8);
  await B.click(P.getByRole('button', { name: '保存这张照片' }), { move: 0.4, post: 0.2 });
  await B.frames(Math.max(0, 150 - B.frame));
  const r = await B.stopRecording(); await B.close(); return r;
}
