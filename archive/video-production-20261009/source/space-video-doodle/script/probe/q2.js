const {page}=await get('phone');
await page.locator('#join').click();
await page.waitForSelector('form[data-form="demo-entry"]',{timeout:30000});
await sleep(1200);
const s1=await shot(page,'p02-entry-top');
const form=await page.evaluate(()=>{const f=document.querySelector('form[data-form="demo-entry"]');return [...f.querySelectorAll('input,button,a,label')].map(e=>e.tagName+' '+(e.name||'')+' '+(e.type||'')+' '+(e.value||'')+' | '+(e.textContent||'').trim().replace(/\s+/g,' ').slice(0,80));});
// scroll the panel to the end
await page.evaluate(()=>{const p=document.querySelector('#panel-body')||document.querySelector('#panel');p.scrollTop=99999;});
await sleep(500);
const s2=await shot(page,'p02-entry-end');
return {s1,s2,form,text:await L.visibleText(page,'#panel')};
