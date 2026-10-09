// Clip C (desktop 1920x1080 = 1440x810 CSS @1.333): wall badge -> 「和 TA 交换这个视角」 -> compose (two polaroids, recommended pick)
// -> consent -> 「把这两张交给对方确认 ↗」 -> waiting -> 「交换已接受」.  Arrow cursor + director (CDP re-rasterised zoom) on the panel.
import { launch, killSinks } from './rec2.mjs';
import { openApp, enterRoom, crowdOnWall, SEL, OUT, DESKTOP, scrollTo, scrollNow, focusUnion, sleep } from './flow.mjs';
const browser = await launch();
let s;
try {
  s = await openApp(browser, DESKTOP);
  const p = s.page;
  await enterRoom(s);
  await crowdOnWall(s);
  await scrollNow(s, SEL.badge, { block: 'center' }); await sleep(400);
  await p.mouse.move(560, 540); s.mouse = { x: 560, y: 540 }; await sleep(300);
  await s.freeze();
  s.directorOn({ k: 4 });
  s.frameProbe = () => (document.querySelector('.exchange-status')?.innerText || '').trim().slice(0, 8) || (document.querySelector('[data-x-send]') ? 'compose' : (document.querySelector('[data-moment-badge="other-side"]') ? 'wall' : '-'));
  s.startRecording(OUT('C-desktop-exchange.mp4'));
  s.mark('wall');
  await s.hold(0.5);
  await s.track([SEL.badge], { pad: 1.25, zmax: 1.7, k: 3 });
  await s.click(p.locator(SEL.offer), { move: 0.9, pre: 0.15, post: 0.1 });
  const t0 = s.sink.frames;
  await s.until(() => !!document.querySelector('[data-x-send]') && /（推荐）/.test(document.querySelector('select[data-x-choice]')?.selectedOptions?.[0]?.textContent || ''), { max: 300 });
  console.log('offer -> compose:', s.sink.frames - t0, 'frames');
  await s.hold(0.15);
  await s.track(['.exchange-pair'], { pad: 1.25, zmax: 1.8, k: 3.5 }); s.mark('compose');
  await s.hold(1.6);
  await s.track(['.exchange-agreement', SEL.xSend], { pad: 1.2, zmax: 1.7, k: 3.5 });
  await scrollTo(s, SEL.xSend, { block: 'end', offset: 18, seconds: 0.8 });
  await s.hold(0.3);
  await s.click(p.locator(SEL.xConsent), { move: 0.6, pre: 0.12, post: 0.3 }); s.mark('consent');
  await s.click(p.locator(SEL.xSend), { move: 0.55, pre: 0.12, post: 0.1 });
  const t1 = s.sink.frames;
  await s.until(() => !!document.querySelector('.exchange-status'), { max: 200 });
  // the body keeps its scroll position after the re-render, so the status sticker is above the fold: scroll up like a person would
  await scrollTo(s, '.exchange-status', { block: 'start', offset: -24, seconds: 0.7 });
  await s.track(['.exchange-status', '.exchange-pair'], { pad: 1.2, zmax: 1.7, k: 3 }); s.mark('pending');
  await s.moveTo(1405, 790, 0.6);                 // pointer out of the way while the 示例 cast decides
  await s.until(() => /交换已接受/.test(document.querySelector('.exchange-status')?.innerText || ''), { max: 900 });
  console.log('send -> accepted:', s.sink.frames - t1, 'frames');
  await s.hold(0.05);
  await scrollTo(s, '.exchange-status', { block: 'start', offset: -24, seconds: 0.5 });
  await s.track(['.exchange-status', '.exchange-pair'], { pad: 1.15, zmax: 1.75, k: 3.5 }); s.mark('accepted');
  await s.hold(2.0);
  s.unfocus({ k: 3 });
  await s.hold(1.1);
  const r = await s.stopRecording();
  const pr = s.probeLog.join('|');
  console.log('probe:', pr.replace(/([^|]+)(\|\1)+/g, (m, a) => `${a}x${m.split('|').length}`));
  console.log(JSON.stringify({ ...r, events: undefined }, null, 1));
  console.log('errors', JSON.stringify(s.errors), 'console', JSON.stringify(s.console.slice(0, 10)));
} catch (e) { console.error('FAILED', e); killSinks(); }
finally { await s?.ctx.close().catch(() => {}); await browser.close(); }
