const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const p = await b.newPage({ viewport: { width: 400, height: 400 } });
  await p.setContent(`<div id=s style="height:300px;overflow:auto;padding:30px 20px 24px;box-sizing:border-box;background:#eee"><div id=body><form><p style="height:400px;margin:0">x</p><div id=f style="position:sticky;bottom:0;background:red;height:40px"></div><p style="height:100px;margin:0">after</p></form></div></div>`);
  const r = await p.evaluate(() => { const s = document.querySelector('#s').getBoundingClientRect(), f = document.querySelector('#f').getBoundingClientRect(); return { scrollerBottom: s.bottom, stickyBottom: f.bottom }; });
  console.log(JSON.stringify(r));
  await b.close();
})();
