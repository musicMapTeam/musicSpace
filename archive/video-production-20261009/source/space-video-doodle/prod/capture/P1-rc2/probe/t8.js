const out = {};
await page.evaluate(() => document.querySelector('#panel').scrollTo({ top: 1e5, behavior: 'instant' })); await sleep(300);
await shot('12-upload-bottom');
await page.click('form[data-form="upload"] button[type=submit]');
const t0 = Date.now();
let toast = ''; for (let i = 0; i < 40; i++) { toast = await page.evaluate(() => document.querySelector('#toast')?.textContent || ''); if (toast) break; await sleep(50); }
out.toast = toast;
await page.waitForFunction(() => !!document.querySelector('[data-moment-badge="other-side"]'), null, { timeout: 30000 });
out.badgeMs = Date.now() - t0;
await sleep(1500);
await shot('13-wall');
out.panel = await txt('#panel');
out.pinfo = await page.evaluate(() => { const p = document.querySelector('#panel'); return { sh: p.scrollHeight, ch: p.clientHeight, st: p.scrollTop }; });
out.badge = await page.evaluate(() => { const e = document.querySelector('[data-moment-badge="other-side"]'); const r = e.getBoundingClientRect(); return e.innerText + ' @' + Math.round(r.x) + ',' + Math.round(r.y) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height); });
out.offer = await page.evaluate(() => { const e = document.querySelector('[data-exchange-offer]'); if (!e) return null; const r = e.getBoundingClientRect(); return e.innerText + ' @' + Math.round(r.x) + ',' + Math.round(r.y); });
return out;
