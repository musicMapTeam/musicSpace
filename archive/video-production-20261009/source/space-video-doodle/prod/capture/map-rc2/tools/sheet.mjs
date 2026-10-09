// sheet.mjs : contact sheet of a recording at its marks/events (for eyeballing).  node sheet.mjs <take.json> [cols] [extra seconds...]
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
const FF = '/opt/homebrew/bin/ffmpeg';
const t = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const cols = +(process.argv[3] || 8);
const extra = process.argv.slice(4).map(Number);
const file = t.files.edit || t.files.master || t.file;
const portrait = t.viewport && t.viewport.px[1] > t.viewport.px[0];
const W = portrait ? 270 : 480;
const frames = new Set();
for (const m of t.marks || []) if (Number.isFinite(m.frame)) frames.add(Math.max(0, Math.min(t.frames - 1, m.frame + 2)));
for (const e of t.events || []) if (e.type === 'tap' && Number.isFinite(e.frame)) { frames.add(e.frame + 4); frames.add(Math.min(t.frames - 1, e.frame + 40)); }
for (const sec of extra) frames.add(Math.round(sec * 60));
const list = [...frames].filter(f => f >= 0 && f < t.frames).sort((a, b) => a - b);
const sel = list.map(f => `eq(n\\,${f})`).join('+');
const rows = Math.ceil(list.length / cols);
const out = process.argv[2].replace(/\.take\.json$/, '').replace('/logs/', '/review/') + '-sheet.png';
fs.mkdirSync(out.replace(/\/[^/]+$/, ''), { recursive: true });
const vf = `select='${sel}',scale=${W}:-1,tile=${cols}x${rows}:padding=4:color=white`;
const r = spawnSync(FF, ['-v', 'error', '-i', file, '-vf', vf, '-fps_mode', 'passthrough', '-frames:v', '1', '-y', out], { encoding: 'utf8' });
if (r.status) { console.error(r.stderr); process.exit(1); }
console.log(out, list.length, 'frames:', list.join(','));
