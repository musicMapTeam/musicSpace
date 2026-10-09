// Contact sheet via Chrome: node contact.cjs <out.png> <title> <cols> <tileWidth> <label>=<path> ...
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs'); const path = require('path');
const [out, title, cols, w, ...items] = process.argv.slice(2);
const tiles = items.map(item => { const i = item.lastIndexOf('='); return [item.slice(0, i), item.slice(i + 1)]; });
const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const html = `<!doctype html><meta charset=utf-8><style>
@font-face{font-family:M;src:url("file:///Users/alakazan/workplace/tme/musicSpace/web/event-room/public/fonts/doodle/marker-0.woff2")}
body{margin:0;padding:18px;background:#f7efdf;color:#1c1b1a;font:16px M,system-ui,sans-serif}h1{font-size:26px;margin:0 0 14px}
.g{display:grid;grid-template-columns:repeat(${cols},${w}px);gap:16px}figure{margin:0}figcaption{font-size:15px;margin:0 0 4px}
img{width:${w}px;display:block;border:2px solid #1c1b1a}</style><h1>${esc(title)}</h1><div class=g>${tiles.map(([l, p]) => `<figure><figcaption>${esc(l)}</figcaption><img src="file://${path.resolve(p)}"></figure>`).join('')}</div>`;
const file = path.join('/tmp/space-map/3d', '.contact.html'); fs.writeFileSync(file, html);
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await browser.newPage({ viewport: { width: 36 + Number(cols) * (Number(w) + 16), height: 400 } });
  await page.goto('file://' + file); await page.waitForTimeout(400);
  await page.evaluate(() => Promise.all([...document.images].map(img => img.decode().catch(() => {}))));
  await page.screenshot({ path: out, fullPage: true }); await browser.close(); console.log(out);
})();
