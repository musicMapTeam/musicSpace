// Clip A (phone 1080x2340): first screen -> entry sheet -> enter -> room overview with the cast -> dolly in to 小满 (product camera, 1x)
// -> pull back to the overview revealing the cast (same product move, rAF time-warp 0.5 = slow motion) -> swing to the photo wall (1x).
import { launch, killSinks } from './rec2.mjs';
import { openApp, SEL, OUT, PHONE, untilCameraSettled, sleep } from './flow.mjs';
const browser = await launch();
let s;
try {
  s = await openApp(browser, PHONE);
  const p = s.page;
  await s.freeze();
  // per captured frame: camera position + target (for the smoothness check), view, boil seed is not exposed
  s.frameProbe = () => { try { const c = window.__SPACE_EVENT_QA__().camera; return [c.view[0], c.moving ? 1 : 0, ...c.camera.position.map(v => +v.toFixed(4)), ...c.camera.target.map(v => +v.toFixed(4))]; } catch { return null; } };
  s.startRecording(OUT('A-phone-venue.mp4'));
  s.mark('landing');
  await s.hold(1.3);
  await s.click(SEL.landingEnter(p), { move: 0, pre: 0.1, post: 0.2 });
  await s.until(() => !!document.querySelector('#panel:not([hidden]) form[data-form=demo-entry]'), { max: 120 });
  await s.hold(0.7); s.mark('entry');
  await s.click(p.locator(SEL.consent), { move: 0, pre: 0.12, post: 0.3 });
  await s.click(p.locator(SEL.submit), { move: 0, pre: 0.12, post: 0.1 });
  const t0 = s.sink.frames;
  await s.until(() => /回声现场/.test(document.body.innerText) && document.querySelector('#panel')?.hidden && !!document.querySelector('.demo-tour:not([hidden])'), { max: 400 });
  console.log('submit -> room:', s.sink.frames - t0, 'frames');
  await s.hold(1.1); s.mark('room');
  await s.click(p.locator(SEL.person('小满')), { move: 0, pre: 0.1, post: 0 });
  await untilCameraSettled(s); s.mark('person');
  await s.hold(0.8);
  await s.click(p.locator(SEL.nav('overview')), { move: 0, pre: 0.1, post: 0 });
  await s.setWarp(0.5);                          // slow motion of the product's own 950 ms move; timers (7 Hz line boil) untouched
  const w0 = s.sink.frames;
  await untilCameraSettled(s, 400); console.log('warped pull-back:', s.sink.frames - w0, 'frames');
  await s.setWarp(1); s.mark('overview');
  await s.hold(1.0);
  await s.click(p.locator(SEL.nav('photos')), { move: 0, pre: 0.1, post: 0 });
  await untilCameraSettled(s); s.mark('photos');
  await s.hold(1.1);
  const r = await s.stopRecording();
  console.log(JSON.stringify({ ...r, events: undefined, marks: r.marks.map(m => `${m.label}@${m.t}`).join(' ') }, null, 1));
  console.log('errors', JSON.stringify(s.errors), 'console', JSON.stringify(s.console.slice(0, 10)));
} catch (e) { console.error('FAILED', e); killSinks(); }
finally { await s?.ctx.close().catch(() => {}); await browser.close(); }
