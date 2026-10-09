const {page}=await get('phone');
const out={};
const jf=page.locator('.music-games form[data-game-form="join"]');
out.jf=await jf.count();
if(out.jf){await jf.locator('input[name=consent]').check(); await sleep(200); await jf.locator('button').click();}
const t0=Date.now(); let last='';
for(let i=0;i<30;i++){ await sleep(600); await page.locator('[data-game="refresh"]').click().catch(()=>{}); const t=await page.evaluate(()=>document.querySelector('.music-games')?.innerText||''); if(t!==last){out['t'+(Date.now()-t0)]=t.replace(/\n/g,' | ').slice(0,600); last=t;} if(/我选/.test(t)) break; }
out.round=await shot(page,'p25-game-round');
const ch=page.locator('.music-games [data-game-choice]').first();
if(await ch.count()){ await ch.click(); await sleep(800); out.choice=await shot(page,'p25-game-choice'); }
out.btns=(await L.visibleButtons(page)).filter(b=>b.includes('game')).slice(0,30);
return out;
