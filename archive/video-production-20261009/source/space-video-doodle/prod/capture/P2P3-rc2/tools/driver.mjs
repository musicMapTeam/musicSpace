// Exploration driver for the P2/P3/cut-out pass: one long-lived Chrome (the capture rig's flags), sessions opened with the rig's Session
// (fake clock, seeded random, touch tap ring on phone).  POST an async JS body to http://127.0.0.1:<port>/run ; variables available:
//   get(kind, fresh)  -> rig Session (s.page, s.ctx ...) for 'phone' | 'desktop' | 'desk4k'
//   sleep, fs, H (flow helpers), shot(page, name) -> PNG in review/explore/
// usage: node tools/driver.mjs <port>    (stops itself after 50 minutes; SIGTERM closes the browser)
// (copy of capture/P2P3/tools/driver.mjs for the rc.2 pass: own port, own output folder, `browser` passed in)
import http from 'node:http';
import fs from 'node:fs';
import { launch, Session } from '/tmp/space-video-doodle/capture-test/rec2.mjs';
import * as H from './lib.mjs';

const port = +process.argv[2] || 48751;
const OUT = '/tmp/space-video-doodle/prod/capture/P2P3-rc2/probe/explore';
fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let browser;
const sessions = {};
async function get(kind, fresh = false) {
  if (fresh && sessions[kind]) { await sessions[kind].ctx.close().catch(() => {}); delete sessions[kind]; }
  if (sessions[kind]) return sessions[kind];
  sessions[kind] = await H.openApp(browser, H.VIEW[kind], { name: kind });
  return sessions[kind];
}
async function shot(page, name) {
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path, caret: 'initial' });
  return path;
}
browser = await launch();
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => { body += c; });
  req.on('end', async () => {
    try {
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      const fn = new AsyncFunction('get', 'sleep', 'fs', 'H', 'shot', 'sessions', 'browser', body);
      const out = await Promise.race([fn(get, sleep, fs, H, shot, sessions, browser), sleep(280000).then(() => { throw Error('run timeout'); })]);
      res.end(JSON.stringify(out === undefined ? null : out, null, 1));
    } catch (e) { res.statusCode = 500; res.end('ERR ' + (e.stack || e.message)); }
  });
});
server.listen(port, '127.0.0.1', () => console.log('driver on', port, 'pid', process.pid));
const quit = async () => { for (const s of Object.values(sessions)) await s.ctx.close().catch(() => {}); await browser.close().catch(() => {}); process.exit(0); };
setTimeout(quit, 50 * 60 * 1000);
process.on('SIGTERM', quit);
process.on('SIGINT', quit);
