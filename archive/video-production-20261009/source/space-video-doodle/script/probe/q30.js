const {page}=await get('phone');
const out={};
await page.locator('#panel [data-open="recap"]').first().click(); await sleep(2500);
out.recap=await shot(page,'p27-recap-top');
out.t=(await L.visibleText(page,'#panel')).slice(0,1800);
out.btns=(await L.visibleButtons(page)).filter(b=>!b.includes('data-view')&&!b.includes('scene-target')).slice(0,40);
return out;
