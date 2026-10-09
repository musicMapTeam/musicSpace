// A long-lived probe browser: POST an async JS body to http://127.0.0.1:<port>/run (variables: get, L, sleep, fs, pages, shot).
// usage: node driver.cjs <port>     stops itself after 45 minutes; SIGTERM closes the browser.
const http = require('http');
const fs = require('fs');
const L = require('./lib.cjs');
const port = +process.argv[2] || 5391;
const OUT = '/tmp/space-video-doodle/script/probe/shots';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let browser;
const pages = {};
async function get(kind, fresh = false) {
  if (fresh && pages[kind]) { await pages[kind].ctx.close().catch(() => {}); delete pages[kind]; }
  if (pages[kind]) return pages[kind];
  const { ctx, page } = await L.open(browser, kind);
  pages[kind] = { ctx, page };
  return pages[kind];
}
async function shot(page, name) {
  await page.evaluate(() => document.activeElement?.blur?.()).catch(() => {});
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path });
  return path;
}
(async () => {
  browser = await L.launch();
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', async () => {
      try {
        const fn = new Function('get', 'L', 'sleep', 'fs', 'pages', 'shot', 'return (async()=>{' + body + '})()');
        const out = await Promise.race([fn(get, L, sleep, fs, pages, shot), sleep(240000).then(() => { throw Error('run timeout'); })]);
        res.end(JSON.stringify(out === undefined ? null : out, null, 1));
      } catch (e) { res.statusCode = 500; res.end('ERR ' + (e.stack || e.message)); }
    });
  });
  server.listen(port, '127.0.0.1', () => console.log('driver on', port, 'pid', process.pid));
  const quit = async () => { await browser.close().catch(() => {}); process.exit(0); };
  setTimeout(quit, 45 * 60 * 1000);
  process.on('SIGTERM', quit);
})();
