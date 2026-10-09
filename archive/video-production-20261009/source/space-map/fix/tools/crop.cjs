// node crop.cjs in.png out.png x y w h [scale]: crops (pixel coords of the source image) and scales via Chrome.
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const [inp, out, x, y, w, h, scale = '1'] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const s = Number(scale);
  const page = await browser.newPage({ viewport: { width: Math.round(w * s), height: Math.round(h * s) } });
  await page.setContent(`<style>body{margin:0;overflow:hidden}div{width:${w * s}px;height:${h * s}px;overflow:hidden;position:relative}img{position:absolute;left:${-x * s}px;top:${-y * s}px;transform-origin:0 0;transform:scale(${s})}</style><div><img src="data:image/png;base64,${fs.readFileSync(inp).toString('base64')}"></div>`);
  await page.waitForTimeout(200);
  await page.screenshot({ path: out });
  await browser.close();
})();
