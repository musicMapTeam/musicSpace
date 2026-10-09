const out = {};
await page.click('form[data-community-create] input[name=title]'); await page.keyboard.type('周五散场以后'); await sleep(200);
await page.locator('form[data-community-create] input[name=consent]').check(); await sleep(200);
await page.click('form[data-community-create] button[type=submit]');
const t0 = Date.now();
let ok = false; for (let i = 0; i < 100; i++) { ok = await page.evaluate(() => [...document.querySelectorAll('.music-community .entry-list button')].some(b => b.getClientRects().length && /周五散场以后/.test(b.innerText))); if (ok) break; await sleep(100); }
out.entryMs = ok ? Date.now() - t0 : 'timeout';
await sleep(500);
await shot('41-community-created');
out.panel = await page.evaluate(() => { const c = [...document.querySelectorAll('.community-panel')].find(e => e.getClientRects().length); return c ? c.innerText.replace(/\n{2,}/g, '\n').slice(0, 2000) : null; });
await page.locator('.music-community .entry-list button', { hasText: '周五散场以后' }).first().click(); await sleep(2000);
await shot('42-community-room');
out.room = await page.evaluate(() => { const c = [...document.querySelectorAll('.community-panel')].find(e => e.getClientRects().length); return c ? c.className + ' || ' + c.innerText.replace(/\n{2,}/g, '\n').slice(0, 2000) : null; });
out.chips = await page.evaluate(() => { const e = [...document.querySelectorAll('.conversation-actions')].find(x => x.getClientRects().length); return e ? { sw: e.scrollWidth, cw: e.clientWidth, chips: [...e.children].map(c => c.innerText.replace(/\s+/g, ' ')) } : null; });
return out;
