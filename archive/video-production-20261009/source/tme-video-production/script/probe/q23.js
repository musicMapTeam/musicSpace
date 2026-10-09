const {page}=await get('phone');
const out={};
await page.locator('.worldcup-panel header [data-cup-close], [data-cup-close]').first().click().catch(()=>{}); await sleep(1500);
await page.locator('[data-group-games]').first().click(); await sleep(2500);
out.list=await shot(page,'p24-games-list');
out.tList=(await L.visibleText(page,'.music-games')).slice(0,900);
const g=page.locator('.music-games .entry-list button').first();
if(await g.count()){ await g.click(); await sleep(2500); }
out.detail=await shot(page,'p24-game-detail');
out.tDetail=(await L.visibleText(page,'.music-games')).slice(0,1200);
out.btns=(await L.visibleButtons(page)).filter(b=>b.includes('game')).slice(0,30);
return out;
