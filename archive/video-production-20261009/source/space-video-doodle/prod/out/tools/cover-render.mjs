// Cover still at 2x (3840x2160) from a doodle-motion scene, then the deliverable sizes are made with PIL (Lanczos).
//   node out/tools/cover-render.mjs [scene=../out/cover/cover] [out=out/cover-3840x2160.png] [t=1.0]
import { chromium } from '/tmp/space-video-doodle/prod/tools/node_modules/playwright-core/index.mjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs'; import net from 'node:net'; import path from 'node:path';

const PROD = '/tmp/space-video-doodle/prod';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const scene = process.argv[2] || '../out/cover/cover';
const out = path.resolve(PROD, process.argv[3] || 'out/cover-3840x2160.png');
const t = +(process.argv[4] || 1.0);
const port = await new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const server = spawn(process.execPath, [PROD + '/tools/serve.mjs', String(port)], { stdio: ['ignore', 'ignore', 'inherit'] });
for (let i = 0; i < 100; i++) { await new Promise(r => setTimeout(r, 100)); try { if ((await fetch(`http://127.0.0.1:${port}/dm/core.js`)).ok) break; } catch {} }
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--window-size=1920,1080', '--force-color-profile=srgb', '--hide-scrollbars', '--mute-audio',
  '--font-render-hinting=none', '--disable-lcd-text', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2, locale: 'zh-CN' });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)));
  await page.goto(`http://127.0.0.1:${port}/dm/stage.html?map=flipping-in&scene=${encodeURIComponent(scene)}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready !== undefined, null, { timeout: 120000 });
  const info = await page.evaluate(() => window.__ready);
  if (info.warnings && info.warnings.length) console.log('scene warnings:', info.warnings.join(' | '));
  await page.evaluate(async f => { await DM.render(f); await document.fonts.ready; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }, Math.round(t * 60));
  fs.writeFileSync(out, await page.screenshot({ type: 'png', scale: 'device', clip: { x: 0, y: 0, width: 1920, height: 1080 }, animations: 'disabled', caret: 'hide' }));
  const glyphs = await page.evaluate(() => [...document.fonts].filter(f => f.status === 'error').map(f => f.family));
  console.log('cover', out, glyphs.length ? 'font errors: ' + glyphs.join(',') : 'fonts ok');
} finally { await browser.close(); server.kill(); }
