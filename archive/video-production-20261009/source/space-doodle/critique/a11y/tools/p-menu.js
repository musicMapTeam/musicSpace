const out={};
for(const vp of ['w320','w390']){
await drop(vp);
const {page}=await get(vp);
await L.enter(page);
const skip=page.locator('button:visible',{hasText:'跳过路线'});if(await skip.count())await skip.first().click().catch(()=>{});
await sleep(800);
await L.openKind(page,'conversation');await sleep(2500);
const join=page.locator('.community-panel form[data-group-join]');
if(await join.count()){await join.locator('input[name=consent]').check();await join.locator('button[type=submit]').click();await sleep(3000);}
await page.locator('.conversation-management>summary').first().click();await sleep(600);
out[vp]=await page.evaluate(()=>{const d=document.querySelector('.conversation-management');const r=d.getBoundingClientRect();const cs=getComputedStyle(d);
 const sc=document.querySelector('.conversation-content');const sr=sc.getBoundingClientRect();
 const ps=[...d.querySelectorAll('p,small')].filter(n=>n.getClientRects().length).map(n=>{const rr=n.getBoundingClientRect();return {text:n.textContent.trim().slice(0,20),top:Math.round(rr.top),bottom:Math.round(rr.bottom)};});
 const composer=document.querySelector('.community-panel form, .community-panel .conversation-composer');const cr=composer&&composer.getBoundingClientRect();
 return {menu:[Math.round(r.left),Math.round(r.top),Math.round(r.right),Math.round(r.bottom)],overflowY:cs.overflowY,maxHeight:cs.maxHeight,scrollH:d.scrollHeight,clientH:d.clientHeight,scroller:[Math.round(sr.left),Math.round(sr.top),Math.round(sr.right),Math.round(sr.bottom)],texts:ps,composerTop:cr&&Math.round(cr.top)};});
await page.screenshot({path:`/tmp/space-doodle/critique/a11y/evidence/${vp}-community-menu-open.png`});
}
return out;
