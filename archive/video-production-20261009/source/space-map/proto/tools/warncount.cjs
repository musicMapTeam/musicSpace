const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--enable-gpu'] });
  for (const url of ['http://127.0.0.1:5291/music-map/', 'http://127.0.0.1:5292/music-map/', 'https://musicmapteam.github.io/musicSpace/music-map/']) {
    const page = await browser.newPage(); let n = 0; const other = [];
    page.on('console', m => { if (m.text().includes('flatShading')) n++; else if (m.type() === 'warning' || m.type() === 'error') other.push(m.text().slice(0, 100)); });
    await page.goto(url + '#/explore', { waitUntil: 'load' }).catch(e => other.push(String(e).slice(0, 80)));
    await new Promise(r => setTimeout(r, 6000));
    console.log(url, 'flatShading warnings:', n, '| other:', other.length ? other.join(' || ') : 'none');
    await page.close();
  }
  await browser.close();
})();
