// Measures the real rendered width of every narration line (raw TTF of its font role, its size, key words scaled 1.4/1.25/1.2)
// and writes out/widths.json  { "T042#0": 812.5, ... }.  build.py prefers these numbers over its estimate.   usage: node measure_widths.cjs
const fs = require('fs');
const path = require('path');
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const tl = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'out', 'timeline.json'), 'utf8'));
const FILES = { D: 'display', M: 'marker', H: 'hand', N: 'note', L: 'logo', G: 'digits' };
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    const page = await browser.newPage();
    const faces = Object.entries(FILES).map(([k, f]) => `@font-face{font-family:"Raw${k}";src:url("file:///tmp/music-space-font-cache/${f}.ttf")}`).join('\n');
    await page.setContent(`<html><head><style>${faces} body{margin:0} span{white-space:pre;position:absolute;left:0;top:0}</style></head><body></body></html>`);
    const items = [];
    for (const t of tl.text) {
      if (t.kind !== 'title') continue;
      t.text_marked.split('\n').forEach((line, i) => items.push({ key: `${t.id}#${i}`, line, font: t.font, size: t.size_px }));
    }
    const out = await page.evaluate(async items => {
      const scale = k => { const n = [...k].filter(c => c.trim()).length; return n <= 2 ? 1.4 : n === 3 ? 1.25 : 1.2; };
      const res = {};
      for (const it of items) {
        const span = document.createElement('span');
        span.style.fontFamily = `Raw${it.font}`;
        span.style.fontSize = it.size + 'px';
        for (const part of it.line.split(/(⟦.+?⟧)/)) {
          if (!part) continue;
          const s = document.createElement('span');
          s.style.position = 'static';
          if (part.startsWith('⟦')) { s.textContent = part.slice(1, -1); s.style.fontSize = scale(part.slice(1, -1)) + 'em'; }
          else s.textContent = part;
          span.append(s);
        }
        document.body.append(span);
        await document.fonts.ready;
        res[it.key] = Math.round(span.getBoundingClientRect().width);
        span.remove();
      }
      return res;
    }, items);
    fs.writeFileSync(path.join(__dirname, '..', 'out', 'widths.json'), JSON.stringify(out, null, 1));
    console.log('measured', Object.keys(out).length, 'lines');
  } finally {
    await browser.close();
  }
})();
