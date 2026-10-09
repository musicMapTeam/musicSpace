const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const p = await b.newPage({ viewport: { width: 520, height: 200 } });
  const imgs = ['a', 'b'].map(n => 'data:image/svg+xml;base64,' + Buffer.from(fs.readFileSync(`${n}.svg`)).toString('base64'));
  await p.setContent(`<body style="margin:0;background:#dfe3e8;font:12px sans-serif">${imgs.map((u, i) => `<div style="display:flex;gap:16px;align-items:end;padding:10px"><b>${'ab'[i]}</b><img src="${u}" width=16 height=16><img src="${u}" width=32 height=32><img src="${u}" width=64 height=64><span style="background:#fff;padding:6px 10px;border-radius:8px 8px 0 0;display:flex;gap:6px;align-items:center"><img src="${u}" width=16 height=16>Music Space · 这一场</span></div>`).join('')}</body>`);
  await p.screenshot({ path: 'fav.png' });
  await b.close();
})();
