const {page}=await get('phone');
const out={};
await page.evaluate(()=>{const p=document.querySelector('#panel-body')||document.querySelector('#panel');p.scrollTop=0;});
await sleep(300);
await page.locator('[data-sample-photo="sample-stage"]').click();
const t0=Date.now();
await sleep(150); out.s0=await shot(page,'p09-stage-0');
for(let i=0;i<30;i++){ const t=await page.evaluate(()=>{const e=document.querySelector('.moment-ai-tag');return e?e.textContent.trim():''}); if(t){out.ai=t;out.aiMs=Date.now()-t0;break;} await sleep(200);}
await sleep(300); out.s1=await shot(page,'p09-stage-ai');
out.selected=await page.evaluate(()=>[...document.querySelectorAll('[data-moment-viewpoint]')].map(b=>b.dataset.momentViewpoint+':'+b.getAttribute('aria-pressed')+':'+b.className));
out.taken=await page.evaluate(()=>document.querySelector('[data-taken-line]')?.innerText);
return out;
