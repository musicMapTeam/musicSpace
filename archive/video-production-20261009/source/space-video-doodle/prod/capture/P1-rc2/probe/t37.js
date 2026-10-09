const out = {};
out.spaceBtns = await page.evaluate(() => { const sp = [...document.querySelectorAll('.space-management')].find(e => e.getClientRects().length); return sp ? [...sp.querySelectorAll('button, summary, a')].map(b => b.tagName + ' ' + (b.innerText || '').replace(/\s+/g, ' ').slice(0, 30) + ' ' + JSON.stringify(b.dataset) + ' vis=' + !!b.getClientRects().length) : null; });
out.allComm = await page.evaluate(() => [...document.querySelectorAll('.community-panel')].map(c => c.className + ' vis=' + !!c.getClientRects().length));
return out;
