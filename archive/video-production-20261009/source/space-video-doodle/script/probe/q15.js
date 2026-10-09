const {page}=await get('phone');
const out={};
const t0=Date.now();
await page.locator('[data-social-send]').first().click(); await sleep(700);
out.sent=await shot(page,'p16-greet-sent');
out.sentText=await L.visibleText(page,'#panel');
for(let i=0;i<40;i++){ const t=await page.evaluate(()=>document.querySelector('#social-inbox')?.innerText); const tx=await page.evaluate(()=>document.querySelector('#panel')?.innerText||''); if(/私聊/.test(tx)){out.friendMs=Date.now()-t0;break;} await sleep(250);}
await sleep(600); out.friend=await shot(page,'p16-greet-accepted');
out.friendText=await L.visibleText(page,'#panel');
out.inbox=await page.evaluate(()=>document.querySelector('#social-inbox')?.innerText);
out.btns=(await L.visibleButtons(page)).filter(b=>!b.includes('data-view')&&!b.includes('scene-target')).slice(0,30);
return out;
