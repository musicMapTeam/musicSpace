// Probe: which GPU/WebGL renderer does Playwright + system Chrome give us, headless vs headed,
// and how many rAF frames per second does the real app achieve at 1920x1080?
import { chromium } from '/tmp/space-video-prep/tools/node_modules/playwright-core/index.mjs';

const url = process.argv[2] || 'https://musicmapteam.github.io/musicSpace/';
const headless = process.argv[3] !== 'headed';
const secs = Number(process.argv[4] || 8);

const browser = await chromium.launch({
  channel: 'chrome',
  headless,
  args: [
    '--enable-gpu-rasterization',
    '--ignore-gpu-blocklist',
    '--use-angle=metal',
    '--hide-scrollbars',
    '--mute-audio',
  ],
});
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, locale: 'zh-CN' });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { if (m.type() === 'error') logs.push(m.text().slice(0, 160)); });
page.on('pageerror', e => logs.push('pageerror ' + String(e).slice(0, 160)));
const t0 = Date.now();
await page.goto(url, { waitUntil: 'load', timeout: 60000 });
console.log('load ms', Date.now() - t0);
await page.waitForTimeout(3000);
const gl = await page.evaluate(() => {
  const c = document.createElement('canvas');
  const g = c.getContext('webgl2') || c.getContext('webgl');
  if (!g) return { ok: false };
  const ext = g.getExtension('WEBGL_debug_renderer_info');
  return {
    ok: true,
    version: g.getParameter(g.VERSION),
    vendor: ext ? g.getParameter(ext.UNMASKED_VENDOR_WEBGL) : null,
    renderer: ext ? g.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null,
    ua: navigator.userAgent,
  };
});
console.log(JSON.stringify(gl));
// in-page fps meter
const fps = await page.evaluate(async (secs) => {
  return await new Promise(res => {
    let n = 0; const t0 = performance.now(); let last = t0; let worst = 0;
    const gaps = [];
    function f(t) { n++; const d = t - last; last = t; gaps.push(d); if (d > worst) worst = d; if (t - t0 < secs * 1000) requestAnimationFrame(f); else {
      gaps.sort((a, b) => a - b);
      res({ frames: n, seconds: (t - t0) / 1000, fps: n / ((t - t0) / 1000), worstGapMs: worst, p50: gaps[gaps.length >> 1], p95: gaps[Math.floor(gaps.length * 0.95)] });
    } }
    requestAnimationFrame(f);
  });
}, secs);
console.log('rAF', JSON.stringify(fps));
console.log('errors', logs.slice(0, 5));
await browser.close();
