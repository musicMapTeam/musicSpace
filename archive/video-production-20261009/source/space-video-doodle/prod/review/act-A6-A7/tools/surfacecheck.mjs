// Diagnostic: do concurrently launched headless Chrome instances capture the full 1920x1080 surface?
// node surfacecheck.mjs [nBrowsers=5]
import { chromium } from '/tmp/space-video-doodle/prod/tools/node_modules/playwright-core/index.mjs';
import { PNG } from '/tmp/space-video-doodle/prod/tools/node_modules/pngjs/lib/png.js';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ARGS = ['--force-color-profile=srgb', '--hide-scrollbars', '--mute-audio', '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows', '--font-render-hinting=none', '--disable-checker-imaging', '--disable-lcd-text', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'];
const N = +(process.argv[2] || 5);
const html = `<html><body style="margin:0;background:#0f0"><div id=d style="position:absolute;left:0;top:0;width:1920px;height:1080px;background:linear-gradient(#f00,#00f)"></div></body></html>`;
const one = async (i) => {
  const br = await chromium.launch({ executablePath: CHROME, headless: true, args: ARGS });
  const ctx = await br.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage(); await page.setContent(html);
  const dims = await page.evaluate(() => [innerWidth, innerHeight, outerWidth, outerHeight, screen.width, screen.height, screen.availHeight]);
  const cdp = await ctx.newCDPSession(page); const res = [];
  for (const fast of [true, false]) {
    const r = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: fast, fromSurface: true, captureBeyondViewport: false, clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 1 } });
    const png = PNG.sync.read(Buffer.from(r.data, 'base64'));
    // last row that is NOT the gradient (gradient rows have blue > 0 near the bottom); find first y from the bottom where pixel == green bg or white
    let firstBad = null; for (let y = 0; y < png.height; y++) { const k = (y * png.width + 960) * 4; const [R, G, B] = [png.data[k], png.data[k + 1], png.data[k + 2]]; if (G > 200 || (R > 240 && G > 240 && B > 240)) { firstBad = y; break; } }
    res.push(`${fast ? 'fast' : 'slow'}:${png.width}x${png.height} band@${firstBad ?? '-'}`);
  }
  await br.close();
  return `browser ${i}: inner/outer/screen ${dims.join(',')}  ${res.join('  ')}`;
};
const out = await Promise.all(Array.from({ length: N }, (_, i) => one(i)));
console.log(out.join('\n'));
