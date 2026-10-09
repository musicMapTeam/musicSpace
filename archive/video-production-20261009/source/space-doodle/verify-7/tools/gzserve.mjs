// Verification helper (not part of the repo): serves <dir> under <prefix> like GitHub Pages, with gzip for text types.
import {createServer} from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {extname, join, resolve, sep} from 'node:path';
import {gzipSync} from 'node:zlib';
const [dir, prefix = '/musicSpace/', port = '0'] = process.argv.slice(2);
const root = resolve(dir);
const TYPES = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.wasm':'application/wasm','.onnx':'application/octet-stream','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','.woff2':'font/woff2','.glb':'model/gltf-binary','.bin':'application/octet-stream'};
const GZ = new Set(['.html','.js','.mjs','.css','.json','.svg','.txt','.wasm','.map']);
const cache = new Map();
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith(prefix)) { res.writeHead(404); return res.end('404'); }
  let file = resolve(join(root, decodeURIComponent(url.pathname.slice(prefix.length))));
  if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403); return res.end(); }
  try {
    let info = await stat(file);
    if (info.isDirectory()) { file = join(file, 'index.html'); info = await stat(file); }
    const ext = extname(file).toLowerCase();
    const headers = {'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*'};
    let body = await readFile(file);
    if (GZ.has(ext) && /gzip/.test(req.headers['accept-encoding'] || '')) {
      const key = file + ':' + info.mtimeMs;
      if (!cache.has(key)) cache.set(key, gzipSync(body, {level: 6}));
      body = cache.get(key); headers['Content-Encoding'] = 'gzip'; headers['Vary'] = 'Accept-Encoding';
    }
    headers['Content-Length'] = body.length;
    res.writeHead(200, headers); res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(404); res.end('404'); }
});
server.listen(Number(port), '127.0.0.1', () => console.log(`gzserve ${root} ${prefix} port ${server.address().port} pid ${process.pid}`));
