const {page}=await get('phone');
const out={};
for(let i=0;i<3;i++){await page.keyboard.press('Escape').catch(()=>{});await sleep(150);}
await page.evaluate(()=>{const c=document.querySelector('#panel-close');if(c&&!document.querySelector('#panel').hidden)c.click();});
await sleep(600);
await page.locator('[data-open="about"]').last().click(); await sleep(2000);
out.about=await shot(page,'p42-about-top');
out.t=(await L.visibleText(page,'#panel')).slice(0,1500);
return out;
