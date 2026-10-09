// How fast does the page itself render during a camera move, with and without capture running?
import { launch, newPage, sleep, ensureDir } from './lib.mjs';
import { hostCreatesRoom } from './flows.mjs';

const mode = process.argv[2] || 'idle'; // idle | shots
const browser = await launch();
const { page } = await newPage(browser);
await hostCreatesRoom(page, { name: '阿遥', title: '返场夜', venue: '月台 Livehouse' });
await sleep(1200);
await page.evaluate(() => {
  window.__raf = []; let last = performance.now();
  const f = t => { window.__raf.push([t, t - last]); last = t; requestAnimationFrame(f); };
  requestAnimationFrame(f);
});
let stop = false;
const loop = (async () => { if (mode !== 'shots') return; let n = 0; while (!stop) { await page.screenshot({ type: 'jpeg', quality: 90 }); n++; } return n; })();
await sleep(1000);
await page.evaluate(() => { window.__mark = performance.now(); });
await page.click('[data-view=photos]');
await sleep(3000);
await page.click('[data-view=person]');
await sleep(3000);
stop = true; const shots = await loop;
const res = await page.evaluate(() => {
  const m = window.__mark; const a = window.__raf.filter(r => r[0] >= m);
  const dts = a.map(r => r[1]).sort((x, y) => x - y);
  const secs = (a.at(-1)[0] - a[0][0]) / 1000;
  return { frames: a.length, secs: +secs.toFixed(2), fps: +(a.length / secs).toFixed(1), p50: +dts[dts.length >> 1].toFixed(1), p95: +dts[Math.floor(dts.length * .95)].toFixed(1), max: +dts.at(-1).toFixed(1) };
});
console.log(mode, JSON.stringify(res), shots ? 'screenshots=' + shots : '');
await browser.close();
