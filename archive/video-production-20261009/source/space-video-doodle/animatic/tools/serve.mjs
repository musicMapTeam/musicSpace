// Tiny static server for the motion system (no repo writes).  node tools/serve.mjs <port>
// /            -> /tmp/space-video-doodle/animatic
// /fonts/      -> /tmp/music-space-font-cache          (raw OFL/Apache TTFs)
// /pfonts/     -> <repo>/dist-pages/fonts/doodle       (the product's patched font slices, read-only)
// /doodle/     -> <repo>/web/event-room/doodle         (the product's tokens/type/kit CSS, read-only)
// /repoassets/ -> <repo>/web/assets                    (stage-scene.png / crowd-scene.png, read-only)
// /footage/    -> /tmp/space-video-doodle/capture-test (capture clips)
// /shots/      -> /tmp/space-video-doodle/script/probe (probe stills + avatar SVGs)
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const REPO = '/Users/alakazan/workplace/tme/musicSpace';
const MAP = [['/fonts/', '/tmp/music-space-font-cache/'], ['/pfonts/', REPO + '/dist-pages/fonts/doodle/'], ['/doodle/', REPO + '/web/event-room/doodle/'],
  ['/repoassets/', REPO + '/web/assets/'], ['/footage/', '/tmp/space-video-doodle/capture-test/'], ['/shots/', '/tmp/space-video-doodle/script/probe/'], ['/', '/tmp/space-video-doodle/animatic/']];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.webp': 'image/webp' };
const port = +process.argv[2] || 47930;
http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const m = MAP.find(([p]) => url.startsWith(p)); const file = path.join(m[1], url.slice(m[0].length));
  if (!file.startsWith(m[1].replace(/\/$/, ''))) { res.writeHead(403); return res.end(); }
  fs.stat(file, (e, st) => {
    if (e || !st.isFile()) { res.writeHead(404); return res.end('404 ' + url); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'max-age=3600', 'Access-Control-Allow-Origin': '*' });
    fs.createReadStream(file).pipe(res);
  });
}).listen(port, '127.0.0.1', () => console.log('serving on', port));
