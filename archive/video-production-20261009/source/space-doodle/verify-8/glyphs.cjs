const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1100 }, deviceScaleFactor: 1 });
  const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/fonts/doodle/fonts.css">
  <style>body{background:#fbf6ea;margin:20px;font-family:"PingFang SC",sans-serif;color:#222}
  .row{display:flex;gap:28px;align-items:flex-end;margin-bottom:6px}
  .cell{text-align:center} .g{font-size:150px;line-height:1}
  .D{font-family:"Doodle Display"} .M{font-family:"Doodle Marker"} .S{font-family:"PingFang SC"}
  .lab{font-size:15px;color:#666}
  .ov{position:relative;width:160px;height:160px}
  .ov span{position:absolute;left:0;top:0;font-family:"Doodle Display";font-size:150px;line-height:1;mix-blend-mode:multiply}
  h3{margin:14px 0 4px;font-size:16px}
  .h{font-family:"Doodle Display";font-size:44px;margin:4px 0}
  </style></head><body>
  <h3>Doodle Display (shipped display-0/1 woff2)</h3>
  <div class="row">${[...'入几人个八儿丫卜'].map(c=>`<div class="cell"><div class="g D">${c}</div><div class="lab">${c} U+${c.codePointAt(0).toString(16).toUpperCase()}</div></div>`).join('')}</div>
  <h3>Overlay: 入 (pink) over 几 (mint) — Display</h3>
  <div class="row"><div class="ov"><span style="color:#3ad1a8">几</span><span style="color:#ff5c8a">入</span></div>
  <div class="ov"><span style="color:#3ad1a8">人</span><span style="color:#ff5c8a">个</span></div></div>
  <h3>Same chars in Doodle Marker (next family in --ds-font-display)</h3>
  <div class="row">${[...'入几人个'].map(c=>`<div class="cell"><div class="g M" style="font-size:110px">${c}</div></div>`).join('')}</div>
  <h3>Headings in Doodle Display, 44px</h3>
  ${['带上小人，进入示例现场','进到同一个现场','另一个视角','交换一个视角','关于这个示例','3 个视角','招个手','进入现场 / 入场 / 加入'].map(t=>`<div class="h">${t}</div>`).join('')}
  </body></html>`;
  await page.route('http://127.0.0.1:5190/__verify8.html', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
  await page.goto('http://127.0.0.1:5190/__verify8.html');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  const status = await page.evaluate(() => ({
    d: document.fonts.check('150px "Doodle Display"', '入几个'),
    loaded: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family).slice(0, 20)
  }));
  console.log(JSON.stringify(status));
  await page.screenshot({ path: '/tmp/space-doodle/verify-8/glyphs.png', fullPage: true });
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
