// Long-lived browser for ad-hoc probes. POST an async JS body to http://127.0.0.1:<port>/run
// The body sees: L (lib), get(vp, opts) -> {ctx,page} (cached per key), drop(key), sleep, fs, pages
// usage: node driver.cjs <port>   (exits by itself after 60 minutes)
const http = require('http');
const L = require('/tmp/space-doodle/critique/a11y/tools/lib.cjs');
const fs = require('fs');
const port = +process.argv[2] || 5391;
let browser; const pages = {};
async function get(vp, opts = {}) {
  const key = opts.key || vp;
  if (pages[key]) return pages[key];
  const r = await L.open(browser, vp, opts);
  pages[key] = r; return r;
}
async function drop(key) { if (pages[key]) { await pages[key].ctx.close().catch(() => {}); delete pages[key]; } }
(async () => {
  browser = await L.launch();
  const server = http.createServer((req, res) => {
    let body = ''; req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const fn = new Function('L', 'get', 'drop', 'sleep', 'fs', 'pages', 'return (async()=>{' + body + '})()');
        const out = await Promise.race([fn(L, get, drop, L.sleep, fs, pages), L.sleep(270000).then(() => { throw Error('run timeout'); })]);
        res.end(JSON.stringify(out === undefined ? null : out, null, 1));
      } catch (e) { res.statusCode = 500; res.end('ERR ' + (e.stack || e.message)); }
    });
  });
  server.listen(port, '127.0.0.1', () => console.log('driver on', port, 'pid', process.pid));
  setTimeout(async () => { await browser.close().catch(() => {}); process.exit(0); }, 60 * 60 * 1000);
  process.on('SIGTERM', async () => { await browser.close().catch(() => {}); process.exit(0); });
})();
