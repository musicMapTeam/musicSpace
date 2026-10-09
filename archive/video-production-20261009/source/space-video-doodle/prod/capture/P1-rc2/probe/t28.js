const out = {};
const cp = () => page.evaluate(() => { const c = [...document.querySelectorAll('.corner-panel')].find(e => e.getClientRects().length); return c ? c.innerText.replace(/\n{2,}/g, '\n').slice(0, 2000) : null; });
await page.locator('.corner-panel input[name=participation]').check(); await sleep(300);
await page.locator('.corner-panel button', { hasText: '发出邀请' }).first().click();
const t0 = Date.now();
let txt2 = ''; for (let i = 0; i < 60; i++) { txt2 = await cp(); if (/等 TA 加入/.test(txt2 || '')) break; await sleep(100); }
out.ms = Date.now() - t0;
out.after = txt2;
await sleep(800);
await shot('45-corner-invited');
return out;
