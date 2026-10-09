const {page}=await get('phone');
const log=[];
const ppl=await people(page);const ayao=ppl.find(p=>p.label.includes('阿遥'))||ppl[0];
await openKind(page,'person',ayao.id);await sleep(600);
const greet=page.locator('#panel-body [data-social-send]');if(await greet.count()){await greet.first().click();await sleep(1200);}
await sleep(9000);
await openKind(page,'chats',ayao.id);await sleep(2000);
log.push(await page.evaluate(()=>({open:[...document.querySelectorAll('.community-panel,.private-chat,#panel')].filter(x=>!x.hidden).map(x=>x.className||x.id)})));
await page.evaluate(()=>{const b=document.querySelector('.private-chat:not([hidden]) .chat-close');if(b)b.click();});await sleep(300);
for(let i=0;i<3;i++){await page.keyboard.press('Escape');await sleep(150);}
await page.evaluate(()=>{const c=document.querySelector('#panel-close');if(c&&!document.querySelector('#panel').hidden)c.click();});await sleep(300);
log.push(await page.evaluate(()=>({afterClose:[...document.querySelectorAll('.community-panel,.private-chat,#panel')].filter(x=>!x.hidden).map(x=>x.className||x.id),cls:document.querySelector('.frame').className})));
await openKind(page,'conversation');await sleep(2000);
const join=page.locator('.community-panel form[data-group-join]');
if(await join.count()){await join.locator('input[name=consent]').check();await join.locator('button[type=submit]').click();await sleep(2500);}
await page.evaluate(()=>document.activeElement?.blur?.());
await page.locator('.community-panel [data-group-worldcup]').first().click();await sleep(2500);
log.push(await page.evaluate(()=>({open:[...document.querySelectorAll('.community-panel,.private-chat,#panel')].filter(x=>!x.hidden).map(x=>x.className||x.id)})));
return log;
