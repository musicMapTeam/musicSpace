// S00 (12.5 s) HOOK: the 3D livehouse in full-bleed 16:9 (cinematic.css) - real camera glides (overview -> person -> photo wall -> overview), slow digital push-ins, last guest arrives (8.9 s), title lockup on bar 5.
// One 96-BPM bar = 2.5 s: camera events fall on bar lines so cuts/glides can be locked to the music.  Mode: STATIC-capable (single viewer, no cursor).  RC4 rehearsal: guests are real second identities.
// Route B final: the cast (阿遥·示例, 小满·示例, 北屿·示例) is already in the room; 林间·示例 arrives ~8 s after the visitor joined - record that arrival instead of the staged `late` guest.
import fs from 'node:fs';
import { hostRoom, guestRoom, uploadReal, dress, PHOTO, outClip } from '../world.mjs';
import { sleep } from '../rec.mjs';
export const meta = { id: 'S00', mode: 'static+rc4', seconds: 12.5 };
const CSS = fs.readFileSync(new URL('../cinematic.css', import.meta.url), 'utf8');
const hot = (A, name) => A.page.evaluate(n => [...document.querySelectorAll('.hotspot')].find(e => e.textContent.includes(n))?.click(), name);
export async function run({ browser, base }) {
  const A = await hostRoom(browser, base, { name: '阿遥', session: { width: 1920, height: 1080, dpr: 1, cursor: false } });
  const P = A.page; const keep = [];
  await dress(A, 0); await uploadReal(A, PHOTO.stage);
  let k = 2;
  for (const [n, f] of [['小满', PHOTO.crowd], ['北屿', PHOTO.stage]]) {
    const g = await guestRoom(browser, base, A.room, { name: n, session: { width: 1000, height: 700 } });
    await dress(g, k++); if (f) await uploadReal(g, f); keep.push(g);
  }
  await sleep(6500);                                                   // A's own 5 s poll picks up the two guests (real time, before the freeze)
  const x = P.locator('#panel-close'); if (await x.isVisible().catch(() => false)) await x.click();
  await sleep(2200);
  await A.addCss(CSS); await sleep(1800);                             // full-bleed canvas, chrome hidden
  await A.freeze();                                                    // from here A only learns about people when we say so
  const late = await guestRoom(browser, base, A.room, { name: 'Lin', session: { width: 1000, height: 700 } });   // joins while A is frozen: A does not know yet
  await dress(late, 5);
  A.startRecording(outClip('S00'), { w: 1920, h: 1080 });
  const reset = () => A.page.evaluate(() => { const e = document.querySelector('.world-shell'); e.getAnimations().forEach(a => a.cancel()); e.style.transform = ''; });
  await A.push('.world-shell', 1.0, 1.07, 2.5, { origin: '38% 58%' });
  await A.hold(2.5);                                                   // bar 1 (0-2.5 s): overview, slow push-in
  await reset(); await hot(A, '小满'); await A.push('.world-shell', 1.0, 1.05, 1.55, { origin: '50% 62%' }); await A.hold(2.5);   // bar 2: glide to 小满 (0.95 s) + hold
  await reset(); await A.page.evaluate(() => document.querySelector('.hotspot.photo')?.click()); await A.push('.world-shell', 1.0, 1.06, 1.55, { origin: '50% 50%' }); await A.hold(2.5);   // bar 3: photo wall
  await reset(); await A.page.evaluate(() => document.querySelector('nav.camera-nav button[data-view=overview]').click()); await A.push('.world-shell', 1.05, 1.0, 1.4, { origin: '45% 55%' });
  await A.hold(1.4);                                                   // bar 4 (7.5-10 s): pull back to the overview ...
  await A.page.evaluate(() => window.dispatchEvent(new Event('focus')));   // ... A refreshes at 8.9 s: Lin's avatar arrives
  await A.until(() => [...document.querySelectorAll('.hotspot')].some(e => e.textContent.includes('Lin')), { max: 120 });
  await A.hold(1.1);
  await reset(); await A.push('.world-shell', 1.0, 1.05, 2.5, { origin: '45% 60%' }); await A.hold(2.5);   // bar 5 (10-12.5 s): hold; the title lockup is composited on top in assembly
  await A.frames(Math.max(0, 750 - A.frame));                         // exactly 12.50 s
  const r = await A.stopRecording(); await A.close(); for (const g of [...keep, late]) await g.close(); return r;
}
