const {page}=await get('phone');
const out={};
await page.locator('[data-space="close"]').click().catch(()=>{}); await sleep(800);
await page.locator('#my-look').click(); await sleep(2000);
const sum=page.locator('.wardrobe summary',{hasText:'试试组合示例'}).first();
await sum.scrollIntoViewIfNeeded(); await sum.click(); await sleep(500);
for (const p of [0,4,2]) { const b=page.locator(`[data-preset="${p}"]`); await b.scrollIntoViewIfNeeded(); await b.click(); await sleep(700); out['p'+p]=await shot(page,`p40-wardrobe-preset${p}`); }
out.labels=await page.evaluate(()=>[...document.querySelectorAll('[data-preset]')].map(b=>b.dataset.preset+':'+b.textContent.trim()));
await page.locator('[data-wardrobe-close]').first().click().catch(()=>{}); await sleep(800);
return out;
