const {page}=await get('phone');
const out={};
out.form=await page.evaluate(()=>[...document.querySelectorAll('.music-games form')].map(f=>f.getAttribute('data-game-form')+': '+f.innerText.replace(/\n/g,' | ').slice(0,200)));
const sf=page.locator('.music-games form').filter({hasText:'确认提交本轮选择'}).first();
if(await sf.count()){ await sf.locator('input[type=checkbox]').check(); await sleep(200); await sf.locator('button[type=submit], button.primary').first().click(); }
const t0=Date.now(); let last='';
for(let i=0;i<30;i++){ await sleep(700); await page.locator('[data-game="refresh"]').click().catch(()=>{}); const t=await page.evaluate(()=>document.querySelector('.music-games')?.innerText||''); if(t!==last){out['t'+(Date.now()-t0)]=t.replace(/\n/g,' | ').slice(0,700); last=t;} if(/揭晓|合计/.test(t) && /已揭晓|本轮合计|结果/.test(t)) break; }
await page.evaluate(()=>{const s=document.querySelector('.music-games .community-scroll'); if(s) s.scrollTop=0;});
await sleep(400);
out.reveal=await shot(page,'p26-game-reveal');
return out;
