// Frame-stepped renderer for doodle-motion scenes: system Chrome (headless, real GPU), one screenshot per frame, chunked in parallel.
//
//   node tools/render.mjs --scene act-A0-A1 --map flipping-in --video out/acts/A0-A1.mp4 --from 1:1 --to 21:1 --mix
//        positions: '21:1' (storyboard bar:beat under the map), '38.5s' (seconds), 'f2340' (frame); default = the whole film
//        --mix         build the audio for exactly this range (tools/mix.py: music bed + synthesized SFX from the scene's events)
//        --audio a.wav use this audio instead (must start at --from)
//        --workers 6   parallel pages (default: 5)          --chunk 240   frames per chunk (default 240 = 4 s)
//        --crf 18      final H.264 CRF (default 18)          --target-mb 150-300   choose the CRF so the file lands in this range
//        --mezz hq|lossless  chunk format (hq = x264 4:4:4 CRF 4 "visually lossless", default; lossless = libx264rgb qp 0)
//        --resume      keep finished chunks of an interrupted run (same scene/map/range)   --keep   keep the chunks afterwards
//   node tools/render.mjs --scene S --map M --info out.json        DM.info(): events, texts, shots, assets, warnings, duration
//   node tools/render.mjs --scene S --map M --stills 5:1,31:3.5,f600 --dir out/stills [--names a,b,c]
//   node tools/render.mjs --scene S --map M --geom out.json [--stride 2] [--from --to]   text boxes per frame (QC: reading time, safe area)
//   node tools/render.mjs --scene S --map M --glyphs out.json      font actually used for every character (QC: glyph coverage)
//   node tools/render.mjs --scene S --map M --determinism 12       render 12 frames shuffled vs in order in a fresh page, compare pixels
// Output video: H.264 High, 1920x1080, 60 fps CFR, yuv420p, BT.709 (primaries/transfer/matrix, limited range), AAC-LC 48 kHz 256 kb/s.
import { chromium } from './node_modules/playwright-core/index.mjs';
import { PNG } from './node_modules/pngjs/lib/png.js';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path'; import net from 'node:net'; import os from 'node:os';

const PROD = '/tmp/space-video-doodle/prod';
const TOOLS = PROD + '/tools';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FF = '/opt/homebrew/bin/ffmpeg', FP = '/opt/homebrew/bin/ffprobe';
const PY = '/tmp/space-video-doodle/music-cc0/tools/venv-ana/bin/python';
const argv = process.argv.slice(2);
const A = {}; for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) { const k = argv[i].slice(2); const v = argv[i + 1]; if (v === undefined || v.startsWith('--')) A[k] = true; else { A[k] = v; i++; } }
const scene = A.scene; const mapId = A.map || 'flipping-in';
if (!scene) { console.error('usage: node tools/render.mjs --scene <scene[,scene]> --map <tempo map> (--video out.mp4 | --info f | --stills ... | --geom f | --glyphs f)'); process.exit(2); }
const log = (...a) => console.log(`[render ${new Date().toISOString().slice(11, 19)}]`, ...a);
const rel = p => path.isAbsolute(p) ? p : path.resolve(PROD, p);

// ---------------------------------------------------------------- server
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
let server = null, PORT = +(A.port || 0);
async function ensureServer() {
  if (PORT) { try { const r = await fetch(`http://127.0.0.1:${PORT}/dm/core.js`); if (r.ok) return; } catch {} }
  PORT = PORT || await freePort();
  server = spawn(process.execPath, [TOOLS + '/serve.mjs', String(PORT)], { stdio: ['ignore', 'ignore', 'inherit'] });
  for (let i = 0; i < 100; i++) { await new Promise(r => setTimeout(r, 100)); try { const r = await fetch(`http://127.0.0.1:${PORT}/dm/core.js`); if (r.ok) return; } catch {} }
  throw new Error('server did not start');
}
// tempo map must be compiled (cheap)
execFileSync(PY, [TOOLS + '/tempo.py', 'compile', mapId], { stdio: ['ignore', 'ignore', 'inherit'] });

const ARGS = ['--force-color-profile=srgb', '--hide-scrollbars', '--mute-audio', '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows', '--font-render-hinting=none', '--disable-checker-imaging', '--disable-lcd-text'];
const GPU = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'];
const launch = () => chromium.launch({ executablePath: CHROME, headless: true, args: A['no-gpu'] ? ARGS : [...ARGS, ...GPU] });
const URL_ = () => `http://127.0.0.1:${PORT}/dm/stage.html?map=${encodeURIComponent(mapId)}&scene=${encodeURIComponent(scene)}`;

async function openPage(browser, { quiet = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, locale: 'zh-CN' });
  const page = await ctx.newPage();
  const msgs = [];
  page.on('pageerror', e => { msgs.push('pageerror ' + String(e).slice(0, 300)); if (!quiet) console.log('[pageerror]', String(e).slice(0, 300)); });
  page.on('response', r => { if (r.status() >= 400) { msgs.push(`http ${r.status()} ${r.url()}`); if (!quiet) console.log('[http]', r.status(), r.url()); } });
  page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !quiet) console.log('[console]', m.text().slice(0, 300)); });
  await page.goto(URL_(), { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => window.__ready !== undefined, null, { timeout: 180000 });
  let info;
  try { info = await page.evaluate(() => window.__ready); } catch (e) { throw new Error('scene failed to load: ' + String(e).slice(0, 500)); }
  const fontErr = await page.evaluate(() => [...document.fonts].filter(f => f.status === 'error').map(f => f.family));
  if (fontErr.length) log('font load errors:', fontErr.join(', '));
  const cdp = await ctx.newCDPSession(page);
  return { ctx, page, cdp, info, msgs };
}
async function grab(p, f, fast = true) {
  await p.page.evaluate(n => window.DM.render(n), f);
  const r = await p.cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: fast, fromSurface: true, captureBeyondViewport: false, clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 1 } });
  return Buffer.from(r.data, 'base64');
}
async function toFrame(p, v, fps) {
  if (v === undefined || v === true) return null;
  const s = String(v);
  if (/^f\d+$/.test(s)) return +s.slice(1);
  if (/^-?[\d.]+s$/.test(s)) return Math.round(parseFloat(s) * fps);
  const t = await p.page.evaluate(x => DM.Tc(x), s);
  return Math.round(t * fps);
}

await ensureServer();
const browser = await launch();
const extraBrowsers = [];
const cleanup = async () => { for (const b of [browser, ...extraBrowsers]) { try { await b.close(); } catch {} } if (server) server.kill(); };
process.on('SIGINT', async () => { await cleanup(); process.exit(130); });
try {
  const probe = await openPage(browser);
  const info = probe.info; const fps = info.fps; const total = info.frames;
  if (info.warnings && info.warnings.length) log('scene warnings:', info.warnings.join(' | '));
  const F0 = (await toFrame(probe, A.from, fps)) ?? 0; const F1 = (await toFrame(probe, A.to, fps)) ?? total;

  if (A.info) {
    fs.mkdirSync(path.dirname(rel(A.info)), { recursive: true });
    fs.writeFileSync(rel(A.info), JSON.stringify(Object.assign({ scene, range_frames: [F0, F1] }, info), null, 1));
    log('info', rel(A.info), info.frames, 'frames,', info.events.length, 'events,', info.texts.length, 'texts');
  }
  if (A.stills) {
    const dir = rel(A.dir || 'out/stills'); fs.mkdirSync(dir, { recursive: true });
    const items = String(A.stills).split(','); const names = A.names ? String(A.names).split(',') : null;
    for (let i = 0; i < items.length; i++) {
      const f = await toFrame(probe, items[i], fps); const buf = await grab(probe, f, false);
      const file = path.join(dir, names ? names[i] + '.png' : `${scene.replace(/[^\w-]+/g, '+')}-${mapId}-f${String(f).padStart(5, '0')}.png`); fs.writeFileSync(file, buf); log('still', file, items[i]);
    }
  }
  if (A.geom) {
    const stride = +(A.stride || 2); const frames = [];
    for (let f = F0; f < F1; f += stride) { await probe.page.evaluate(n => DM.render(n), f); frames.push(Object.assign({ f }, await probe.page.evaluate(() => DM.geom()))); }
    fs.mkdirSync(path.dirname(rel(A.geom)), { recursive: true });
    fs.writeFileSync(rel(A.geom), JSON.stringify({ fps, stride, range: [F0, F1], safe: { x: 96, y: 54, W: 1920, H: 1080 }, frames }));
    log('geom', rel(A.geom), frames.length, 'samples');
  }
  if (A.glyphs) {
    // build a probe container: one span per (font stack, character) actually used by text nodes, then ask Chrome which font renders it
    const pairs = await probe.page.evaluate(() => {
      for (const sh of DM.shots) sh.el.style.display = 'block';
      const seen = new Map(); const roleOf = el => (el.closest('[data-dmtext]') || el).dataset.dmtext || 'text';
      for (const root of document.querySelectorAll('[data-dmtext]')) {
        const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        while (w.nextNode()) { const n = w.currentNode; const el = n.parentElement; const fam = getComputedStyle(el).fontFamily; const role = roleOf(el);
          for (const ch of n.data) { if (!ch.trim()) continue; const k = fam + '\u0000' + ch; if (!seen.has(k)) seen.set(k, { fam, ch, role, sample: (root.textContent || '').slice(0, 40) }); } }
      }
      const box = document.createElement('div'); box.id = 'glyphprobe'; box.style.cssText = 'position:absolute;left:0;top:0;font-size:64px;white-space:pre'; document.body.appendChild(box);
      const list = [...seen.values()]; list.forEach((it, i) => { const s = document.createElement('span'); s.dataset.gi = i; s.style.fontFamily = it.fam; s.textContent = it.ch; box.appendChild(s); });
      return list;
    });
    await probe.page.evaluate(async () => { await document.fonts.ready; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); });
    await probe.cdp.send('DOM.enable'); await probe.cdp.send('CSS.enable');
    const doc = await probe.cdp.send('DOM.getDocument', { depth: -1 });
    const { nodeIds } = await probe.cdp.send('DOM.querySelectorAll', { nodeId: doc.root.nodeId, selector: '#glyphprobe span' });
    const out = [];
    for (let i = 0; i < nodeIds.length; i++) {
      const { fonts } = await probe.cdp.send('CSS.getPlatformFontsForNode', { nodeId: nodeIds[i] });
      out.push(Object.assign({}, pairs[i], { fonts }));
    }
    fs.mkdirSync(path.dirname(rel(A.glyphs)), { recursive: true });
    fs.writeFileSync(rel(A.glyphs), JSON.stringify({ chars: out }, null, 0));
    const bad = out.filter(o => o.fonts.some(f => !f.isCustomFont));
    log('glyphs', rel(A.glyphs), out.length, 'font/char pairs,', bad.length, 'fall back to a system font', bad.length ? bad.map(b => b.ch).join('') : '');
  }
  if (A.determinism) {
    const N = +A.determinism; let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const frames = Array.from({ length: N }, (_, i) => F0 + Math.floor((i + rnd()) * (F1 - F0) / N));
    const shuffled = [...frames].sort(() => rnd() - 0.5); const got = {};
    for (const f of shuffled) got[f] = PNG.sync.read(await grab(probe, f, false)).data;
    const B = await openPage(browser, { quiet: true }); let worst = { f: -1, max: 0, px: 0 };
    for (const f of frames) { const b = PNG.sync.read(await grab(B, f, false)).data, a = got[f]; let max = 0, px = 0;
      for (let i = 0; i < a.length; i += 4) { const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])); if (d) { px++; if (d > max) max = d; } }
      if (max > worst.max || (max === worst.max && px > worst.px)) { worst = { f, max, px };
        if (A['det-dir']) { const dir = rel(A['det-dir']); fs.mkdirSync(dir, { recursive: true });
          const save = (data, name) => { const png = new PNG({ width: 1920, height: 1080 }); data.copy(png.data); fs.writeFileSync(path.join(dir, name), PNG.sync.write(png)); };
          save(Buffer.from(a), `f${f}-shuffled.png`); save(Buffer.from(b), `f${f}-fresh.png`); } } }
    log('determinism', N, 'frames: worst', JSON.stringify(worst), worst.max === 0 ? 'IDENTICAL' : 'DIFFERENT');
    await B.ctx.close();
  }
  if (A.eval) {                   // debugging: --at <pos> --eval "<js expression>" (evaluated after DM.render of that frame)
    const f = (await toFrame(probe, A.at || '1:1', fps)); await probe.page.evaluate(n => DM.render(n), f);
    const r = await probe.page.evaluate(src => { try { return JSON.stringify((0, eval)(src), null, 1); } catch (e) { return 'ERROR ' + e; } }, String(A.eval));
    console.log(r);
  }
  if (A.bench) {                  // time DM.render vs the screenshot on N consecutive frames from --from
    const N = +A.bench; let tr = 0, ts = 0;
    for (let f = F0; f < F0 + N; f++) {
      const a = performance.now(); await probe.page.evaluate(n => window.DM.render(n), f); const b = performance.now();
      await probe.cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true, fromSurface: true, captureBeyondViewport: false, clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 1 } });
      const c = performance.now(); tr += b - a; ts += c - b;
    }
    log(`bench ${N} frames: DM.render ${(tr / N).toFixed(1)} ms, screenshot ${(ts / N).toFixed(1)} ms per frame (${A['no-gpu'] ? 'no gpu' : 'gpu'})`);
  }
  await probe.ctx.close();

  if (A.video) {
    const out = rel(A.video); fs.mkdirSync(path.dirname(out), { recursive: true });
    const tag = `${scene.replace(/[^\w-]+/g, '+')}__${mapId}__${F0}-${F1}`;
    const work = path.join(TOOLS, '.work', tag); if (!A.resume) fs.rmSync(work, { recursive: true, force: true }); fs.mkdirSync(work, { recursive: true });
    const W = +(A.workers || 5), CH = +(A.chunk || 240); const lossless = A.mezz === 'lossless';
    const chunks = []; for (let a = F0; a < F1; a += CH) chunks.push([a, Math.min(F1, a + CH)]);
    const todo = chunks.filter(([a, b]) => !(A.resume && fs.existsSync(path.join(work, `c${a}-${b}.mkv`))));
    const t0 = Date.now(); let done = 0; const n = todo.reduce((s, [a, b]) => s + b - a, 0);
    log(`video ${F0}-${F1} (${((F1 - F0) / fps).toFixed(2)} s, ${chunks.length} chunks, ${todo.length} to render) with ${W} workers, mezzanine ${lossless ? 'lossless' : 'hq'}`);
    const vfM = 'scale=in_range=pc:out_range=tv:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int,format=yuv444p';
    const mezz = lossless ? ['-c:v', 'libx264rgb', '-preset', 'ultrafast', '-qp', '0', '-pix_fmt', 'bgr0']
      : ['-vf', vfM, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '4', '-pix_fmt', 'yuv444p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];
    const queue = [...todo];
    const worker = async (wi) => {
      // one browser PROCESS per worker: screenshots are PNG-encoded in the browser process, so pages of one browser do not scale
      const br = A['shared-browser'] ? browser : await launch(); extraBrowsers.push(br);
      const p = await openPage(br, { quiet: wi > 0 });
      while (queue.length) {
        const [a, b] = queue.shift(); const file = path.join(work, `c${a}-${b}.mkv`); const tmp = file + '.part.mkv';
        const ff = spawn(FF, ['-y', '-v', 'error', '-f', 'image2pipe', '-c:v', 'png', '-framerate', String(fps), '-i', '-', ...mezz, '-r', String(fps), tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
        const fin = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg mezzanine exit ' + c))));
        for (let f = a; f < b; f++) {
          const buf = await grab(p, f);
          if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
          if (++done % 300 === 0) { const el = (Date.now() - t0) / 1000; log(`${done}/${n} frames, ${(done / el).toFixed(1)} fps, eta ${((n - done) / (done / el)).toFixed(0)} s`); }
        }
        ff.stdin.end(); await fin; fs.renameSync(tmp, file);
      }
      if (p.msgs.length) fs.writeFileSync(path.join(work, `worker${wi}.log`), p.msgs.join('\n'));
      await p.ctx.close();
    };
    await Promise.all(Array.from({ length: Math.min(W, Math.max(1, todo.length)) }, (_, i) => worker(i)));
    const renderS = (Date.now() - t0) / 1000; log(`rendered ${n} frames in ${renderS.toFixed(1)} s (${(n / renderS).toFixed(1)} fps)`);
    fs.writeFileSync(path.join(work, 'list.txt'), chunks.map(([a, b]) => `file '${path.join(work, `c${a}-${b}.mkv`)}'`).join('\n'));
    // audio for exactly this range
    let audio = A.audio ? rel(A.audio) : null;
    if (A.mix) {
      const infoFile = path.join(work, 'info.json'); fs.writeFileSync(infoFile, JSON.stringify(info));
      audio = out.replace(/\.mp4$/, '') + '.mix.wav';
      const full = F0 === 0 && F1 === total;
      execFileSync(PY, [TOOLS + '/mix.py', mapId, infoFile, audio, '--from', String(F0 / fps), '--to', String(F1 / fps), ...(full ? ['--full'] : [])], { stdio: 'inherit' });
    }
    const encode = (crf) => {
      const vf = lossless ? 'scale=in_range=pc:out_range=tv:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int,format=yuv420p' : 'format=yuv420p';
      const enc = ['-c:v', 'libx264', '-preset', A.preset || 'slow', '-crf', String(crf), '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', String(fps), '-g', String(fps * 2),
        '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709:fullrange=off', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];
      const inputs = ['-f', 'concat', '-safe', '0', '-i', path.join(work, 'list.txt')];
      const aud = audio ? ['-i', audio, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2', '-t', ((F1 - F0) / fps).toFixed(6)] : ['-an'];
      execFileSync(FF, ['-y', '-v', 'error', ...inputs, ...aud, '-vf', vf, ...enc, '-movflags', '+faststart', '-metadata', `comment=doodle-motion ${scene} map=${mapId} frames ${F0}-${F1}`, out], { stdio: 'inherit' });
      return fs.statSync(out).size;
    };
    let crf = +(A.crf || 18); let size = encode(crf);
    if (A['target-mb']) {           // e.g. 150-300: re-encode (from the chunks, no re-render) until the size lands inside
      const [lo, hi] = String(A['target-mb']).split('-').map(Number); const mid = (lo + (hi || lo)) / 2;
      for (let it = 0; it < 4; it++) {
        const mb = size / 1e6; log(`encode crf ${crf}: ${mb.toFixed(1)} MB`);
        if (mb >= lo && mb <= (hi || lo)) break;
        crf = Math.max(8, Math.min(30, Math.round((crf + 6 * Math.log2(mb / mid)) * 10) / 10)); size = encode(crf);
      }
    }
    log(`video ${out}: ${(size / 1e6).toFixed(1)} MB, crf ${crf}, ${((Date.now() - t0) / 1000).toFixed(1)} s wall`);
    fs.writeFileSync(out.replace(/\.mp4$/, '') + '.render.json', JSON.stringify({ scene, map: mapId, frames: [F0, F1], seconds: [F0 / fps, F1 / fps], crf, bytes: size, audio, workers: W, chunk: CH, mezz: lossless ? 'lossless' : 'hq', render_fps: +(n / renderS).toFixed(2) }, null, 1));
    if (!A.keep) fs.rmSync(work, { recursive: true, force: true });
  }
} finally { await cleanup(); }
