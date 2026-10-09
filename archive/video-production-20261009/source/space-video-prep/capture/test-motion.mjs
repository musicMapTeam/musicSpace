// Motion test: host enters a room, then camera moves between views while we capture with a given method.
// usage: node test-motion.mjs <method> [seconds]
import { launch, newPage, sleep, BASE, ensureDir, rimraf, fs, path } from './lib.mjs';
import { hostCreatesRoom } from './flows.mjs';

const method = process.argv[2] || 'shots';
const SECS = Number(process.argv[3] || 10);
const OUT = ensureDir('/tmp/space-video-prep/capture/runs/motion-' + method);
rimraf(OUT); ensureDir(OUT);

const browser = await launch();
const { ctx, page } = await newPage(browser);
await hostCreatesRoom(page, { name: '阿遥', title: '返场夜', venue: '月台 Livehouse' });
// close the little arrival panel if any, wait for idle animation
await sleep(1500);

const stats = { frames: 0, bytes: 0, t: [] };
let frames = [];
let stopCap = async () => {};
const t0 = Date.now();
if (method === 'shots' || method === 'shotspng') {
  const png = method === 'shotspng';
  const loop = (async () => {
    while (Date.now() - t0 < SECS * 1000) {
      const ts = (Date.now() - t0) / 1000;
      const buf = await page.screenshot(png ? { type: 'png' } : { type: 'jpeg', quality: 92 });
      frames.push({ ts, buf });
    }
  })();
  stopCap = async () => { await loop; };
} else if (method === 'pwonframe') {
  const sc = page.screencast;
  await sc.start({ onFrame: ({ data, timestamp }) => { frames.push({ ts: timestamp / 1000 - t0 / 1000, buf: data }); }, size: { width: 1920, height: 1080 }, quality: 92 });
  stopCap = async () => { await sleep(Math.max(0, SECS * 1000 - (Date.now() - t0))); await sc.stop(); };
} else if (method === 'cdpscreencast') {
  const cdp = await ctx.newCDPSession(page);
  cdp.on('Page.screencastFrame', async ev => { frames.push({ ts: ev.metadata.timestamp - 0, buf: Buffer.from(ev.data, 'base64') }); await cdp.send('Page.screencastFrameAck', { sessionId: ev.sessionId }); });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  stopCap = async () => { await sleep(Math.max(0, SECS * 1000 - (Date.now() - t0))); await cdp.send('Page.stopScreencast'); };
} else if (method === 'cdpshot') {
  const cdp = await ctx.newCDPSession(page);
  const loop = (async () => {
    while (Date.now() - t0 < SECS * 1000) {
      const ts = (Date.now() - t0) / 1000;
      const r = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 95, optimizeForSpeed: true });
      frames.push({ ts, buf: Buffer.from(r.data, 'base64') });
    }
  })();
  stopCap = async () => { await loop; };
}
const at = async (ms, fn) => { const d = ms - (Date.now() - t0); if (d > 0) await sleep(d); await fn(); };
await at(1000, () => page.click('[data-view=photos]'));
await at(4000, () => page.click('[data-view=person]'));
await at(7000, () => page.click('[data-view=overview]'));
await stopCap();
const ext = method === 'shotspng' ? 'png' : 'jpg';
const lines = ['ffconcat version 1.0'];
for (let i = 0; i < frames.length; i++) {
  const f = path.join(OUT, `f${String(i).padStart(5, '0')}.${ext}`);
  fs.writeFileSync(f, frames[i].buf);
  stats.bytes += frames[i].buf.length; stats.frames++; stats.t.push(frames[i].ts);
  const dur = i < frames.length - 1 ? frames[i + 1].ts - frames[i].ts : 1 / 30;
  lines.push(`file '${f}'`, `duration ${dur.toFixed(6)}`);
}
fs.writeFileSync(path.join(OUT, 'concat.txt'), lines.join('\n'));
await browser.close();
const d = []; for (let i = 1; i < stats.t.length; i++) d.push((stats.t[i] - stats.t[i - 1]) * 1000); d.sort((a, b) => a - b);
const span = stats.t.at(-1) - stats.t[0];
console.log(JSON.stringify({ method, frames: stats.frames, fps: +(stats.frames / span).toFixed(1), dt_p50: +d[d.length >> 1].toFixed(1), dt_p95: +d[Math.floor(d.length * .95)].toFixed(1), dt_max: +d.at(-1).toFixed(1), MBps: +(stats.bytes / 1e6 / span).toFixed(1) }));
