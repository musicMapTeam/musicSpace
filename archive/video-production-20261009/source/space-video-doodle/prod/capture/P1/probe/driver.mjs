// Exploration driver for TAKE-P1 (not used for the take itself): a long-lived phone session on the rig's fake clock (following real
// time, not frozen) against dist-pages.  POST an async JS body to http://127.0.0.1:<port>/run ; variables: s (Session), page, sleep,
// shot(name) -> CSS-px screenshot in probe/shots, fresh() -> new context (new example world), txt(sel), btns().
// usage: node driver.mjs <port>   (stops itself after 50 min; SIGTERM closes the browser)
import http from 'node:http';
import fs from 'node:fs';
import { launch, Session, PHONE, sleep } from '../rig/rec2.mjs';
const port = +process.argv[2] || 47841;
const BASE = process.env.SPACE_BASE || 'http://127.0.0.1:47831/musicSpace/';
const SHOTS = '/tmp/space-video-doodle/prod/capture/P1/probe/shots'; fs.mkdirSync(SHOTS, { recursive: true });
const browser = await launch();
let s = null;
async function fresh(opts = {}) {
  if (s) await s.ctx.close().catch(() => {});
  s = await Session.open(browser, { url: BASE, ...PHONE, cursor: 'touch', name: 'probe', clockStart: '2026-10-07T22:40:00+08:00', ...opts });
  await s.page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 60000 });
  await s.page.evaluate(() => document.fonts.ready);
  return s;
}
const shot = async (name, opts = {}) => { const p = `${SHOTS}/${name}.png`; await s.page.screenshot({ path: p, scale: 'css', ...opts }); return p; };
const txt = (sel = 'body') => s.page.evaluate(q => (document.querySelector(q)?.innerText || '').replace(/\n{2,}/g, '\n').slice(0, 5000), sel);
const btns = () => s.page.evaluate(() => [...document.querySelectorAll('button,a,summary,[role=button],input,select,textarea,label')]
  .filter(b => b.getClientRects().length && getComputedStyle(b).visibility !== 'hidden')
  .map(b => { const r = b.getBoundingClientRect(); const d = Object.entries(b.dataset).map(([k, v]) => `data-${k.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}=${v}`).join(' ');
    return `${b.tagName.toLowerCase()}${b.name ? '[name=' + b.name + ']' : ''}${b.type && b.tagName === 'INPUT' ? '[' + b.type + ']' : ''} ${(b.textContent || b.value || '').trim().replace(/\s+/g, ' ').slice(0, 40)}${b.id ? ' #' + b.id : ''}${d ? ' [' + d + ']' : ''} @${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`; }));
const server = http.createServer((req, res) => {
  let body = ''; req.on('data', c => { body += c; });
  req.on('end', async () => {
    try {
      const fn = new Function('s', 'page', 'sleep', 'shot', 'fresh', 'txt', 'btns', 'fs', 'return (async()=>{' + body + '})()');
      const out = await Promise.race([fn(s, s?.page, sleep, shot, fresh, txt, btns, fs), sleep(200000).then(() => { throw Error('run timeout'); })]);
      res.end(JSON.stringify(out === undefined ? null : out, null, 1));
    } catch (e) { res.statusCode = 500; res.end('ERR ' + (e.stack || e.message)); }
  });
});
server.listen(port, '127.0.0.1', () => console.log('driver on', port, 'pid', process.pid));
const quit = async () => { await browser.close().catch(() => {}); process.exit(0); };
setTimeout(quit, 50 * 60 * 1000);
process.on('SIGTERM', quit);
