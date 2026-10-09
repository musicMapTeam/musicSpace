// node shots/run.mjs s01 [s02 ...]   (module files: shots/<id>-*.mjs, each exports { meta, run })
// Each shot gets its own ephemeral server + fresh identities, so shots are independent and can be re-run any time.
import { launch, killSinks } from '../rec.mjs';
import { startServer } from '../world.mjs';
import fs from 'node:fs';
import path from 'node:path';
const ids = process.argv.slice(2);
const dir = path.dirname(new URL(import.meta.url).pathname);
for (const id of ids) {
  const file = fs.readdirSync(dir).find(f => f.startsWith(id + '-') && f.endsWith('.mjs'));
  if (!file) { console.error('no shot module for', id); process.exitCode = 1; continue; }
  const mod = await import(path.join(dir, file));
  const server = await startServer({ base: process.env.SPACE_BASE });
  const browser = await launch();
  const t0 = Date.now();
  const wd = setTimeout(() => { console.error(`[${id}] WATCHDOG: exceeded ${process.env.SHOT_TIMEOUT_S || 300}s, aborting`); process.exit(9); }, 1000 * Number(process.env.SHOT_TIMEOUT_S || 300));
  try {
    const res = await mod.run({ browser, base: server.base });
    console.log(JSON.stringify({ shot: id, ...mod.meta, ...res, wall_s: +((Date.now() - t0) / 1000).toFixed(1) }));
  } catch (e) { console.error(`[${id}] FAILED`, e.stack || e); process.exitCode = 1; }
  finally { clearTimeout(wd); killSinks(); await browser.close().catch(() => {}); await server.stop(); }
}

killSinks();
process.exit(process.exitCode || 0);
