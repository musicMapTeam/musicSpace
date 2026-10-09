// Static + asset server for the doodle-motion production (read-only on every source; caches only under prod/tools/.cache).
//   node tools/serve.mjs [port]            (tools/render.mjs starts one on a free port by itself)
// Routes:
//   /dm/ /scenes/ /audio/ /out/       -> prod/dm, prod/scenes, prod/audio, prod/out
//   /maps/<id>.json                   -> prod/tools/tempo-maps/compiled/<id>.json   (tools/tempo.py compile <id>)
//   /script/timeline.json             -> script/out/timeline.json (SCRIPT.md lines, used by DM.say)
//   /fonts/                           -> /tmp/music-space-font-cache (raw OFL/Apache TTFs)
//   /pfonts/                          -> /tmp/space-publish/dist-pages/fonts/doodle (the product's patched slices, the build being filmed)
//   /build/                           -> /tmp/space-publish/dist-pages (demo photos etc.)
//   /capture/                         -> prod/capture
//   /a/<name>, /a-info/<name>         -> asset resolver (capture ids, aliases, placeholders: prod/dm/assets.json)
//   /clip/<name>/<n>.jpg              -> frame n of a video (lazy, frame-accurate extraction in 2 s windows, cached)
//   /clip-info/<name>                 -> {path, fps, frames, w, h, duration, placeholder}
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';

const PROD = '/tmp/space-video-doodle/prod';
const FF = '/opt/homebrew/bin/ffmpeg', FP = '/opt/homebrew/bin/ffprobe';
const CACHE = path.join(PROD, 'tools/.cache/frames');
const MAP = [
  ['/dm/', PROD + '/dm/'], ['/scenes/', PROD + '/scenes/'], ['/audio/', PROD + '/audio/'], ['/out/', PROD + '/out/'], ['/capture/', PROD + '/capture/'],
  ['/maps/', PROD + '/tools/tempo-maps/compiled/'], ['/script/', '/tmp/space-video-doodle/script/out/'],
  ['/fonts/', '/tmp/music-space-font-cache/'], ['/pfonts/', '/tmp/space-publish/dist-pages/fonts/doodle/'], ['/build/', '/tmp/space-publish/dist-pages/'],
  ['/probe/', '/tmp/space-video-doodle/script/probe/'], ['/animatic/', '/tmp/space-video-doodle/animatic/'],
];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.webp': 'image/webp',
  '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg' };
const VIDEO = new Set(['.mp4', '.mov', '.mkv', '.webm', '.m4v']);
const STILL = ['.png', '.jpg', '.jpeg', '.svg', '.webp'];
const SKIP_DIRS = new Set(['probe', 'review', 'qc', 'logs', 'tools', 'rig', 'sheet', 'explore', 'node_modules', '.cache', 'work', 'tmp']);
const DIR_RANK = ['master', 'clips', 'cut', 'stills', 'exports', 'avatars', '1080'];

// ---------------------------------------------------------------- capture index (basename without extension -> files)
let index = null, indexAt = 0;
function walk(dir, out) {
  let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(p, out); }
    else { const ext = path.extname(e.name).toLowerCase(); if (VIDEO.has(ext) || STILL.includes(ext)) { const k = e.name.slice(0, -ext.length); (out[k] = out[k] || []).push(p); } }
  }
}
function captureIndex(force = false) {
  if (!index || force || Date.now() - indexAt > 4000) { const out = {}; walk(PROD + '/capture', out); index = out; indexAt = Date.now(); }
  return index;
}
const rankOf = p => { const parts = p.split(path.sep); let best = 99; parts.forEach(d => { const i = DIR_RANK.indexOf(d); if (i >= 0 && i < best) best = i; });
  if (parts.some(d => /^(run\d*|dry|old|tmp|test|draft)$/i.test(d))) best += 20;      // trial runs rank below delivered files
  return best; };
const registry = () => { try { return JSON.parse(fs.readFileSync(PROD + '/dm/assets.json', 'utf8')); } catch { return { alias: {}, fallback: {} }; } };

/** resolve an asset name; want = 'still' | 'video' | 'any' */
function resolve(name, want = 'any') {
  const okExt = p => { const e = path.extname(p).toLowerCase(); return want === 'any' || (want === 'video' ? (VIDEO.has(e) || STILL.includes(e)) : STILL.includes(e)); };
  if (name.startsWith('/')) return fs.existsSync(name) ? { name, path: name, kind: 'path' } : { name, path: null, kind: 'path' };
  if (name.includes('/') || /\.[a-z0-9]{2,4}$/i.test(name)) { const p = path.join(PROD, name); return fs.existsSync(p) ? { name, path: p, kind: 'path' } : { name, path: null, kind: 'path' }; }
  const R = registry();
  if (R.alias && R.alias[name]) return { name, path: fs.existsSync(R.alias[name]) ? R.alias[name] : null, kind: 'alias' };
  // capture files are named "<ID>_<description>[.opaque].<ext>" (e.g. CUT-05_badge-other-side.png): a name matches its exact
  // basename first, else any basename that starts with "<name>_" or "<name>." (CUT-04 does not match CUT-04a_...: ask for CUT-04a).
  // Preference: exact > prefix, transparent over ".opaque" (ask for "<name>.opaque" to get the opaque one), video/still by want,
  // directory (master > clips > cut > stills > exports > avatars > 1080), then the larger file.
  for (const force of [false, true]) {
    if (force && Date.now() - indexAt < 2000) break;           // a forced rescan at most every 2 s
    const idx = captureIndex(force); const hits = [];
    const wantOpaque = name.endsWith('.opaque'); const base = wantOpaque ? name.slice(0, -7) : name;
    for (const [k, files] of Object.entries(idx)) {
      const exact = k === name; const prefix = !exact && (k.startsWith(base + '_') || k.startsWith(base + '.'));
      if (!exact && !prefix) continue;
      const opaque = k.endsWith('.opaque');
      if (!exact && wantOpaque && !opaque) continue;
      for (const f of files) if (okExt(f)) hits.push({ f, exact, opaque });
    }
    if (hits.length) {
      const pref = want === 'video' ? (p => VIDEO.has(path.extname(p).toLowerCase()) ? 0 : 1) : (p => STILL.indexOf(path.extname(p).toLowerCase()) + 1 || 9);
      hits.sort((a, b) => (b.exact - a.exact) || (a.opaque - b.opaque) || pref(a.f) - pref(b.f) || rankOf(a.f) - rankOf(b.f) || fs.statSync(b.f).size - fs.statSync(a.f).size);
      return { name, path: hits[0].f, kind: 'capture', candidates: hits.length };
    }
  }
  if (R.fallback && R.fallback[name]) return { name, path: fs.existsSync(R.fallback[name]) ? R.fallback[name] : null, kind: 'fallback', placeholder: true };
  return { name, path: null, kind: 'missing' };
}

// ---------------------------------------------------------------- video info + frame windows
const infoCache = new Map();
function clipInfo(p) {
  const st = fs.statSync(p); const key = p + ':' + st.size + ':' + st.mtimeMs;
  if (infoCache.has(key)) return infoCache.get(key);
  let info;
  if (!VIDEO.has(path.extname(p).toLowerCase())) info = { fps: 60, frames: 1, still: true };
  else {
    const j = JSON.parse(execFileSync(FP, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate,nb_frames,duration:format=duration', '-of', 'json', p]).toString());
    const s = j.streams[0]; const [a, b] = s.r_frame_rate.split('/').map(Number); const fps = a / b;
    let frames = parseInt(s.nb_frames || '0', 10);
    if (!frames) frames = Math.round(parseFloat(s.duration || j.format.duration) * fps);
    info = { fps, frames, w: s.width, h: s.height, duration: +(frames / fps).toFixed(4) };
  }
  info.key = crypto.createHash('md5').update(key).digest('hex').slice(0, 10);
  infoCache.set(key, info); return info;
}
const WIN = 120; const inflight = new Map(); let running = 0; const queue = [];
const slot = () => new Promise(r => { if (running < 3) { running++; r(); } else queue.push(r); });
const release = () => { const n = queue.shift(); if (n) n(); else running--; };
async function frameFile(p, n) {
  const info = clipInfo(p);
  if (info.still) return p;
  n = Math.max(0, Math.min(info.frames - 1, n));
  const dir = path.join(CACHE, path.basename(p).replace(/[^\w.-]/g, '_') + '-' + info.key);
  const file = path.join(dir, `f${String(n).padStart(6, '0')}.jpg`);
  if (fs.existsSync(file)) return file;
  const w0 = Math.floor(n / WIN) * WIN; const key = dir + ':' + w0;
  if (!inflight.has(key)) inflight.set(key, (async () => {
    fs.mkdirSync(dir, { recursive: true }); await slot();
    try {
      const ss = w0 > 0 ? ['-ss', ((w0 - 0.25) / info.fps).toFixed(6)] : [];
      const vf = 'scale=in_color_matrix=bt709:in_range=tv:out_color_matrix=bt601:out_range=pc:flags=accurate_rnd+full_chroma_int,format=yuvj420p';
      await new Promise((res, rej) => { const pr = spawn(FF, ['-v', 'error', ...ss, '-i', p, '-frames:v', String(Math.min(WIN, info.frames - w0)), '-vf', vf, '-q:v', '2', '-start_number', String(w0), path.join(dir, 'f%06d.jpg')], { stdio: ['ignore', 'ignore', 'pipe'] });
        let err = ''; pr.stderr.on('data', d => err += d); pr.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg ' + c + ' ' + err))); });
    } finally { release(); }
  })().finally(() => inflight.delete(key)));
  await inflight.get(key);
  if (!fs.existsSync(file)) throw new Error('frame not extracted: ' + file);
  return file;
}

// ---------------------------------------------------------------- http
function sendFile(res, file, extra = {}) {
  fs.stat(file, (e, st) => {
    if (e || !st.isFile()) { res.writeHead(404); return res.end('404 ' + file); }
    res.writeHead(200, Object.assign({ 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' }, extra));
    fs.createReadStream(file).pipe(res);
  });
}
const json = (res, o, code = 200) => { const b = Buffer.from(JSON.stringify(o)); res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': b.length, 'Cache-Control': 'no-cache' }); res.end(b); };
const port = +process.argv[2] || 47940;
http.createServer(async (req, res) => {
  try {
    const url = decodeURIComponent(req.url.split('?')[0]);
    let m;
    if ((m = url.match(/^\/a\/(.+)$/))) {          // a still; a capture that exists only as video serves its first frame
      let r = resolve(m[1], 'still');
      if (!r.path || r.placeholder) { const v = resolve(m[1], 'video'); if (v.path && v.kind === 'capture') return sendFile(res, await frameFile(v.path, 0)); }
      if (!r.path) { res.writeHead(404); return res.end('asset not found: ' + m[1]); } return sendFile(res, r.path); }
    if ((m = url.match(/^\/a-info\/(.+)$/))) { let r = resolve(m[1], 'still'); if (!r.path || r.placeholder) { const v = resolve(m[1], 'video'); if (v.path && v.kind === 'capture') r = Object.assign(v, { frame: 0 }); } return json(res, r); }
    if ((m = url.match(/^\/clip-info\/(.+)$/))) { const r = resolve(m[1], 'video'); if (!r.path) return json(res, r); return json(res, Object.assign({}, r, clipInfo(r.path))); }
    if ((m = url.match(/^\/clip\/(.+)\/(\d+)\.jpg$/))) { const r = resolve(m[1], 'video'); if (!r.path) { res.writeHead(404); return res.end('clip not found'); } return sendFile(res, await frameFile(r.path, +m[2])); }
    if (url === '/' || url === '/stage.html') return sendFile(res, PROD + '/dm/stage.html');
    const mm = MAP.find(([p]) => url.startsWith(p));
    if (!mm) { res.writeHead(404); return res.end('404 ' + url); }
    const file = path.join(mm[1], url.slice(mm[0].length));
    if (!file.startsWith(mm[1].replace(/\/$/, ''))) { res.writeHead(403); return res.end(); }
    sendFile(res, file);
  } catch (e) { console.error('[serve]', req.url, String(e).slice(0, 300)); res.writeHead(500); res.end(String(e)); }
}).listen(port, '127.0.0.1', () => console.log('doodle-motion server on', port));
