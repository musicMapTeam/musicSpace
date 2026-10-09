const {page}=await get('phone');
const out={};
await page.evaluate(()=>{const p=document.querySelector('#panel-body')||document.querySelector('#panel');p.scrollTop=0;});
await sleep(300);
await page.locator('[data-sample-photo="sample-crowd"]').click();
for(let i=0;i<30;i++){ const t=await page.evaluate(()=>{const e=document.querySelector('.moment-ai-tag');return e?e.textContent.trim():''}); if(t){out.ai=t;break;} await sleep(200);}
out.vis=await page.evaluate(()=>{const s=document.querySelector('form[data-form="upload"] select');return s?{name:s.name,value:s.value,opts:[...s.options].map(o=>o.value+':'+o.text)}:[...document.querySelectorAll('form[data-form="upload"] input[type=radio]')].map(r=>r.name+':'+r.value+':'+r.checked);});
const t0=Date.now();
await page.locator('form[data-form="upload"] button',{hasText:'保存这张照片'}).click();
await sleep(400); out.s0=await shot(page,'p10-after-save-0');
await sleep(1200); out.s1=await shot(page,'p10-after-save-1');
out.text=await L.visibleText(page,'#panel');
out.btns=(await L.visibleButtons(page)).filter(b=>!b.includes('data-view')).slice(0,40);
return out;
