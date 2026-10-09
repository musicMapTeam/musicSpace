const out = {};
await page.locator('.community-panel input[name=consent]').first().check(); await sleep(300);
out.form = await page.evaluate(() => { const i = [...document.querySelectorAll('.community-panel input[name=consent]')].find(e => e.getClientRects().length); const f = i.closest('form'); return f ? f.outerHTML.slice(0, 300) : null; });
await page.locator('.community-panel button', { hasText: '加入，继续聊' }).first().click(); await sleep(2500);
await shot('57-venue-community');
out.room = await page.evaluate(() => [...document.querySelectorAll('.community-panel')].filter(e => e.getClientRects().length).map(c => c.className + ' || ' + c.innerText.replace(/\n{2,}/g, '\n').slice(0, 1500)));
out.chips = await page.evaluate(() => { const e = [...document.querySelectorAll('.conversation-actions')].find(x => x.getClientRects().length); return e ? { sw: e.scrollWidth, cw: e.clientWidth, chips: [...e.children].map(c => c.innerText.replace(/\s+/g, ' ') + ' ' + JSON.stringify(c.dataset)) } : null; });
return out;
