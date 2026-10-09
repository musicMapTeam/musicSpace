// Determinism / freshness check: renders N frames in a random order in one page and in order in a fresh page, compares pixels.
// Prints the worst per-frame difference (8-bit levels, pixel count).  usage: node tools/determinism.mjs [scene] [N]
import { chromium } from '/tmp/space-video-prep/tools/node_modules/playwright-core/index.mjs';
import { PNG } from '/tmp/space-video-prep/tools/node_modules/pngjs/lib/png.js';
const scene = process.argv[2] || 'animatic', N = +(process.argv[3] || 16);
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--force-color-profile=srgb', '--hide-scrollbars', '--font-render-hinting=none', '--disable-checker-imaging'] });
const open = async () => { const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 }); const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:47930/stage.html?scene=${scene}`); const info = await page.evaluate(() => window.__ready); const cdp = await ctx.newCDPSession(page); return { page, cdp, info }; };
const grab = async (p, f) => { await p.page.evaluate(n => DM.render(n), f); const r = await p.cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 1 } }); return PNG.sync.read(Buffer.from(r.data, 'base64')).data; };
const A = await open(); const total = A.info.frames;
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const frames = Array.from({ length: N }, (_, i) => Math.floor((i + rnd()) * total / N));
const shuffled = [...frames].sort(() => rnd() - 0.5);
const got = {}; for (const f of shuffled) got[f] = await grab(A, f);
const Bp = await open(); let worst = { f: -1, max: 0, px: 0 };
for (const f of frames) { const b = await grab(Bp, f), a = got[f]; let max = 0, px = 0;
  for (let i = 0; i < a.length; i += 4) { const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])); if (d) { px++; if (d > max) max = d; } }
  if (max > worst.max || (max === worst.max && px > worst.px)) worst = { f, max, px }; console.log(`frame ${f}: max diff ${max}, ${px} px differ`); }
console.log('WORST', JSON.stringify(worst)); await browser.close();
