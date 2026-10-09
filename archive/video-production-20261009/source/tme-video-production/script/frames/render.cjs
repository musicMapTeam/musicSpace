// Renders the style frames (HTML -> 1920x1080 PNG) with system Chrome.   usage: node render.cjs [f1-title f2-ai ...]
const fs = require('fs');
const path = require('path');
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const DIR = __dirname;
const names = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(DIR).filter(f => /^(f\d|cover).*\.html$/.test(f)).map(f => f.replace(/\.html$/, ''));
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--allow-file-access-from-files'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    page.on('console', m => { if (m.type() === 'error') console.log('[console]', m.text().slice(0, 200)); });
    for (const n of names) {
      await page.goto('file://' + path.join(DIR, n + '.html'));
      await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
      await page.waitForTimeout(300);
      const missing = await page.evaluate(() => [...document.fonts].filter(f => f.status !== 'loaded').map(f => f.family + ':' + f.status));
      fs.mkdirSync(path.join(DIR, 'out'), { recursive: true });
      await page.screenshot({ path: path.join(DIR, 'out', n + '.png') });
      console.log('rendered', n, missing.length ? 'fonts not loaded: ' + missing.join(', ') : '');
    }
  } finally {
    await browser.close();
  }
})();
