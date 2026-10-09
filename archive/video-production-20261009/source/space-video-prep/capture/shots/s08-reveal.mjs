// S08 (10 s) the wall + "同一刻的另一面" reveal (two photos 21:47 stage / 21:48 crowd, reason sentence) and the honest negative (21:50 "不算同一刻").
// RC4 has no pairing UI: without AI_BUILD=1 this records the wall list and camera glide only.  Mode: AI-BUILD (rules, not AI) - NODE x2 or static with a seeded second attendee.
import { hostRoom, guestRoom, uploadReal, PHOTO, outClip } from '../world.mjs';
import { sleep } from '../rec.mjs';
import fs from 'node:fs';
const UI = JSON.parse(fs.readFileSync(new URL('../ui-map.json', import.meta.url), 'utf8'));
export const meta = { id: 'S08', mode: 'ai-build', seconds: 10 };
export async function run({ browser, base }) {
  const A = await hostRoom(browser, base);
  const B = await guestRoom(browser, base, A.room, { session: { width: 1440, height: 744 } });
  await uploadReal(A, PHOTO.stage); await uploadReal(B, PHOTO.crowd); await B.close(); await sleep(5000);
  const x = A.page.locator('#panel-close'); if (await x.isVisible().catch(() => false)) { await x.click(); await sleep(600); }
  await A.hideCursor(); await A.freeze();
  A.startRecording(outClip('S08'));
  const P = A.page;
  await A.hold(0.3); await A.showCursor();
  await A.click(P.locator('.hotspot.photo'), { move: 0.6, post: 1.2 });
  await A.click(P.locator('button:has-text("看照片")'), { move: 0.5, post: 0.8 });
  if (process.env.AI_BUILD === '1') { await A.until(([sel]) => !!document.querySelector(sel) || [...document.querySelectorAll('*')].some(e => /同一刻的另一面/.test(e.textContent || '')), { arg: ['.same-moment'], max: 300 }).catch(() => console.log('WARN: reveal not found')); await A.hold(3.0); }
  else await A.hold(2.0);
  await A.frames(Math.max(0, 600 - A.frame));
  const r = await A.stopRecording(); await A.close(); return r;
}
