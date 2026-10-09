const out = {};
await page.evaluate(() => document.querySelector('#panel').scrollTo({ top: 1e5, behavior: 'instant' })); await sleep(300);
const dl = page.waitForEvent('download', { timeout: 30000 }).catch(e => null);
for (const n of ['memory-photo', 'memory-avatar', 'memory-confirm']) { await page.locator(`#panel input[name="${n}"]`).check(); await sleep(250); }
await shot('49-memory-ticked');
await page.locator('#panel button', { hasText: '下载纪念卡 PNG' }).click();
const t0 = Date.now();
let t = ''; for (let i = 0; i < 100; i++) { t = await txt('#panel'); if (/已开始下载|已发起下载/.test(t)) break; await sleep(100); }
out.ms = Date.now() - t0; out.after = t;
const d = await dl; out.download = d ? d.suggestedFilename() : null;
if (d) await d.saveAs('/tmp/space-video-doodle/prod/capture/P1-rc2/probe/memory-card-probe.png');
await sleep(800);
out.pinfo = await page.evaluate(() => { const p = document.querySelector('#panel'); return { sh: p.scrollHeight, ch: p.clientHeight, st: p.scrollTop }; });
await page.evaluate(() => document.querySelector('#panel').scrollTo({ top: 1e5, behavior: 'instant' })); await sleep(500);
await shot('50-memory-preview');
return out;
