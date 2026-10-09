// Render a transparent HTML motion graphic to an alpha .mov (qtrle/argb, 1920x1080@60) through the deterministic stepper.
// usage: node render-overlay.mjs card-h-lockup.html out/h-lockup.mov [seconds=3.5] [dpr=2] [stillAtSeconds]
import { launch, Session, OUT_FPS } from '/tmp/space-video-prep/capture/rec.mjs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
const [html, out, secs = '3.5', dprArg = '2', still] = process.argv.slice(2);
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
const browser = await launch();
const s = await Session.open(browser, { url: 'file://' + path.resolve('/tmp/space-video-prep/cards', html), width: 1920, height: 1080, dpr: Number(dprArg), cursor: false, name: 'overlay' });
await s.page.evaluate(() => document.fonts.ready);
await s.page.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => {}))));
await s.freeze();
const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-c:v', 'png', '-framerate', String(OUT_FPS), '-i', '-', '-vf', 'scale=1920:1080:flags=lanczos,format=rgba', '-c:v', process.env.ALPHA_CODEC || 'png', '-r', String(OUT_FPS), out], { stdio: ['pipe', 'inherit', 'inherit'] });
const done = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg ' + c))));
const n = Math.round(Number(secs) * OUT_FPS);
for (let i = 0; i < n; i++) {
  await s.step(1);
  const buf = await s.page.screenshot({ type: 'png', omitBackground: true, animations: 'allow', caret: 'initial' });
  if (still && i === Math.round(Number(still) * OUT_FPS)) fs.writeFileSync(out.replace(/\.mov$/, `-t${still}.png`), buf);
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
}
ff.stdin.end(); await done;
console.log(JSON.stringify({ overlay: out, frames: n, seconds: n / OUT_FPS, bytes: fs.statSync(out).size }));
await s.close(); await browser.close();
