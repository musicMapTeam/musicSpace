// RB-M2 (15 s) exchange: badge button 「和 TA 交换这个视角」 -> compose (select 「我提供哪一张」 pre-selects 「我的第 N 张 · 已上墙 · 同一刻的另一面（推荐）」, reason + 「规则判断，不是 AI」) -> tick 「我同意提供选中照片的预览，并在对方接受后分享这张原图」 -> 「把这两张交给对方确认 ↗」 -> ~3-5 s later 「交换已接受」.
// Selectors: ui.mjs (read from web/event-room/exchange-panel.js + exchange-suggest.js).  UNTESTED against a booted Route B page.
import { open, enterShowcase, warmModel, openSample, btn, OUT, UI, sleep } from '../rb.mjs';
export const meta = { id: 'RB-M2', seconds: 15, mode: 'static (the 示例 cast answers by itself)' };
export async function run({ browser, base }) {
  const A = await open(browser, base); await enterShowcase(A); await warmModel(A); const P = A.page;
  // real-time setup: put the crowd sample on the wall so the badge exists, then record only the exchange
  await openSample(A, 'sample-crowd');
  await P.waitForFunction(re => new RegExp(re).test(document.querySelector('#panel')?.innerText || ''), UI.aiSure.source + '|' + UI.aiUnsure.source, { timeout: 60000 }).catch(() => {});
  await btn(P, UI.save).click(); await P.waitForFunction(() => !!document.querySelector('[data-moment-badge="other-side"]'), null, { timeout: 30000 }); await sleep(800);
  await A.hideCursor(); await A.freeze(); await A.directorOn({ k: 5 });
  A.startRecording(OUT('RB-M2'));
  await A.hold(0.4); await A.showCursor();
  A.track(UI.panel, { pad: 1.05, zmax: 1.6 });
  await A.click(P.locator(UI.offerBtn).first(), { move: 0.7, post: 0.8 });
  await A.until(() => !!document.querySelector('.photo-exchanges:not([hidden]) select[data-x-choice]'), { max: 200 });
  A.track('.photo-exchanges', { pad: 1.04, zmax: 1.55 });
  // the recommendation is the selected option: 「…同一刻的另一面（推荐）」
  await A.until(() => /（推荐）/.test(document.querySelector('select[data-x-choice]')?.selectedOptions?.[0]?.textContent || ''), { max: 240 }); await A.hold(1.4);
  await A.click(P.locator(UI.xConsent), { move: 0.6, post: 0.5 });
  await A.click(P.locator(UI.xSend), { move: 0.6, post: 0.4 });
  await A.until(() => /交换已接受/.test(document.body.innerText), { max: 700 });   // virtual 2.5-5 s of NPC think time (steps frames meanwhile)
  await A.hold(2.5); A.unfocus();
  await A.frames(Math.max(0, 900 - A.frame));
  const r = await A.stopRecording(); await A.close(); return r;
}
