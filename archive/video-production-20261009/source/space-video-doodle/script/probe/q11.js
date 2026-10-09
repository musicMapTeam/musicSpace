const {page}=await get('phone');
const out={};
await page.locator('[data-exchange-offer]').first().click();
await sleep(1500);
out.s0=await shot(page,'p12-exchange-compose');
out.text=await L.visibleText(page,'body');
out.btns=(await L.visibleButtons(page)).filter(b=>!b.includes('data-view')).slice(0,40);
return out;
