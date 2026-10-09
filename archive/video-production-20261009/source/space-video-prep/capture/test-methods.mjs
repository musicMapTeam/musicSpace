// Compare real-time capture methods on the same 10 s camera-move scenario (RC4 event room, 1920x1080, real GPU).
// usage: node test-methods.mjs <method> [seconds]
//   method: pwvideo | pwscreencast | cdpjpeg90 | cdpjpeg100 | cdppng | shots
import { launch, newPage, sleep, BASE, ensureDir, rimraf, fs, path } from './lib.mjs';

const method = process.argv[2] || 'cdpjpeg90';
const SECS = Number(process.argv[3] || 10);
const OUT = ensureDir('/tmp/space-video-prep/capture/runs/' + method);
rimraf(OUT); ensureDir(OUT);

const browser = await launch();
let ctxOpts = {};
const { ctx, page } = await (async () => {
  if (method === 'pwvideo') {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, locale: 'zh-CN', recordVideo: { dir: OUT, size: { width: 1920, height: 1080 } } });
    const page = await ctx.newPage();
    return { ctx, page };
  }
  return newPage(browser);
})();

await page.goto(BASE + '/event-room/', { waitUntil: 'load' });
await sleep(2500); // let the venue settle

// scenario driver: camera moves at fixed offsets
const scenario = (async () => {
  const t0 = Date.now();
  const at = async (ms, fn) => { const d = ms - (Date.now() - t0); if (d > 0) await sleep(d); await fn(); };
  await at(1500, () => page.click('[data-view=photos]'));
  await at(5000, () => page.click('[data-view=person]'));
  await at(8000, () => page.click('[data-view=overview]'));
  await at(SECS * 1000, async () => {});
})();

const stats = { method, frames: 0, bytes: 0, t: [] };
let stop = async () => {};
const startWall = Date.now();

if (method === 'pwvideo') {
  stop = async () => { await ctx.close(); };
} else if (method === 'pwscreencast') {
  await page.screencast.start({ path: path.join(OUT, 'screencast.webm'), size: { width: 1920, height: 1080 }, quality: 90 });
  stop = async () => { await page.screencast.stop(); };
} else if (method.startsWith('cdpjpeg')) {
  const q = Number(method.replace('cdpjpeg', ''));
  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', async ev => {
    frames.push({ ts: ev.metadata.timestamp, data: ev.data });
    stats.frames++;
    cdp.send('Page.screencastFrameAck', { sessionId: ev.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: q, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  stop = async () => {
    await cdp.send('Page.stopScreencast');
    // write frames + a concat file with real durations
    const lines = ['ffconcat version 1.0'];
    for (let i = 0; i < frames.length; i++) {
      const f = path.join(OUT, `f${String(i).padStart(5, '0')}.jpg`);
      const buf = Buffer.from(frames[i].data, 'base64');
      stats.bytes += buf.length;
      fs.writeFileSync(f, buf);
      const dur = i < frames.length - 1 ? frames[i + 1].ts - frames[i].ts : 1 / 30;
      stats.t.push(frames[i].ts);
      lines.push(`file '${f}'`, `duration ${dur.toFixed(6)}`);
    }
    fs.writeFileSync(path.join(OUT, 'concat.txt'), lines.join('\n'));
  };
} else if (method === 'cdppng') {
  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  const loop = (async () => {
    const t0 = Date.now();
    while (Date.now() - t0 < SECS * 1000) {
      const ts = (Date.now() - t0) / 1000;
      const r = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
      frames.push({ ts, data: r.data });
    }
  })();
  stop = async () => {
    await loop;
    const lines = ['ffconcat version 1.0'];
    for (let i = 0; i < frames.length; i++) {
      const f = path.join(OUT, `f${String(i).padStart(5, '0')}.png`);
      const buf = Buffer.from(frames[i].data, 'base64');
      stats.bytes += buf.length; stats.frames++;
      fs.writeFileSync(f, buf);
      stats.t.push(frames[i].ts);
      const dur = i < frames.length - 1 ? frames[i + 1].ts - frames[i].ts : 1 / 30;
      lines.push(`file '${f}'`, `duration ${dur.toFixed(6)}`);
    }
    fs.writeFileSync(path.join(OUT, 'concat.txt'), lines.join('\n'));
  };
} else if (method === 'shots') {
  // Playwright page.screenshot loop (jpeg q92)
  const frames = [];
  const loop = (async () => {
    const t0 = Date.now();
    while (Date.now() - t0 < SECS * 1000) {
      const ts = (Date.now() - t0) / 1000;
      const buf = await page.screenshot({ type: 'jpeg', quality: 92, animations: 'allow', caret: 'initial' });
      frames.push({ ts, buf });
    }
  })();
  stop = async () => {
    await loop;
    const lines = ['ffconcat version 1.0'];
    for (let i = 0; i < frames.length; i++) {
      const f = path.join(OUT, `f${String(i).padStart(5, '0')}.jpg`);
      stats.bytes += frames[i].buf.length; stats.frames++;
      fs.writeFileSync(f, frames[i].buf);
      stats.t.push(frames[i].ts);
      const dur = i < frames.length - 1 ? frames[i + 1].ts - frames[i].ts : 1 / 30;
      lines.push(`file '${f}'`, `duration ${dur.toFixed(6)}`);
    }
    fs.writeFileSync(path.join(OUT, 'concat.txt'), lines.join('\n'));
  };
}

await scenario;
await stop();
const wall = (Date.now() - startWall) / 1000;
await browser.close();

// summarize inter-frame timing
if (stats.t.length > 2) {
  const d = [];
  for (let i = 1; i < stats.t.length; i++) d.push((stats.t[i] - stats.t[i - 1]) * 1000);
  d.sort((a, b) => a - b);
  const mean = d.reduce((a, b) => a + b, 0) / d.length;
  const span = stats.t[stats.t.length - 1] - stats.t[0];
  console.log(JSON.stringify({
    method, frames: stats.frames, span_s: +span.toFixed(2), fps: +(stats.frames / span).toFixed(1),
    dt_ms: { mean: +mean.toFixed(1), p50: +d[d.length >> 1].toFixed(1), p95: +d[Math.floor(d.length * 0.95)].toFixed(1), max: +d[d.length - 1].toFixed(1) },
    MBperSec: +(stats.bytes / 1e6 / span).toFixed(2), wall_s: +wall.toFixed(1),
  }));
} else {
  console.log(JSON.stringify({ method, frames: stats.frames, wall_s: +wall.toFixed(1) }));
}
console.log(fs.readdirSync(OUT).filter(f => /\.(webm|mp4)$/.test(f)).map(f => f + ' ' + fs.statSync(path.join(OUT, f)).size).join('\n'));
