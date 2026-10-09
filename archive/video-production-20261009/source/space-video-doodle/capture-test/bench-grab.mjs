// Micro-benchmark: cost of one stepped frame (clock step + animation sync) and one CDP screenshot per format, phone and desktop.
import { launch, Session, PHONE, DESKTOP, sleep } from './rec2.mjs';
const BASE = process.env.SPACE_BASE || 'http://127.0.0.1:47811/musicSpace/';
const browser = await launch();
for (const [label, V] of [['phone', PHONE], ['desktop', DESKTOP]]) {
  const s = await Session.open(browser, { url: BASE, ...V, cursor: false, name: label });
  const p = s.page;
  await p.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 60000 }); await sleep(2500);
  await s.freeze();
  const res = {};
  for (const fmt of ['png', 'jpeg']) {
    let tStep = 0, tGrab = 0, bytes = 0; const N = 30;
    for (let i = 0; i < N; i++) {
      const a = performance.now(); await s.step(1); const b = performance.now(); const buf = await s.grab(fmt); const c = performance.now();
      tStep += b - a; tGrab += c - b; bytes += buf.length;
    }
    res[fmt] = { stepMs: +(tStep / N).toFixed(1), grabMs: +(tGrab / N).toFixed(1), kB: Math.round(bytes / N / 1024) };
  }
  console.log(label, JSON.stringify(res));
  await s.close();
}
await browser.close();
