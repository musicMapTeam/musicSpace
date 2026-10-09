const {page}=await get('phone');
const out={};
const t0=Date.now();
let last='';
for(let i=0;i<24;i++){ await page.locator('[data-cup-refresh]').click().catch(()=>{}); await sleep(700); const t=await page.evaluate(()=>document.querySelector('.worldcup-panel')?.innerText||''); if(t!==last){out['t'+(Date.now()-t0)]=t.replace(/\n/g,' | ').slice(0,700); last=t;} }
out.after=await shot(page,'p23-worldcup-after-wait');
await page.evaluate(()=>{const s=document.querySelector('.worldcup-panel .community-scroll'); if(s) s.scrollTop=0;});
await sleep(300);
out.top=await shot(page,'p23-worldcup-top');
return out;
