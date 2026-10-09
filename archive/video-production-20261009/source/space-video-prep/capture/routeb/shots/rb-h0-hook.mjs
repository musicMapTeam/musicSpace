// RB-H0 (12.5 s) HOOK: the 3D showcase room in full-bleed 16:9 (cinematic.css): overview push-in -> 小满·示例 close-up -> photo wall -> pull back (-> 林间·示例 arrives if it falls in the window); the title lockup is composited in assembly on bar 5 (10-12.5 s).
// Camera events on 2.5 s bars (96 BPM).  UNTESTED against a Route B build; the RC4 equivalent (shots/s00-hook.mjs) was run and is the reference.
import fs from 'node:fs';
import { open, enterShowcase, sleep, OUT, UI } from '../rb.mjs';
export const meta = { id: 'RB-H0', seconds: 12.5, mode: 'static' };
const CSS = fs.readFileSync(new URL('../../cinematic.css', import.meta.url), 'utf8');
const hot = (A, name) => A.page.evaluate(n => [...document.querySelectorAll('.hotspot')].find(e => e.textContent.includes(n))?.click(), name);
export async function run({ browser, base }) {
  const A = await open(browser, base, { width: 1920, height: 1080, dpr: 1, cursor: false });
  await enterShowcase(A, { nickname: '阿宁', preset: 0 });
  await A.addCss(CSS); await sleep(1500);
  await A.freeze();
  await A.frames(60);                                                  // settle in virtual time (not recorded)
  A.startRecording(OUT('RB-H0'), { w: 1920, h: 1080 });
  const reset = () => A.page.evaluate(() => { const e = document.querySelector('.world-shell'); e.getAnimations().forEach(a => a.cancel()); e.style.transform = ''; });
  await A.push('.world-shell', 1.0, 1.07, 2.5, { origin: '38% 58%' }); await A.hold(2.5);
  await reset(); await hot(A, '小满'); await A.push('.world-shell', 1.0, 1.05, 1.55, { origin: '50% 62%' }); await A.hold(2.5);
  await reset(); await A.page.evaluate(() => document.querySelector('.hotspot.photo')?.click()); await A.push('.world-shell', 1.0, 1.06, 1.55); await A.hold(2.5);
  await reset(); await A.page.evaluate(() => document.querySelector('nav.camera-nav button[data-view=overview]')?.click()); await A.push('.world-shell', 1.05, 1.0, 1.4, { origin: '45% 55%' }); await A.hold(2.5);
  await reset(); await A.push('.world-shell', 1.0, 1.05, 2.5, { origin: '45% 60%' }); await A.hold(2.5);
  await A.frames(Math.max(0, 750 - A.frame));
  const r = await A.stopRecording(); await A.close(); return r;
}
