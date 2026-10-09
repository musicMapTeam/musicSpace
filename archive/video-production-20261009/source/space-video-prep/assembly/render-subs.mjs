// Render Chinese subtitles / lower-thirds as transparent 1920x1080 PNGs with Chrome (PingFang SC) - because the Homebrew ffmpeg here has no libass/freetype.
// usage: node render-subs.mjs timeline.json [outDir=subs] [scale=1]
import { chromium } from '/tmp/space-video-prep/tools/node_modules/playwright-core/index.mjs';
import fs from 'node:fs';
import path from 'node:path';

const [tlFile, outDir = 'subs', scaleArg = '1'] = process.argv.slice(2);
const tl = JSON.parse(fs.readFileSync(tlFile, 'utf8'));
const W = 1920, H = 1080;
fs.mkdirSync(outDir, { recursive: true });

const ACC = tl.theme?.accent || '#dbe873';
const CSS = (`
html,body{margin:0;width:${W}px;height:${H}px;background:transparent;overflow:hidden;font-family:'PingFang SC','Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{position:absolute;left:96px;bottom:84px;max-width:1500px;display:flex;align-items:stretch;gap:0;filter:drop-shadow(0 6px 18px rgba(0,0,0,.38))}
.wrap.center{left:0;right:0;justify-content:center;max-width:none}
.wrap.right{left:auto;right:96px}
.wrap.top{bottom:auto;top:84px}
.glass{background:rgba(25,27,32,.93);color:#f4f2e8;border-left:6px solid #dbe873;padding:.42em .85em .46em .8em;font-size:42px;line-height:1.38;letter-spacing:.04em;font-weight:500}
.glass b{color:#dbe873;font-weight:600}
.paper{background:rgba(240,233,216,.97);color:#17191d;border-left:6px solid #203b32;padding:.42em .85em .46em .8em;font-size:42px;line-height:1.38;letter-spacing:.04em;font-weight:500}
.paper b{background:linear-gradient(transparent 58%,#dbe873 58%);font-weight:600}
.chip{display:flex;align-items:center;background:#dbe873;color:#17191d;font-family:ui-monospace,'SF Mono',Menlo,monospace;font-weight:700;font-size:23px;letter-spacing:.14em;padding:0 .9em;text-transform:uppercase}
.note{font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:21px;letter-spacing:.08em;color:rgba(244,242,232,.88);background:rgba(25,27,32,.72);padding:.5em .9em;border-radius:3px}
.shot{position:absolute;left:30px;top:26px;font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:22px;letter-spacing:.12em;color:#17191d;background:#dbe873;padding:.35em .8em;box-shadow:0 4px 10px rgba(0,0,0,.35)}
/* caption band: the bottom 88 px of the 1080p canvas (below the 992 px footage); never covers the UI */
.bandwrap{position:absolute;left:0;right:0;bottom:0;height:88px;display:flex;align-items:center;padding:0 96px;gap:22px}
.bandwrap .chip{height:46px;font-size:22px;border-radius:3px}
.band{color:#f4f2e8;font-size:40px;line-height:1.25;letter-spacing:.05em;font-weight:500;white-space:nowrap}
.band b{color:#dbe873;font-weight:600}
.bandnote{position:absolute;right:48px;bottom:9px;font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:20px;letter-spacing:.08em;color:rgba(244,242,232,.78)}
`).replaceAll('#dbe873', ACC);
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
// **word** => <b>word</b>
const rich = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: Number(scaleArg), locale: 'zh-CN' });
const page = await ctx.newPage();
let n = 0;
const out = [];
for (const [i, s] of (tl.subtitles || []).entries()) {
  const style = s.style || 'glass';
  const pos = s.pos || '';
  let inner;
  if (style === 'shot') inner = `<div class="shot">${esc(s.text)}</div>`;
  else if (style === 'band') inner = `<div class="bandwrap">${s.chip ? `<div class="chip">${esc(s.chip)}</div>` : ''}<div class="band">${rich(s.text)}</div></div>`;
  else if (style === 'bandnote') inner = `<div class="bandnote">${rich(s.text)}</div>`;
  else if (style === 'note') inner = `<div class="wrap ${pos}"><div class="note">${rich(s.text)}</div></div>`;
  else inner = `<div class="wrap ${pos}">${s.chip ? `<div class="chip">${esc(s.chip)}</div>` : ''}<div class="${style}">${rich(s.text)}</div></div>`;
  const label = '';
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>${CSS}</style><body>${inner}${tl.debugShotLabels ? label : ''}</body>`);
  await page.evaluate(() => document.fonts.ready);
  const f = path.join(outDir, `s${String(i).padStart(3, '0')}.png`);
  await page.screenshot({ path: f, omitBackground: true });
  out.push({ file: f, start: s.start, end: s.end, text: s.text });
  n++;
}
await browser.close();
fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(out, null, 1));
console.log('rendered', n, 'subtitle PNGs into', outDir);
