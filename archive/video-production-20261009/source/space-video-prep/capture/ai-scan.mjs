import { chromium } from '/tmp/space-video-prep/tools/node_modules/playwright-core/index.mjs';
import fs from 'node:fs';
setTimeout(() => { console.error('TIMEOUT'); process.exit(3); }, 280000).unref?.();
const which = process.argv[2] || 'stage';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await (await browser.newContext()).newPage();
await page.goto('http://127.0.0.1:8931/pretest-ai.html');
const t0 = Date.now();
const res = await page.evaluate(w => window.scanCrops(`/pretest-${w}.png`), which);
console.log(which, res.length, 'crops in', ((Date.now() - t0) / 1000).toFixed(0), 's');
const want = which === 'stage' ? 'stage' : 'crowd';
const sure = res.filter(r => r.sure && r.label === want).sort((a, b) => b.margin - a.margin);
console.log('sure', want, ':', sure.length);
for (const r of sure.slice(0, 15)) console.log(JSON.stringify(r));
const byLabel = {}; for (const r of res) { const k = (r.sure ? 'SURE ' : 'unsure ') + r.label; byLabel[k] = (byLabel[k] || 0) + 1; }
console.log(byLabel);
fs.writeFileSync(`/tmp/space-video-prep/photos/scan-${which}.json`, JSON.stringify(res));
await browser.close();
