const out = {};
await page.locator('.community-panel summary', { hasText: '设置与管理' }).first().click(); await sleep(600);
out.menu = await page.evaluate(() => { const d = [...document.querySelectorAll('.community-panel details')].find(e => e.getClientRects().length); return d ? [...d.querySelectorAll('button')].map(b => b.innerText.replace(/\s+/g,' ') + ' ' + JSON.stringify(b.dataset)) : null; });
await shot('58-venue-settings');
const sp = await page.evaluate(() => !!document.querySelector('.community-panel [data-group-space]'));
out.hasSpace = sp;
if (sp) { await page.locator('.community-panel [data-group-space]').first().click(); await sleep(1800); await shot('59-next-show'); out.space = await page.evaluate(() => [...document.querySelectorAll('.community-panel, .space-management, [class*=space]')].filter(e => e.getClientRects().length).map(c => c.className + ' || ' + c.innerText.replace(/\n{2,}/g, '\n').slice(0, 1500))); }
return out;
