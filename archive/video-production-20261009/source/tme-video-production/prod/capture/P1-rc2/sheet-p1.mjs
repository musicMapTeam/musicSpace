// TAKE-P1 rc2 contact sheet (Doodle style: paper + dots, ink outlines, hard shadows, tape, markers), rendered in Chrome with the
// doodle fonts. One row per sub-clip: id, feeds, duration, then key frames (first frame, the sync/action frames, last frame)
// with clip-relative frame/time captions.  A second sheet shows the CUT stills.
// usage: node sheet-p1.mjs   (reads manifest.json; writes P1-contact-sheet.png and P1-stills-sheet.png)
import { chromium } from '/tmp/space-video-prep/tools/node_modules/playwright-core/index.mjs';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const DIR = '/tmp/space-video-doodle/prod/capture/P1-rc2';
const TH = `${DIR}/sheet/thumbs`; fs.mkdirSync(TH, { recursive: true });
const man = JSON.parse(fs.readFileSync(`${DIR}/manifest.json`, 'utf8'));
const FFM = '/opt/homebrew/bin/ffmpeg';
const pick = (id, c) => {   // in + up to 6 key frames (sync points, taps, scroll ends; filled evenly if sparse) + out
  const pool = [
    ...Object.entries(c.sync || {}).map(([k, v]) => ({ f: v.frame, l: k.replace(/_/g, ' '), p: 2 })),
    ...(c.actions || []).filter(a => a.kind === 'tap').map(a => ({ f: Math.min(c.frames - 2, a.click_frame + 4), l: a.label.replace(/^tap /, ''), p: 1 })),
    ...(c.actions || []).filter(a => a.kind === 'scroll').map(a => ({ f: Math.min(c.frames - 2, a.end_frame), l: a.label + ' (end)', p: 0 })),
  ].filter(x => x.f > 0 && x.f < c.frames - 1).sort((a, b) => b.p - a.p || a.f - b.f);
  const want = [];
  for (const x of pool) { if (want.length >= 6) break; if (!want.some(w => Math.abs(w.f - x.f) < 5)) want.push(x); }
  for (let k = 1; want.length < 6 && k < 12; k++) { const f = Math.round(c.frames * k / 12); if (!want.some(w => Math.abs(w.f - f) < 20)) want.push({ f, l: '' }); }
  return [{ f: 0, l: 'in' }, ...want.sort((a, b) => a.f - b.f), { f: c.frames - 1, l: 'out' }];
};
const rows = [];
for (const [id, c] of Object.entries(man.clips)) {
  if (!c.file || !fs.existsSync(c.file)) continue;
  const fr = pick(id, c);
  const sel = fr.map(x => `eq(n\\,${x.f})`).join('+');
  const pat = `${TH}/${id}-%02d.jpg`;
  for (const f of fs.readdirSync(TH).filter(f => f.startsWith(id + '-'))) fs.unlinkSync(`${TH}/${f}`);
  execFileSync(FFM, ['-v', 'error', '-y', '-i', c.file, '-vf', `select='${sel}',scale=178:-1:flags=lanczos`, '-fps_mode', 'passthrough', '-q:v', '3', pat]);
  rows.push({ id, c, fr: fr.map((x, i) => ({ ...x, img: `${TH}/${id}-${String(i + 1).padStart(2, '0')}.jpg` })) });
}
const F = n => `file:///tmp/music-space-font-cache/${n}.ttf`;
const css = `
@font-face{font-family:DDisplay;src:url(${F('display')})}@font-face{font-family:DMarker;src:url(${F('marker')})}@font-face{font-family:DHand;src:url(${F('hand')})}
@font-face{font-family:DLogo;src:url(${F('logo')})}@font-face{font-family:DDigits;src:url(${F('digits')})}
*{box-sizing:border-box}body{margin:0;background:#f7efdf radial-gradient(circle,#1c1b1a2b 1.3px,transparent 1.7px) 0 0/26px 26px;color:#1c1b1a;font-family:DHand,sans-serif}
.page{padding:36px 44px 50px;width:1900px}
.logo{font-family:DLogo;font-size:34px;color:#ffd447;-webkit-text-stroke:2px #1c1b1a;paint-order:stroke;text-shadow:3px 3px 0 #ff5c8a;letter-spacing:1px}
h1{font-family:DDisplay;font-weight:400;font-size:56px;margin:6px 0 4px;line-height:1.1;text-shadow:4px 4px 0 #ff5c8a}
.meta{font-family:DMarker;font-size:18px;margin:8px 0 28px;line-height:1.7}.meta b{display:inline-block;background:#5fdcc0;border:2px solid #1c1b1a;border-radius:999px;padding:0 12px;margin:0 6px 4px 0;font-weight:400}
.meta b.y{background:#ffd447}.meta b.p{background:#ffd0dd}
.row{display:flex;gap:14px;align-items:flex-start;margin:0 0 30px;padding:16px 18px 18px;background:#fffaf0;border:3px solid #1c1b1a;border-radius:10px 14px 9px 12px;box-shadow:7px 7px 0 #1c1b1a;position:relative}
.row:nth-child(odd){transform:rotate(-.25deg)}.row:nth-child(even){transform:rotate(.2deg)}
.tape{position:absolute;top:-13px;left:120px;width:120px;height:24px;background:#ffd447cc;border:1.5px dashed #1c1b1a55;transform:rotate(-3deg)}
.row:nth-child(3n+2) .tape{background:#ff5c8aaa;transform:rotate(3deg)}.row:nth-child(3n) .tape{background:#5fdcc0bb}
.lab{width:270px;flex:none}
.lab .id{font-family:DDigits;font-size:44px;line-height:1;text-shadow:3px 3px 0 #ffd447}
.lab .feeds{font-family:DMarker;font-size:17px;margin:8px 0 6px}.lab .feeds span{display:inline-block;background:#ffd0dd;border:2px solid #1c1b1a;border-radius:999px;padding:0 9px;margin:0 4px 4px 0}
.lab .dur{font-family:DDigits;font-size:20px}.lab .what{font-size:15px;line-height:1.45;margin-top:6px;color:#1c1b1ae0}
.lab .qc{font-family:DMarker;font-size:14px;margin-top:8px;color:#1f7f6a}
.th{width:178px;flex:none}.th img{display:block;width:178px;border:2.5px solid #1c1b1a;border-radius:6px}
.th .c{font-family:DMarker;font-size:14px;line-height:1.3;margin-top:5px;height:56px;overflow:hidden}.th .c i{font-style:normal;font-family:DDigits;background:#ffd447;border:1.5px solid #1c1b1a;border-radius:6px;padding:0 5px;margin-right:4px}
.st{display:inline-block;vertical-align:top;margin:0 26px 30px 0;padding:12px 12px 10px;background:#fffdf6;border:3px solid #1c1b1a;box-shadow:6px 6px 0 #1c1b1a;border-radius:6px 9px 5px 8px}
.st img{display:block;border:2px solid #1c1b1a;max-height:520px;max-width:560px}.st .c{font-family:DMarker;font-size:16px;margin-top:8px}`;
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
const qcLine = c => { const q = c.qc || {}; const g = q.lossless_grabs || {}; return `${q.stream ? q.stream.size + ' · ' + q.stream.fps + ' · ' : ''}unique ${g.unique}/${g.frames} · motion dups ${(g.duplicates_inside_motion || []).length} · handles ${c.handles?.before_s ?? '–'}s / ${c.handles?.after_s ?? '–'}s`; };
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="page">
<div class="logo">MUSIC SPACE</div><h1>TAKE-P1 rc2 · 手机评审路线 · 0.22.0-rc.2</h1>
<p class="meta"><b>1080×2340</b><b>60 fps</b><b class="y">${man.clips ? Object.keys(man.clips).length : 0} sub-clips</b><b class="y">master ${man.master.seconds}s</b><b class="p">阿宁 · 失真</b><b class="p">${esc(man.world.clock.split(' ')[0])}</b><b>♩ ${man.beat_grid.bpm} BPM · ${man.beat_grid.frames_per_beat} f/beat</b><br>
build ${esc(man.build.version)} (${esc(man.build.commit)}) · dist-pages served at /musicSpace/ · frame-stepped capture (16 ms per frame → 0.96× product speed) · captions = clip-relative frame / seconds</p>
${rows.map(r => `<div class="row"><span class="tape"></span><div class="lab"><div class="id">${r.id}</div><div class="feeds">${(r.c.feeds || []).map(f => `<span>${esc(f)}</span>`).join('')}</div>
<div class="dur">${r.c.seconds}s · ${r.c.frames} f · master ${r.c.master_in_s}–${r.c.master_out_s}s</div><div class="what">${esc(r.c.what)}</div><div class="qc">${esc(qcLine(r.c))}</div></div>
${r.fr.map(x => `<div class="th"><img src="file://${x.img}"><div class="c"><i>f${x.f} · ${(x.f / 60).toFixed(2)}s</i>${esc(x.l)}</div></div>`).join('')}</div>`).join('')}
</div></body></html>`;
fs.writeFileSync(`${DIR}/sheet/contact.html`, html);
const st = Object.entries(man.stills).flatMap(([k, files]) => files.map(f => ({ k, f })));
const html2 = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="page">
<div class="logo">MUSIC SPACE</div><h1>TAKE-P1 rc2 · CUT stills (phone DPR 2.77)</h1><p class="meta"><b>element stills = CDP region grabs at device scale</b><b class="y">full = 1080×2340</b><b class="p">CUT-08 = the real downloaded PNG</b></p>
${st.map(x => `<div class="st"><img src="file://${x.f}"><div class="c">${esc(x.k)} · ${esc(x.f.split('/').pop())}</div></div>`).join('')}</div></body></html>`;
fs.writeFileSync(`${DIR}/sheet/stills.html`, html2);
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--allow-file-access-from-files', '--force-color-profile=srgb'] });
for (const [src, out] of [['contact.html', 'P1-rc2-contact-sheet.png'], ['stills.html', 'P1-rc2-stills-sheet.png']]) {
  const p = await b.newPage({ viewport: { width: 1990, height: 1000 }, deviceScaleFactor: 1 });
  await p.goto(`file://${DIR}/sheet/${src}`); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500);
  await p.locator('.page').screenshot({ path: `${DIR}/${out}` });
  console.log(`${DIR}/${out}`);
  await p.close();
}
await b.close();
