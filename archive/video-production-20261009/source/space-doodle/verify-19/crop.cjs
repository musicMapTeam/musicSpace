const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const [, , src, dst, x, y, w, h] = process.argv;
(async () => { const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  const data = require('fs').readFileSync(src).toString('base64');
  await p.setContent(`<body style="margin:0;overflow:hidden"><img src="data:image/png;base64,${data}" style="position:absolute;left:-${x}px;top:-${y}px"></body>`);
  await p.waitForTimeout(200); await p.screenshot({ path: dst }); await b.close(); })();
