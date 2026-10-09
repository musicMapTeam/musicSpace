// BEFORE | AFTER pairs by state label: node pairs.cjs <beforeDir> <afterDir> <view> <out.png> [labels,comma]
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs'); const path = require('path');
const [beforeDir, afterDir, view, out, only] = process.argv.slice(2);
const labelOf = f => f.replace(/^[a-z0-9]+-\d+-/, '').replace(/\.png$/, '');
const pick = dir => Object.fromEntries(fs.readdirSync(dir).filter(f => f.startsWith(view + '-') && f.endsWith('.png')).map(f => [labelOf(f), path.resolve(dir, f)]));
const before = pick(beforeDir); const after = pick(afterDir);
const labels = (only ? only.split(',') : Object.keys(after)).filter(l => after[l]);
(async () => {
  const w = view === 'desktop' ? 420 : 200; const cols = view === 'desktop' ? 2 : 4;
  const cells = labels.map(l => `<figure><figcaption>${l}</figcaption><div class="pair">${before[l] ? `<img src="file://${before[l]}">` : '<div class="none">（0.16 没有这个状态）</div>'}<img src="file://${after[l]}"></div></figure>`).join('');
  const html = `<html><body style="margin:10px;background:#f3eee2;font:12px system-ui"><h3 style="margin:0 0 6px">${view}: BEFORE (left) | AFTER (right)</h3><div style="display:grid;grid-template-columns:repeat(${cols},${w * 2 + 14}px);gap:12px">${cells}</div><style>figure{margin:0}.pair{display:grid;grid-template-columns:${w}px ${w}px;gap:6px}img{width:100%;border:1px solid #999;display:block}.none{border:1px dashed #999;height:100%;display:grid;place-items:center;color:#777}figcaption{color:#333;margin-bottom:2px}</style></body></html>`;
  const tmp = `/tmp/space-map/ui/tools/.pairs-${process.pid}.html`; fs.writeFileSync(tmp, html);
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: cols * (w * 2 + 26) + 30, height: 600 } });
  await page.goto('file://' + tmp); await page.waitForFunction(() => [...document.images].every(i => i.complete));
  await page.screenshot({ path: out, fullPage: true }); fs.unlinkSync(tmp); await browser.close();
})();
