// Mean absolute pixel difference (0-255) and share of pixels differing by > 24, for pairs: node imgdiff.cjs a.png b.png [a2 b2 ...]
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await browser.newPage();
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 2) {
    const [a, b] = [args[i], args[i + 1]].map(f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64'));
    const r = await page.evaluate(async ([a, b]) => {
      const load = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.src = src; });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      if (ia.width !== ib.width || ia.height !== ib.height) return { size: [ia.width, ia.height, ib.width, ib.height] };
      const c = document.createElement('canvas'); c.width = ia.width; c.height = ia.height; const x = c.getContext('2d');
      x.drawImage(ia, 0, 0); const da = x.getImageData(0, 0, c.width, c.height).data;
      x.clearRect(0, 0, c.width, c.height); x.drawImage(ib, 0, 0); const db = x.getImageData(0, 0, c.width, c.height).data;
      let sum = 0, big = 0; for (let k = 0; k < da.length; k += 4) { const d = (Math.abs(da[k] - db[k]) + Math.abs(da[k + 1] - db[k + 1]) + Math.abs(da[k + 2] - db[k + 2])) / 3; sum += d; if (d > 24) big++; }
      const n = da.length / 4; return { mean: +(sum / n).toFixed(2), bigShare: +(big / n * 100).toFixed(2) + '%' };
    }, [a, b]);
    console.log(args[i].split('/').slice(-2).join('/'), 'vs', args[i + 1].split('/').slice(-2).join('/'), JSON.stringify(r));
  }
  await browser.close();
})();
