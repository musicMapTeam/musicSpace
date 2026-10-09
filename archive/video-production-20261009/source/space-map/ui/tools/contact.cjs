// Contact sheet: node contact.cjs <out.png> <cols> <width-per-tile> <title> <img1> [<img2> ...]  (label = file name)
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const path = require('path'); const fs = require('fs');
const [out, cols, tileW, title, ...imgs] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: Number(cols) * (Number(tileW) + 16) + 24, height: 600 } });
  const tiles = imgs.map(file => `<figure><img src="file://${path.resolve(file)}"><figcaption>${path.basename(file)}</figcaption></figure>`).join('');
  const html = `<html><body style="margin:12px;background:#f3eee2;font:13px system-ui"><h3 style="margin:0 0 8px">${title}</h3><div style="display:grid;grid-template-columns:repeat(${cols},${tileW}px);gap:10px 16px;align-items:start">${tiles}</div><style>figure{margin:0}img{width:100%;border:1px solid #999;display:block}figcaption{margin-top:2px;color:#444}</style></body></html>`;
  const tmp = `/tmp/space-map/ui/tools/.contact-${process.pid}.html`; fs.writeFileSync(tmp, html);
  await page.goto('file://' + tmp);
  await page.waitForFunction(() => [...document.images].every(i => i.complete));
  await page.screenshot({ path: out, fullPage: true });
  fs.unlinkSync(tmp);
  await browser.close();
})();
