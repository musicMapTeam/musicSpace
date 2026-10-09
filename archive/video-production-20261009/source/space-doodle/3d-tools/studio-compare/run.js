const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  for (const dpr of [1, 2]) {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: dpr });
    const logs = []; page.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.text().slice(0, 200)); }); page.on('pageerror', e => logs.push('pageerror ' + e.message));
    await page.goto('http://127.0.0.1:5297/');
    const result = await page.evaluate(() => window.__compare);
    console.log('dpr', dpr, JSON.stringify(result), logs.slice(0, 5));
    if (dpr === 1) {
      const imgs = await page.evaluate(() => ({ o: window.__images.oldOut['sakura-duo'], n: window.__images.newOut['sakura-duo'], p: window.__images.newOut.portraitFull }));
      for (const [k, v] of Object.entries(imgs)) fs.writeFileSync(`/tmp/space-doodle/3d-tools/studio-compare/${k}.png`, Buffer.from(v.split(',')[1], 'base64'));
    }
    await page.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
