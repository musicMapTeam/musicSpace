// node planA/run.mjs pa-a1 [pa-a2 ...]    (module files: planA/shots/<id>-*.mjs, each exports { meta, run({browser, base}) })
// Plan A = the LIVE 0.16 page (main@54f3e6e, https://musicmapteam.github.io/musicSpace/) served from a byte-identical local mirror (live-mirror/, see live-mirror/fetch.sh),
// so every take is deterministic and independent of github.io speed from this network.  Each shot: own child process, fresh browser context (empty storage), timeout + one retry.
//   SHOT_TIMEOUT_S (default 300)   RETRIES (default 1)   SPACE_BASE (use an already running server instead of the mirror)
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
const ids = process.argv.slice(2);
const here = path.dirname(new URL(import.meta.url).pathname);
const freePort = () => new Promise(res => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
async function startMirror() {
  if (process.env.SPACE_BASE) return { base: process.env.SPACE_BASE, stop: () => {} };
  const port = await freePort();
  const p = spawn('node', ['/tmp/space-video-prep/tools/serve-prefix.mjs', '/tmp/space-video-prep/live-mirror', '/musicSpace/', String(port)], { stdio: 'ignore' });
  const stop = () => { try { p.kill('SIGTERM'); } catch {} };
  process.on('exit', stop);
  const base = `http://127.0.0.1:${port}/musicSpace/`;
  for (let i = 0; i < 50; i++) { try { if ((await fetch(base)).ok) return { base, stop }; } catch {} await new Promise(r => setTimeout(r, 100)); }
  stop(); throw new Error('mirror did not start');
}
const attempt = (id, base) => new Promise(res => {
  const child = spawn('node', [path.join(here, 'run-one.mjs'), id], { env: { ...process.env, SPACE_BASE: base }, stdio: ['ignore', 'inherit', 'inherit'] });
  const timer = setTimeout(() => { console.error(`[${id}] TIMEOUT after ${process.env.SHOT_TIMEOUT_S || 300}s, killing`); child.kill('SIGKILL'); }, 1000 * Number(process.env.SHOT_TIMEOUT_S || 300));
  child.on('close', code => { clearTimeout(timer); res(code === 0); });
});
const mirror = await startMirror();
let failed = 0;
for (const id of ids) {
  let ok = false;
  for (let n = 0; n <= Number(process.env.RETRIES ?? 1) && !ok; n++) { if (n) console.error(`[${id}] retry ${n}`); ok = await attempt(id, mirror.base); }
  if (!ok) { failed++; console.error(`[${id}] GAVE UP`); }
}
mirror.stop();
process.exit(failed ? 1 : 0);
