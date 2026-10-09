// Probe: which WebGL renderer does headless Chrome give us with different flag sets, and does the app pick the doodle path (not low-end)?
import { chromium } from '/tmp/space-video-prep/tools/node_modules/playwright-core/index.mjs';
const BASE = process.env.SPACE_BASE || 'http://127.0.0.1:47811/musicSpace/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const COMMON = ['--hide-scrollbars', '--mute-audio', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--force-color-profile=srgb'];
const SETS = {
  default: [],
  metal: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
  metalGpu: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
  gl: ['--use-angle=gl', '--ignore-gpu-blocklist'],
  swiftshader: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
};
const which = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SETS);
for (const k of which) {
  const t0 = Date.now();
  let browser;
  try {
    browser = await chromium.launch({ executablePath: CHROME, headless: true, args: [...COMMON, ...SETS[k]] });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 845 }, deviceScaleFactor: 36 / 13, locale: 'zh-CN', timezoneId: 'Asia/Shanghai' });
    const page = await ctx.newPage();
    const gl = await page.evaluate(() => {
      const c = document.createElement('canvas'); const g = c.getContext('webgl2'); if (!g) return { webgl2: false };
      const e = g.getExtension('WEBGL_debug_renderer_info');
      return { webgl2: true, vendor: e ? g.getParameter(e.UNMASKED_VENDOR_WEBGL) : g.getParameter(g.VENDOR), renderer: e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER), maxTex: g.getParameter(g.MAX_TEXTURE_SIZE), cbf: !!g.getExtension('EXT_color_buffer_float'), cores: navigator.hardwareConcurrency };
    });
    await page.goto(BASE, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2500);
    const app = await page.evaluate(() => { try { const q = window.__SPACE_EVENT_QA__?.(); return { boot: window.__SPACE_BOOT__, renderStyle: q?.camera?.scene?.renderStyle, view: q?.camera?.view, mode: q?.camera?.mode, canvas: [...document.querySelectorAll('canvas')].map(c => `${c.width}x${c.height} css ${c.clientWidth}x${c.clientHeight}`) }; } catch (e) { return { err: String(e) }; } });
    let gpuPage = '';
    try { const g = await ctx.newPage(); await g.goto('chrome://gpu', { timeout: 15000 }); await g.waitForTimeout(1500); gpuPage = (await g.evaluate(() => document.body.innerText.length > 50 ? document.body.innerText : (document.querySelector('info-view')?.shadowRoot?.textContent || ''))).replace(/\s+/g, ' '); } catch (e) { gpuPage = 'chrome://gpu n/a ' + e.message; }
    const pick = re => (gpuPage.match(re) || [])[0] || '';
    console.log(JSON.stringify({ set: k, ms: Date.now() - t0, gl, app, gpu: { webgl: pick(/WebGL2?:\s*[A-Za-z ,]+/), compositing: pick(/Compositing:\s*[A-Za-z ,]+/), raster: pick(/Rasterization:\s*[A-Za-z ,]+/), angle: pick(/GL_RENDERER\s*ANGLE[^G]{0,120}/), skia: pick(/Skia Backend\s*\w+/) } }));
  } catch (e) { console.log(JSON.stringify({ set: k, error: String(e).slice(0, 300) })); }
  finally { await browser?.close().catch(() => {}); }
}
