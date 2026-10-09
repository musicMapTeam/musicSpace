const {page}=await get('phone');
const out={};
await page.locator('[data-group-worldcup]').first().click(); await sleep(2500);
out.wc0=await shot(page,'p21-worldcup-list');
out.t0=(await L.visibleText(page,'.worldcup-panel')).slice(0,800);
const cupBtn=page.locator('.worldcup-panel .entry-list button').first();
if(await cupBtn.count()){await cupBtn.click();await sleep(2500);}
out.wc1=await shot(page,'p21-worldcup-detail');
out.t1=(await L.visibleText(page,'.worldcup-panel')).slice(0,1500);
out.btns=(await L.visibleButtons(page)).filter(b=>b.includes('cup')).slice(0,40);
return out;
