const {page}=await get('desktop');
const out={};
await page.locator('[data-view="overview"]').click(); await sleep(2000);
await page.locator('[data-kind="person"]',{hasText:'林间'}).first().click(); await sleep(2500);
out.lin=await shot(page,'d09-linjian-quiet');
out.t=(await L.visibleText(page,'#panel')).slice(0,600);
return out;
