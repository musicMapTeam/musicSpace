// Clip B (phone 1080x2340): tour card 「人海 · 示例照片」 -> upload sheet, on-device AI -> chip 「AI 判断：人海」 (director push-in)
// -> eased scroll -> 「保存这张照片」 -> photo wall with the 「同一刻的另一面」 badge (director push-in).
import { launch, killSinks } from './rec2.mjs';
import { openApp, enterRoom, warmModel, SEL, OUT, PHONE, scrollTo, sleep } from './flow.mjs';
const browser = await launch();
let s;
try {
  s = await openApp(browser, PHONE);
  const p = s.page;
  await enterRoom(s);
  const warmMs = await warmModel(s, 'sample-stage');
  console.log('model warm-up (stage sample, real time):', warmMs, 'ms');
  await s.freeze();
  s.directorOn({ k: 5 });
  s.frameProbe = () => { const t = document.querySelector('#panel:not([hidden])')?.innerText || ''; return (/AI 在本机判断视角/.test(t) ? 'T' : '') + (/AI 判断：/.test(t) ? 'A' : '') + (document.querySelector('[data-moment-badge="other-side"]') ? 'B' : '') + (document.querySelector('.photo-review') ? 'P' : ''); };
  s.startRecording(OUT('B-phone-upload-ai-wall.mp4'));
  s.mark('room-tour');
  await s.hold(0.8);
  await s.click(p.locator(SEL.tourSample('sample-crowd')), { move: 0, pre: 0.1, post: 0 });
  const t0 = s.sink.frames;
  await s.until(() => /AI 判断：/.test(document.querySelector('#panel')?.innerText || '') && !!document.querySelector('.moment-ai-tag'), { max: 400 });
  console.log('tap -> AI chip:', s.sink.frames - t0, 'frames');
  await s.hold(0.35); s.mark('ai-chip');
  const tag = await p.locator(SEL.aiTag).first().boundingBox();
  const chips = await p.locator('[data-moment-viewpoint]').first().boundingBox().catch(() => null);
  const cy = chips ? (Math.min(chips.y, tag.y) + tag.y + tag.height) / 2 : tag.y;
  s.focus({ x: s.W / 2, y: cy, z: 1.45, k: 4 });
  await s.hold(1.5); s.mark('ai-zoom');
  s.unfocus({ k: 5 });
  await s.hold(0.4);
  await scrollTo(s, SEL.save, { block: 'end', offset: 24, seconds: 0.7 });
  await s.hold(0.25);
  await s.click(p.locator(SEL.save), { move: 0, pre: 0.1, post: 0 });
  const t1 = s.sink.frames;
  await s.until(sel => !!document.querySelector(sel), { arg: SEL.badge, max: 600 });
  console.log('save -> badge:', s.sink.frames - t1, 'frames');
  await s.hold(0.6); s.mark('wall');
  await s.focusOn(SEL.badge, { pad: 1.12, zmin: 1.2, zmax: 1.5, k: 4 });
  await s.hold(1.7); s.mark('badge-zoom');
  s.unfocus({ k: 4 });
  await s.hold(0.8);
  const r = await s.stopRecording();
  const pr = s.probeLog.join(' ');
  console.log('probe states (T=thinking A=AI chip B=badge P=photo):', pr.replace(/(\S+)( \1)+/g, (m, a) => `${a}x${m.split(' ').length}`));
  console.log(JSON.stringify({ ...r, events: undefined }, null, 1));
  console.log('errors', JSON.stringify(s.errors), 'console', JSON.stringify(s.console.slice(0, 10)));
} catch (e) { console.error('FAILED', e); killSinks(); }
finally { await s?.ctx.close().catch(() => {}); await browser.close(); }
