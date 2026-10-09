// Frame-stepped renderer for doodle-motion scenes (Playwright + system Chrome, CDP screenshots, ffmpeg).
//   video : node tools/render.mjs --scene animatic --video out/x.mp4 [--audio a.wav] [--workers 4] [--from 0 --to N] [--crf 16]
//   stills: node tools/render.mjs --scene animatic --stills 120,300 --dir out/frames  (or --times 7.8,12.1 for seconds)
//   info  : node tools/render.mjs --scene animatic --info out/x.info.json   (events / cues / duration as the scene declares them)
// Each worker owns a contiguous frame range and pipes lossless RGB (libx264rgb -qp 0) into its own segment; the segments are
// concatenated and encoded once to H.264 High 4:2:0 BT.709 60 fps + AAC.  Determinism: every frame is DM.render(f) on a fresh state.
import { chromium } from '/tmp/space-video-prep/tools/node_modules/playwright-core/index.mjs';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path';
const ROOT = '/tmp/space-video-doodle/animatic';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FFMPEG = '/opt/homebrew/bin/ffmpeg';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => { if (x.startsWith('--')) a.push([x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]); return a; }, []));
const PORT = +(args.port || 47930); const scene = args.scene || 'animatic';
const URL = `http://127.0.0.1:${PORT}/stage.html?scene=${scene}`;

let server = null;
async function ensureServer() {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/stage.html`); if (r.ok) return; } catch {}
  server = spawn(process.execPath, [path.join(ROOT, 'tools/serve.mjs'), String(PORT)], { stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { await new Promise(r => setTimeout(r, 100)); try { const r = await fetch(`http://127.0.0.1:${PORT}/stage.html`); if (r.ok) return; } catch {} }
  throw new Error('server did not start');
}
async function openPage(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, locale: 'zh-CN' });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)));
  page.on('response', r => { if (r.status() >= 400) console.log('[http]', r.status(), r.url()); });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.text().slice(0, 300)); });
  await page.goto(URL, { waitUntil: 'load', timeout: 120000 });
  const info = await page.evaluate(() => window.__ready);
  const fontsOk = await page.evaluate(() => [...document.fonts].filter(f => f.status === 'error').map(f => f.family));
  if (fontsOk.length) console.log('font load errors:', fontsOk.join(', '));
  const cdp = await ctx.newCDPSession(page);
  return { ctx, page, cdp, info };
}
async function shot(p, f, { fast = true } = {}) {
  await p.page.evaluate(n => window.DM.render(n), f);
  const r = await p.cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: fast, fromSurface: true, captureBeyondViewport: false, clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 1 } });
  return Buffer.from(r.data, 'base64');
}
const launch = () => chromium.launch({ executablePath: CHROME, headless: true, args: ['--force-color-profile=srgb', '--hide-scrollbars', '--mute-audio', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--font-render-hinting=none', '--disable-checker-imaging', '--allow-file-access-from-files'] });

await ensureServer();
const browser = await launch();
try {
  if (args.info) {
    const p = await openPage(browser); fs.mkdirSync(path.dirname(path.resolve(ROOT, args.info)), { recursive: true });
    fs.writeFileSync(path.resolve(ROOT, args.info), JSON.stringify(p.info, null, 1)); console.log('info', p.info.frames, 'frames', p.info.events.length, 'events', p.info.cues.length, 'cues');
  }
  if (args.stills || args.times) {
    const p = await openPage(browser); const dir = path.resolve(ROOT, args.dir || 'out/stills'); fs.mkdirSync(dir, { recursive: true });
    const frames = args.stills ? String(args.stills).split(',').map(Number) : String(args.times).split(',').map(x => Math.round(parseFloat(x) * p.info.fps));
    const names = args.names ? String(args.names).split(',') : null;
    for (let i = 0; i < frames.length; i++) {
      const buf = await shot(p, frames[i], { fast: false });
      const file = path.join(dir, names ? names[i] + '.png' : `${scene}-f${String(frames[i]).padStart(5, '0')}.png`); fs.writeFileSync(file, buf); console.log('still', file);
    }
  }
  if (args.video) {
    const probe = await openPage(browser); const info = probe.info; await probe.ctx.close();
    const from = +(args.from || 0), to = +(args.to || info.frames); const W = +(args.workers || 4);
    const segDir = path.resolve(ROOT, 'work/seg-' + scene); fs.rmSync(segDir, { recursive: true, force: true }); fs.mkdirSync(segDir, { recursive: true });
    const n = to - from, per = Math.ceil(n / W); const t0 = Date.now(); let done = 0;
    const jobs = [];
    for (let k = 0; k < W; k++) {
      const a = from + k * per, b = Math.min(to, a + per); if (a >= b) continue;
      const seg = path.join(segDir, `seg${k}.mkv`);
      jobs.push((async () => {
        const p = await openPage(browser);
        const ff = spawn(FFMPEG, ['-y', '-v', 'error', '-f', 'image2pipe', '-c:v', 'png', '-framerate', String(info.fps), '-i', '-', '-c:v', 'libx264rgb', '-preset', 'ultrafast', '-qp', '0', '-pix_fmt', 'bgr0', seg], { stdio: ['pipe', 'inherit', 'inherit'] });
        const fin = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg ' + c))));
        for (let f = a; f < b; f++) {
          const buf = await shot(p, f);
          if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
          if (++done % 120 === 0) console.log(`${done}/${n} frames, ${((Date.now() - t0) / done).toFixed(0)} ms/frame overall`);
        }
        ff.stdin.end(); await fin; await p.ctx.close(); return seg;
      })());
    }
    const segs = await Promise.all(jobs);
    fs.writeFileSync(path.join(segDir, 'list.txt'), segs.map(s => `file '${s}'`).join('\n'));
    const out = path.resolve(ROOT, args.video); fs.mkdirSync(path.dirname(out), { recursive: true });
    const vf = 'scale=1920:1080:flags=lanczos+accurate_rnd+full_chroma_int:out_range=tv:out_color_matrix=bt709,format=yuv420p';
    const enc = ['-c:v', 'libx264', '-preset', args.preset || 'slow', '-crf', String(args.crf || 16), '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', String(info.fps),
      '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709:fullrange=off', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];
    const inputs = ['-f', 'concat', '-safe', '0', '-i', path.join(segDir, 'list.txt')];
    const audio = args.audio ? ['-i', path.resolve(ROOT, args.audio), '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2', '-shortest'] : ['-an'];
    execFileSync(FFMPEG, ['-y', '-v', 'error', ...inputs, ...audio, '-vf', vf, ...enc, '-movflags', '+faststart', out], { stdio: 'inherit' });
    console.log('video', out, ((Date.now() - t0) / 1000).toFixed(1), 's wall', fs.statSync(out).size, 'bytes');
    if (!args.keep) fs.rmSync(segDir, { recursive: true, force: true });
  }
} finally {
  await browser.close();
  if (server) server.kill();
}
