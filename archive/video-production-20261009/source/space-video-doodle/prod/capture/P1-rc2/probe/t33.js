const out = {};
await page.click('nav.camera-nav [data-view="overview"]'); await sleep(2500);
await page.click('#scene-details'); await sleep(1200);
await page.click('#panel [data-open="conversation"]'); await sleep(2000);
await shot('54-chatroom-again');
out.room = await page.evaluate(() => { const c = [...document.querySelectorAll('.community-panel')].find(e => e.getClientRects().length); return c ? c.className + ' || ' + c.innerText.replace(/\n{2,}/g, '\n').slice(0, 1500) : null; });
out.menu = await page.evaluate(() => { const c = [...document.querySelectorAll('.community-panel')].find(e => e.getClientRects().length); return [...c.querySelectorAll('details, summary, button')].map(b => { const r = b.getBoundingClientRect(); return b.tagName + ' ' + (b.innerText || '').replace(/\s+/g, ' ').slice(0, 40) + ' ' + JSON.stringify(b.dataset) + ' vis=' + !!b.getClientRects().length + ' @' + Math.round(r.x) + ',' + Math.round(r.y); }); });
return out;
