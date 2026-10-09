// 2x2 contact sheet of a captured clip, rendered as a Doodle-style HTML page in Chrome (fonts: /tmp/music-space-font-cache, @font-face).
// usage: node sheet.mjs <clip.mp4> "<title>" n1:"label 1" n2:"label 2" n3:"label 3" n4:"label 4"
import { chromium } from '/tmp/space-video-prep/tools/node_modules/playwright-core/index.mjs';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const [clip, title, ...cells] = process.argv.slice(2);
const name = path.basename(clip, '.mp4');
const dir = `/tmp/space-video-doodle/capture-test/sheets/${name}`; fs.mkdirSync(dir, { recursive: true });
const probe = JSON.parse(execFileSync('/opt/homebrew/bin/ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,nb_frames,avg_frame_rate', '-of', 'json', clip]).toString()).streams[0];
const portrait = probe.height > probe.width;
const items = cells.map(c => { const i = c.indexOf(':'); return { n: +c.slice(0, i), label: c.slice(i + 1) }; });
for (const it of items) {
  it.file = `${dir}/f${String(it.n).padStart(4, '0')}.png`;
  execFileSync('/opt/homebrew/bin/ffmpeg', ['-v', 'error', '-y', '-i', clip, '-vf', `select=eq(n\\,${it.n})`, '-fps_mode', 'passthrough', '-frames:v', '1', it.file]);
  it.t = (it.n / 60).toFixed(2);
}
const F = n => `file:///tmp/music-space-font-cache/${n}.ttf`;
const cellW = portrait ? 500 : 880, cellH = Math.round(cellW * probe.height / probe.width);
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:DDisplay;src:url(${F('display')})}@font-face{font-family:DMarker;src:url(${F('marker')})}@font-face{font-family:DHand;src:url(${F('hand')})}
@font-face{font-family:DLogo;src:url(${F('logo')})}@font-face{font-family:DDigits;src:url(${F('digits')})}@font-face{font-family:DNote;src:url(${F('note')})}
*{box-sizing:border-box}body{margin:0;background:#f7efdf radial-gradient(circle,#1c1b1a24 1.3px,transparent 1.6px) 0 0/24px 24px;color:#1c1b1a;font-family:DHand,sans-serif}
.page{padding:34px 40px 40px;width:${cellW * 2 + 40 * 2 + 50}px}
.logo{font-family:DLogo;font-size:30px;color:#ffd447;-webkit-text-stroke:2px #1c1b1a;paint-order:stroke;text-shadow:3px 3px 0 #ff5c8a;letter-spacing:1px}
h1{font-family:DDisplay;font-weight:400;font-size:${portrait ? 46 : 54}px;margin:8px 0 6px;line-height:1.15;text-shadow:4px 4px 0 #ff5c8a}
.meta{font-family:DMarker;font-size:17px;margin:0 0 26px}.meta b{background:#5fdcc0;border:2px solid #1c1b1a;border-radius:999px;padding:1px 10px;margin-right:6px;font-weight:400}
.grid{display:grid;grid-template-columns:repeat(2,${cellW}px);gap:${portrait ? 46 : 40}px 50px}
.cell{position:relative;background:#fffdf6;border:2.5px solid #1c1b1a;border-radius:6px 9px 5px 8px;padding:12px 12px 54px;box-shadow:6px 6px 0 #1c1b1a}
.cell:nth-child(1){transform:rotate(-.8deg)}.cell:nth-child(2){transform:rotate(.7deg)}.cell:nth-child(3){transform:rotate(.5deg)}.cell:nth-child(4){transform:rotate(-.6deg)}
.cell img{display:block;width:${cellW - 24 - 5}px;height:auto;border:2px solid #1c1b1a}
.tape{position:absolute;top:-14px;left:50%;width:110px;height:26px;margin-left:-55px;background:#ffd447c8;border:1.5px dashed #1c1b1a55;transform:rotate(-3deg)}
.cell:nth-child(even) .tape{background:#ff5c8aa8;transform:rotate(4deg)}
.cap{position:absolute;left:14px;right:14px;bottom:10px;display:flex;align-items:center;gap:10px;font-family:DMarker;font-size:19px}
.cap .no{font-family:DDigits;font-size:22px;background:#ffd447;border:2px solid #1c1b1a;border-radius:8px;padding:0 8px;box-shadow:2px 2px 0 #1c1b1a}
.cap .t{margin-left:auto;font-family:DDigits;font-size:18px;color:#1c1b1a99}
</style></head><body><div class="page"><div class="logo">Music Space</div><h1>${title}</h1>
<p class="meta"><b>${probe.width}×${probe.height}</b><b>${probe.avg_frame_rate.replace('/1', '')} fps</b><b>${probe.nb_frames} frames</b> ${name}.mp4 · frame-stepped capture · Doodle build 0.22.0-rc.1</p>
<div class="grid">${items.map((it, i) => `<div class="cell"><span class="tape"></span><img src="file://${it.file}"><div class="cap"><span class="no">${i + 1}</span>${it.label}<span class="t">f${it.n} · ${it.t}s</span></div></div>`).join('')}</div></div></body></html>`;
fs.writeFileSync(`${dir}/sheet.html`, html);
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--allow-file-access-from-files', '--force-color-profile=srgb'] });
const p = await b.newPage({ viewport: { width: cellW * 2 + 40 * 2 + 50, height: 800 }, deviceScaleFactor: 1 });
await p.goto(`file://${dir}/sheet.html`); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(600);
const ok = await p.evaluate(() => ['DDisplay', 'DMarker', 'DDigits', 'DLogo'].map(f => `${f}:${document.fonts.check(`20px ${f}`, '同一刻')}`).join(' '));
const out = `/tmp/space-video-doodle/capture-test/${name}.contact.png`;
await p.locator('.page').screenshot({ path: out });
await b.close();
console.log(out, ok);
