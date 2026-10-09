// Render an HTML motion-graphic card through the deterministic stepper: clip (mp4) + still (png).
// usage: node render-card.mjs card-a-open.html out-basename [seconds=5] [stillAtSeconds=3.2] [dpr=2]
import { launch, Session, OUT_FPS } from '/tmp/space-video-prep/capture/rec.mjs';
import path from 'node:path';
import fs from 'node:fs';

const [html, base, secs = '5', stillAt = '3.2', dprArg = '2'] = process.argv.slice(2);
const OUT = '/tmp/space-video-prep/cards/out/';
fs.mkdirSync(OUT, { recursive: true });
const browser = await launch();
const url = 'file://' + path.resolve('/tmp/space-video-prep/cards', html);
const s = await Session.open(browser, { url, width: 1920, height: 1080, dpr: Number(dprArg), cursor: false, name: base });
if (process.env.CARD_CSS) await s.page.addStyleTag({ path: path.resolve('/tmp/space-video-prep/cards', process.env.CARD_CSS) });
await s.page.evaluate(() => document.fonts.ready);
await s.page.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => {}))));
await s.freeze();
s.startRecording(`${OUT}${base}.mp4`, { w: 1920, h: 1080 });
const total = Math.round(Number(secs) * OUT_FPS), stills = String(stillAt).split(',').map(x => Math.round(Number(x) * OUT_FPS));
const t0 = Date.now();
for (let i = 0; i < total; i++) {
  await s.frames(1);
  const k = stills.indexOf(i);
  if (k >= 0) await s.still(stills.length === 1 ? `${OUT}${base}.png` : `${OUT}${base}-t${(i / OUT_FPS).toFixed(1)}.png`);
}
const r = await s.stopRecording();
import('node:child_process').then(({ execFileSync }) => { for (const f of fs.readdirSync(OUT).filter(f => f.startsWith(base) && f.endsWith('.png') && !f.endsWith('-1080.png'))) execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', OUT + f, '-vf', 'scale=1920:1080:flags=lanczos', OUT + f.replace('.png', '-1080.png')]); });
console.log(JSON.stringify({ card: base, frames: r.frames, seconds: +r.seconds.toFixed(2), bytes: r.bytes, wall_s: +((Date.now() - t0) / 1000).toFixed(1) }));
await s.close();
await browser.close();
