// node sheet.cjs out.png cols width img1 img2 ... : a labelled contact sheet rendered by Chrome.
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs'); const path = require('path');
const [out, cols, width, ...imgs] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await browser.newPage({ viewport: { width: Number(cols) * (Number(width) + 12) + 12, height: 400 } });
  const cells = imgs.map(f => `<figure><img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}"><figcaption>${path.basename(path.dirname(f))}/${path.basename(f)}</figcaption></figure>`).join('');
  await page.setContent(`<style>body{margin:0;padding:6px;background:#ddd;font:12px sans-serif;display:grid;grid-template-columns:repeat(${cols},${width}px);gap:12px}figure{margin:0}img{width:${width}px;display:block;border:1px solid #888}figcaption{padding:2px 0}</style>${cells}`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: out, fullPage: true });
  await browser.close();
})();
