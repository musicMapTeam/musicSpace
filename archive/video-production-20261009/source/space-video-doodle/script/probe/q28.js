const {page}=await get('phone');
const out={};
await page.locator('[data-game="close"]').first().click().catch(()=>{}); await sleep(1200);
await page.locator('[data-group="close"]').first().click().catch(()=>{}); await sleep(1200);
for(let i=0;i<2;i++){await page.keyboard.press('Escape').catch(()=>{});await sleep(200);}
await page.locator('#scene-details').click(); await sleep(1500);
await page.locator('[data-open="recap"]').first().click(); await sleep(2500);
out.recap=await shot(page,'p27-recap-top');
out.t=(await L.visibleText(page,'#panel')).slice(0,1500);
out.btns=(await L.visibleButtons(page)).filter(b=>!b.includes('data-view')&&!b.includes('scene-target')).slice(0,40);
return out;
