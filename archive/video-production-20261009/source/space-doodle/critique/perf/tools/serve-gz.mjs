// Pages-like static server for perf QA: files of <dir> only below <prefix>, gzip for text types (GitHub Pages gzips
// html/css/js/json/svg/txt; woff2, wasm, onnx, jpg are sent as-is), Cache-Control no-store. Logs nothing.
//   node serve-gz.mjs <dir> <prefix> <port>
import {createServer} from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {extname, join, resolve, sep} from 'node:path';
import {gzipSync} from 'node:zlib';
const [dir, prefix = '/musicSpace/', port = '4890'] = process.argv.slice(2);
const root = resolve(dir);
const TYPES = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.wasm':'application/wasm','.onnx':'application/octet-stream','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','.woff2':'font/woff2'};
const GZ = new Set(['.html','.js','.mjs','.css','.json','.svg','.txt']);
const cache = new Map();
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith(prefix)) { res.writeHead(404); return res.end('404 outside prefix'); }
  let file = resolve(join(root, decodeURIComponent(url.pathname.slice(prefix.length))));
  if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403); return res.end(); }
  try {
    let info = await stat(file);
    if (info.isDirectory()) { file = join(file, 'index.html'); info = await stat(file); }
    const ext = extname(file).toLowerCase();
    let body = await readFile(file);
    const headers = {'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*'};
    if (GZ.has(ext) && /gzip/.test(req.headers['accept-encoding'] || '')) {
      const key = file + ':' + info.mtimeMs;
      if (!cache.has(key)) cache.set(key, gzipSync(body, {level: 6}));
      body = cache.get(key); headers['Content-Encoding'] = 'gzip'; headers['Vary'] = 'Accept-Encoding';
    }
    headers['Content-Length'] = body.length;
    res.writeHead(200, headers); res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(404); res.end('404'); }
}).listen(Number(port), '127.0.0.1', () => console.log(`serving ${root} at http://127.0.0.1:${port}${prefix}`));
