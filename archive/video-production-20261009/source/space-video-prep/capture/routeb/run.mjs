// node routeb/run.mjs rb-e1 [rb-e2 ...]      shots live in routeb/shots/<id>-*.mjs;   SPACE_BASE = app root url (e.g. http://127.0.0.1:47971/musicSpace/ or the Pages link)
// Each shot runs in its own child process with a fresh browser + a fresh visitor (empty storage), a timeout and one automatic retry, so shots are independent and can be re-taken any time.
//   SHOT_TIMEOUT_S (default 420)   RETRIES (default 1)
import { spawn } from 'node:child_process'; import path from 'node:path';
const base = process.env.SPACE_BASE; if (!base) { console.error('set SPACE_BASE (app root URL incl. trailing slash)'); process.exit(2); }
const ids = process.argv.slice(2); const here = path.dirname(new URL(import.meta.url).pathname);
const attempt = id => new Promise(res => {
  const child = spawn('node', [path.join(here, 'run-one.mjs'), id], { env: { ...process.env, SPACE_BASE: base }, stdio: ['ignore', 'inherit', 'inherit'] });
  const timer = setTimeout(() => { console.error(`[${id}] TIMEOUT after ${process.env.SHOT_TIMEOUT_S || 420}s, killing`); child.kill('SIGKILL'); }, 1000 * Number(process.env.SHOT_TIMEOUT_S || 420));
  child.on('close', code => { clearTimeout(timer); res(code === 0); });
});
let failed = 0;
for (const id of ids) {
  let ok = false;
  for (let n = 0; n <= Number(process.env.RETRIES ?? 1) && !ok; n++) { if (n) console.error(`[${id}] retry ${n}`); ok = await attempt(id); }
  if (!ok) { failed++; console.error(`[${id}] GAVE UP`); }
}
process.exit(failed ? 1 : 0);
