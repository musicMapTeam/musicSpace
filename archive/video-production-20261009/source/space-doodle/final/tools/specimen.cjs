// Render the Doodle families from the dev server's fonts.css: glyph fixes and borrowed marks.
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:5190/fonts/doodle/LICENSES.txt');
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="http://127.0.0.1:5190/fonts/doodle/fonts.css">
  <style>body{background:#f7efdf;margin:20px;font-size:44px;color:#1c1b1a}.d{font-family:"Doodle Display","Doodle Marker",sans-serif}.m{font-family:"Doodle Marker",sans-serif;font-size:34px}.h{font-family:"Doodle Hand","Doodle Marker",sans-serif;font-size:30px}.n{font-family:"Doodle Note","Doodle Hand";font-size:40px;color:#ff5c8a}div{margin:6px 0}</style></head><body>
  <div class="d">进入示例现场 · 进到同一个现场</div><div class="d">交换一个视角 · 关于这个示例 · 3 个视角 · 招个手</div><div class="d">人海 · 示例照片　入几人个</div>
  <div class="m">音乐探索 ↗ 我的小人 ↗ ♡ 1 ✓ 已同意 ♫ ✦ ✧ ☾ ↩ ↔ ▾ ▴ → ← ♪</div><div class="h">正文 ↗ ✓ ♡ · 同一晚，你拍了舞台</div><div class="n">就是这一刻！</div></body></html>`);
  await page.evaluate(() => document.fonts.ready); await new Promise(r => setTimeout(r, 1500)); await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: '/tmp/space-doodle/final/fonts-work/specimen.png' });
  console.log(await page.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').length));
  await browser.close();
})();
