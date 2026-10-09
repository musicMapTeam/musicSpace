const {page}=await get('phone');
const out={};
await page.locator('[data-cup-choice][data-album="night-platform"]').click(); await sleep(800);
out.picked=await shot(page,'p22-worldcup-picked');
const vf=page.locator('.worldcup-panel form[data-cup-vote]');
out.vfCount=await vf.count();
if(out.vfCount){out.vfText=await vf.innerText(); await vf.locator('input[name=consent]').check(); await sleep(200); out.vfShot=await shot(page,'p22-worldcup-consent'); await vf.locator('button[type=submit]').click(); await sleep(2000);}
out.voted=await shot(page,'p22-worldcup-voted');
const t0=Date.now();
for(let i=0;i<40;i++){ const t=await page.evaluate(()=>document.querySelector('.worldcup-panel')?.innerText||''); if(/第二轮|决赛|晋级|胜出/.test(t)){out.advanceMs=Date.now()-t0;break;} await sleep(500); await page.locator('[data-cup-refresh]').click().catch(()=>{}); }
await sleep(800);
out.after=await shot(page,'p22-worldcup-after');
out.t=(await L.visibleText(page,'.worldcup-panel')).slice(0,1500);
return out;
