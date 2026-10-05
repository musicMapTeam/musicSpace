// Emulates GitHub Pages project-site hosting: the files of <dir> are served ONLY below <prefix>; every other path answers 404 like
// github.io/<some-other-repo> (so a stray root-absolute URL, /api/..., /shared/..., fails here as it would live). Responses are
// no-store, so a QA run never sees an old build. Local QA helpers: GET /__log lists the requests seen as "METHOD /path" (queries are
// not recorded), GET /__clear empties that list.
//
//   node scripts/pages/serve-prefix.mjs <dir> [prefix=/musicSpace/] [port=4783]
//   npm run preview:pages     (dist-pages at /musicSpace/ on 4783)
//
// Like Pages: a directory without a trailing slash redirects (301) to the slash form, a directory serves its index.html, GET and
// HEAD only. Not like Pages: no gzip, Cache-Control is no-store (Pages sends max-age=600).
import {createServer} from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {extname, join, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {realpathSync} from 'node:fs';

export const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.wasm': 'application/wasm', '.onnx': 'application/octet-stream', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.map': 'application/json; charset=utf-8',
};

/** '/musicSpace' -> '/musicSpace/', 'x' -> '/x/'. */
export function normalisePrefix(prefix = '/musicSpace/') {
  const clean = `/${String(prefix).replace(/^\/+|\/+$/g, '')}/`;
  return clean === '//' ? '/' : clean;
}

/** Creates (does not start) the server. `log` is the array behind /__log. */
export function createPrefixServer({dir, prefix = '/musicSpace/', log = []}) {
  const root = resolve(dir);
  const base = normalisePrefix(prefix);
  const send = (res, status, headers, body = '') => { res.writeHead(status, headers); res.end(body); };
  const server = createServer(async (req, res) => {
    let url;
    try { url = new URL(req.url, 'http://x'); } catch { return send(res, 400, {'Content-Type': 'text/plain'}, 'bad request'); }
    log.push(`${req.method} ${url.pathname}`);
    if (url.pathname === '/__log') return send(res, 200, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}, JSON.stringify(log));
    if (url.pathname === '/__clear') { log.length = 0; return send(res, 200, {'Content-Type': 'text/plain', 'Cache-Control': 'no-store'}, 'ok'); }
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, {'Content-Type': 'text/plain', Allow: 'GET, HEAD'}, 'Method Not Allowed');
    // github.io/musicSpace redirects to github.io/musicSpace/
    if (url.pathname === base.slice(0, -1) && base !== '/') return send(res, 301, {Location: base + url.search}, '');
    if (!url.pathname.startsWith(base)) return send(res, 404, {'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store'}, 'GitHub Pages 404 (outside prefix)');
    let relative;
    try { relative = decodeURIComponent(url.pathname.slice(base.length)); } catch { return send(res, 400, {'Content-Type': 'text/plain'}, 'bad request'); }
    if (relative.includes('\0')) return send(res, 400, {'Content-Type': 'text/plain'}, 'bad request');
    let file = resolve(join(root, relative));
    if (file !== root && !file.startsWith(root + sep)) return send(res, 403, {'Content-Type': 'text/plain'}, 'forbidden');
    try {
      let info = await stat(file);
      if (info.isDirectory()) {
        if (!url.pathname.endsWith('/')) return send(res, 301, {Location: `${url.pathname}/${url.search}`}, '');
        file = join(file, 'index.html');
        info = await stat(file);
      }
      const headers = {'Content-Type': CONTENT_TYPES[extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Content-Length': info.size};
      if (req.method === 'HEAD') return send(res, 200, headers);
      send(res, 200, headers, await readFile(file));
    } catch {
      send(res, 404, {'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store'}, 'GitHub Pages 404');
    }
  });
  return {server, log, prefix: base, root};
}

const isMain = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  const [dir, prefix = '/musicSpace/', port = '4783'] = process.argv.slice(2);
  if (!dir) { console.error('usage: node scripts/pages/serve-prefix.mjs <dir> [prefix=/musicSpace/] [port=4783]'); process.exit(2); }
  const {server, prefix: base, root} = createPrefixServer({dir, prefix});
  server.on('error', error => { console.error(`serve-prefix: ${error.code === 'EADDRINUSE' ? `port ${port} is in use` : error.message}`); process.exit(1); });
  server.listen(Number(port), '127.0.0.1', () => console.log(`serving ${root} at ${base} on ${port}`));
}
