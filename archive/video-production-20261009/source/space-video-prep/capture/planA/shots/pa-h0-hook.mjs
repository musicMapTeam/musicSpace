// PA-H0 (12.5 s) HOOK: the dusk courtyard, real camera glides between the product's own viewpoints (photo wall -> work desk -> record shelf -> back to the courtyard) with the app UI faded out
// (recording-only CSS, like capture/cinematic.css: nothing in the scene changes).  One 96-BPM bar = 2.5 s per move, so the cuts/glides sit on the music's bar lines.  The title lockup is composited in assembly (bar 5 = 10.0 s).
import { open, CLIP } from '../pa.mjs';
export const meta = { id: 'PA-H0', seconds: 12.5, mode: 'static (live 0.16), single viewer, no cursor' };
const CSS = `#main-content,dialog,.sp-dialog,#toast,.toast{transition:opacity .6s ease!important}
body.rec-hide #main-content,body.rec-hide dialog,body.rec-hide .sp-dialog,body.rec-hide #toast,body.rec-hide .toast{opacity:0!important;pointer-events:none!important}`;
export async function run({ browser, base }) {
  const s = await open(browser, base, { width: 1920, height: 1080, dpr: 1, cursor: false, css: CSS });
  const p = s.page;
  await s.freeze();
  s.startRecording(CLIP('PA-H0'), { w: 1920, h: 1080 });
  const nav = sel => p.evaluate(q => document.querySelector(q).click(), sel);
  const reset = () => p.evaluate(() => { const e = document.querySelector('#sakura-world'); e.getAnimations().forEach(a => a.cancel()); e.style.transform = ''; });
  // bar 1 (0-2.5 s): the front door as a visitor first sees it (hero text + courtyard), slow push-in
  await s.push('#sakura-world', 1.0, 1.045, 2.5, { origin: '64% 56%' });
  await s.hold(2.5);
  // bar 2 (2.5-5 s): UI fades out, the camera glides to the photo wall
  await reset(); await p.evaluate(() => document.body.classList.add('rec-hide')); await nav('[data-world-view=live]');
  await s.push('#sakura-world', 1.0, 1.04, 2.4, { origin: '50% 55%' }); await s.hold(2.5);
  // bar 3 (5-7.5 s): the work desk
  await reset(); await nav('[data-world-editor]'); await s.push('#sakura-world', 1.0, 1.04, 2.4, { origin: '50% 55%' }); await s.hold(2.5);
  // bar 4 (7.5-10 s): the record shelf
  await reset(); await nav('[data-world-view=records]'); await s.push('#sakura-world', 1.0, 1.04, 2.4, { origin: '50% 50%' }); await s.hold(2.5);
  // bar 5 (10-12.5 s): back to the courtyard overview under the lockup
  await reset(); await nav('[data-world-view=space]'); await s.push('#sakura-world', 1.0, 1.035, 2.4, { origin: '62% 56%' }); await s.hold(2.5);
  await s.frames(Math.max(0, 750 - s.frame));
  const r = await s.stopRecording(); await s.close(); return r;
}
