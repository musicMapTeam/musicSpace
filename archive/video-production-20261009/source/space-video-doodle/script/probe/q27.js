const {page}=await get('phone');
const out={};
const sf=page.locator('.music-games form[data-game-form="answer"]');
await sf.locator('input[name=consent]').check(); await sleep(200);
await sf.locator('button',{hasText:'先保留我的选择'}).click();
const t0=Date.now(); let last='';
for(let i=0;i<30;i++){ await sleep(700); await page.locator('[data-game="refresh"]').click().catch(()=>{}); const t=await page.evaluate(()=>document.querySelector('.music-games')?.innerText||''); if(t!==last){out['t'+(Date.now()-t0)]=t.replace(/\n/g,' | ').slice(0,800); last=t;} if(/已揭晓|揭晓结果|本轮合计/.test(t)) {break;} }
await page.evaluate(()=>{const s=document.querySelector('.music-games .community-scroll'); if(s) s.scrollTop=0;});
await sleep(400);
out.reveal=await shot(page,'p26-game-reveal');
return out;
