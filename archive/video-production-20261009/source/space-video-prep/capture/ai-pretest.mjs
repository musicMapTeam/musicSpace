// Run candidate demo photos through the app's real on-device viewpoint model (TinyCLIP via onnxruntime-web, same module as web/js/ai/space-ai.js)
setTimeout(() => { console.error('TIMEOUT 240s'); process.exit(3); }, 240000).unref?.();
// usage: node ai-pretest.mjs dir-or-files... [--base http://127.0.0.1:8931]
import { chromium } from '/tmp/space-video-prep/tools/node_modules/playwright-core/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const base = process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : 'http://127.0.0.1:8931';
const files = args.flatMap(a => fs.statSync(a).isDirectory() ? fs.readdirSync(a).filter(f => /\.(jpe?g|png|webp)$/i.test(f)).sort().map(f => path.join(a, f)) : [a]);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
page.on('pageerror', e => console.log('pageerror', String(e).slice(0, 200)));
await page.goto(base + '/pretest-ai.html');
console.log('supported:', await page.evaluate(() => window.__supported));
await page.locator('#f').setInputFiles(files);
const res = await page.evaluate(() => window.runAll());
for (const r of res) console.log(`${r.name.padEnd(22)} ${r.ok ? (r.sure ? 'SURE ' : 'unsure') : 'ERR  '} ${String(r.label).padEnd(8)} p=${(r.prob || 0).toFixed(2)} margin=${(r.margin || 0).toFixed(3)} top2=${(r.top2 || []).join('/')}  scores=${Object.entries(r.scores || {}).map(([k, v]) => k[0] + ':' + v.toFixed(3)).join(' ')}  ${r.ms}ms ${r.error || ''}`);
fs.writeFileSync('/tmp/space-video-prep/photos/pretest-results.json', JSON.stringify(res, null, 1));
await browser.close();
