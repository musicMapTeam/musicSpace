const {page}=await get('phone');
const out={};
for(let i=0;i<3;i++){await page.keyboard.press('Escape').catch(()=>{});await sleep(150);}
await page.evaluate(()=>{const c=document.querySelector('#panel-close');if(c&&!document.querySelector('#panel').hidden)c.click();});
await sleep(600);
await page.locator('[data-view="photos"]').click(); await sleep(2500);
out.photos=await shot(page,'p41-photos-view');
out.btns=(await L.visibleButtons(page)).filter(b=>!b.includes('data-view')).slice(0,20);
await page.locator('[data-view="overview"]').click(); await sleep(2500);
out.overview=await shot(page,'p41-overview-clean');
await page.locator('[data-kind="person"]',{hasText:'阿遥'}).first().click(); await sleep(2500);
out.yao=await shot(page,'p41-person-yao');
return out;
