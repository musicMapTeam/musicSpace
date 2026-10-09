const kind='phone';const {page}=await get(kind);
const ppl=await people(page);const ayao=ppl.find(p=>p.label.includes('阿遥'))||ppl[0];
await openKind(page,'chats',ayao.id);await sleep(2000);
// same as the walk's closeEverything
await page.evaluate(()=>{for(const sel of ['.wardrobe:not([hidden]) .wardrobe-header>button','.private-chat:not([hidden]) .chat-close','.room-moderation:not([hidden]) header>button']){const b=document.querySelector(sel);if(b&&b.getClientRects().length)b.click();}});await sleep(300);
for(let i=0;i<3;i++){await page.keyboard.press('Escape');await sleep(150);}
await page.evaluate(()=>{const c=document.querySelector('#panel-close');if(c&&!document.querySelector('#panel').hidden)c.click();});await sleep(300);
const mid=await page.evaluate(()=>({open:[...document.querySelectorAll('.community-panel,.private-chat,.wardrobe,#panel,.room-moderation')].filter(x=>!x.hidden).map(x=>x.className||x.id),active:document.activeElement?.outerHTML?.slice(0,80)}));
await openKind(page,'conversation');await sleep(2500);
const before=await page.evaluate(()=>({open:[...document.querySelectorAll('.community-panel')].filter(x=>!x.hidden).map(x=>x.className)}));
await page.evaluate(()=>document.activeElement?.blur?.());
await page.locator('.community-panel [data-group-worldcup]').first().click();await sleep(2500);
const after=await page.evaluate(()=>({open:[...document.querySelectorAll('.community-panel,.private-chat,#panel')].filter(x=>!x.hidden).map(x=>x.className||x.id)}));
return {mid,before,after};
