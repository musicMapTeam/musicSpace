const out = {};
await page.click('[data-corner-close]'); await sleep(700);
out.panelOpen = await page.evaluate(() => !document.querySelector('#panel').hidden);
if (out.panelOpen) { await page.click('#panel-close'); await sleep(500); }
await page.click('nav.camera-nav [data-view="overview"]'); await sleep(2500);
await page.click('#scene-details'); await sleep(1200);
await page.click('#panel [data-open="recap"]'); await sleep(1800);
await shot('46-recap');
out.recap = await txt('#panel');
out.pinfo = await page.evaluate(() => { const p = document.querySelector('#panel'); return { sh: p.scrollHeight, ch: p.clientHeight, st: p.scrollTop }; });
out.mc = await page.evaluate(() => { const b = document.querySelector('#panel [data-open="memory-card"]'); if (!b) return null; const p = document.querySelector('#panel'); const r = b.getBoundingClientRect(); return b.innerText + ' contentY=' + Math.round(r.top - p.getBoundingClientRect().top + p.scrollTop) + ' screenY=' + Math.round(r.top); });
return out;
