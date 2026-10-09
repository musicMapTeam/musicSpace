const {page}=await get('phone');
const out={};
await page.locator('.private-chat .chat-close, .private-chat [data-chat-close], .private-chat button[aria-label*="关闭"]').first().click().catch(()=>{});
await sleep(800);
for(let i=0;i<3;i++){await page.keyboard.press('Escape').catch(()=>{});await sleep(200);}
await page.evaluate(()=>{const c=document.querySelector('#panel-close');if(c&&!document.querySelector('#panel').hidden)c.click();});
await sleep(800);
await page.locator('[data-view="overview"]').click(); await sleep(1500);
out.room=await shot(page,'p18-room-tour4');
out.tour=await page.evaluate(()=>document.querySelector('.demo-tour')?.innerText);
out.btns=(await L.visibleButtons(page)).filter(b=>!b.includes('data-view')).slice(0,40);
return out;
