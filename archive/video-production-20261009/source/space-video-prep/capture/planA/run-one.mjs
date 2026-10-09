// internal: run ONE shot module against SPACE_BASE (called by run.mjs, which supplies the mirror, the timeout and the retry)
import { launch, killSinks } from '../rec.mjs';
import fs from 'node:fs';
import path from 'node:path';
const id = process.argv[2];
const dir = path.join(path.dirname(new URL(import.meta.url).pathname), 'shots');
const file = fs.readdirSync(dir).find(f => f.startsWith(id + '-') && f.endsWith('.mjs'));
if (!file) { console.error('no shot module for', id); process.exit(2); }
const mod = await import(path.join(dir, file));
const browser = await launch(); const t0 = Date.now();
try {
  const res = await mod.run({ browser, base: process.env.SPACE_BASE });
  console.log(JSON.stringify({ shot: id, ...mod.meta, ...res, wall_s: +((Date.now() - t0) / 1000).toFixed(1) }));
} catch (e) { console.error(`[${id}] FAILED`, e.stack || e); killSinks(); await browser.close().catch(() => {}); process.exit(1); }
killSinks(); await browser.close().catch(() => {}); process.exit(0);
