// Pages-like static server for the verify-6 perf check.
//   node serve.mjs <h1|h2> <dir> <prefix> <port>
// h1: plain HTTP/1.1 (what serve-gz.mjs does). h2: HTTP/2 over TLS (self-signed; GitHub Pages answers HTTP/2).
// gzip for html/css/js/json/svg/txt like GitHub Pages; woff2/wasm/jpg sent as-is. Cache-Control: no-store.
import {createServer} from 'node:http';
import {createSecureServer} from 'node:http2';
import {readFile, stat} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {extname, join, resolve, sep, dirname} from 'node:path';
import {gzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
const [mode, dir, prefix = '/musicSpace/', port = '4990'] = process.argv.slice(2);
const root = resolve(dir);
const here = dirname(fileURLToPath(import.meta.url));
const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.wasm': 'application/wasm', '.onnx': 'application/octet-stream', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2'};
const GZ = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.txt']);
const cache = new Map();
async function handler(req, res) {
  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith(prefix)) { res.writeHead(404); return res.end('404 outside prefix'); }
  let file = resolve(join(root, decodeURIComponent(url.pathname.slice(prefix.length))));
  if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403); return res.end(); }
  try {
    let info = await stat(file);
    if (info.isDirectory()) { file = join(file, 'index.html'); info = await stat(file); }
    const ext = extname(file).toLowerCase();
    let body = await readFile(file);
    const headers = {'content-type': TYPES[ext] || 'application/octet-stream', 'cache-control': 'no-store', 'access-control-allow-origin': '*'};
    if (GZ.has(ext) && /gzip/.test(req.headers['accept-encoding'] || '')) {
      const key = file + ':' + info.mtimeMs;
      if (!cache.has(key)) cache.set(key, gzipSync(body, {level: 6}));
      body = cache.get(key); headers['content-encoding'] = 'gzip'; headers['vary'] = 'Accept-Encoding';
    }
    headers['content-length'] = body.length;
    res.writeHead(200, headers); res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(404); res.end('404'); }
}
const server = mode === 'h2'
  ? createSecureServer({key: readFileSync(join(here, 'key.pem')), cert: readFileSync(join(here, 'cert.pem')), allowHTTP1: false}, handler)
  : createServer(handler);
server.listen(Number(port), '127.0.0.1', () => console.log(`${mode} serving ${root} at ${mode === 'h2' ? 'https' : 'http'}://127.0.0.1:${port}${prefix}`));
