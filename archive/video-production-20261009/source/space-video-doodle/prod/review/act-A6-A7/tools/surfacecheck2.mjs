import { chromium } from '/tmp/space-video-doodle/prod/tools/node_modules/playwright-core/index.mjs';
import { PNG } from '/tmp/space-video-doodle/prod/tools/node_modules/pngjs/lib/png.js';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ARGS = ['--force-color-profile=srgb', '--hide-scrollbars', '--mute-audio', '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows', '--font-render-hinting=none', '--disable-checker-imaging', '--disable-lcd-text', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'];
const html = `<html><body style="margin:0;background:#0f0"><div id=d style="position:absolute;left:0;top:0;width:1920px;height:1080px;background:linear-gradient(#f00,#00f)"></div></body></html>`;
const band = png => { for (let y = 0; y < png.height; y++) { const k = (y * png.width + 960) * 4; const [R, G, B] = [png.data[k], png.data[k + 1], png.data[k + 2]]; if (G > 200 || (R > 240 && G > 240 && B > 240)) return y; } return '-'; };
const variants = [
  ['plain', [], {}],
  ['window-size', ['--window-size=1920,1080'], {}],
  ['beyondViewport', [], { captureBeyondViewport: true }],
  ['notFromSurface', [], { fromSurface: false }],
  ['window-size+beyond', ['--window-size=1920,1200'], { captureBeyondViewport: true }],
];
for (const [name, extra, shot] of variants) {
  const br = await chromium.launch({ executablePath: CHROME, headless: true, args: [...ARGS, ...extra] });
  const ctx = await br.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage(); await page.setContent(html);
  const cdp = await ctx.newCDPSession(page); let res;
  try {
    const r = await cdp.send('Page.captureScreenshot', Object.assign({ format: 'png', optimizeForSpeed: true, fromSurface: true, captureBeyondViewport: false, clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 1 } }, shot));
    const png = PNG.sync.read(Buffer.from(r.data, 'base64')); res = `${png.width}x${png.height} band@${band(png)}`;
  } catch (e) { res = 'ERR ' + String(e).slice(0, 120); }
  console.log(name.padEnd(20), res);
  await br.close();
}
