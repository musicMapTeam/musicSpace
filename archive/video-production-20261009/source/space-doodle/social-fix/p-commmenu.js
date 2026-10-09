const kind=globalThis.KIND;const {page}=await get(kind);
await closeEverything(page);
await page.evaluate(()=>{for(const sel of ['.wardrobe:not([hidden]) .wardrobe-header>button','.private-chat:not([hidden]) .chat-close','.community-panel:not([hidden])>header>button','#panel:not([hidden]) #panel-close']){const b=document.querySelector(sel);if(b&&b.getClientRects().length)b.click();}});await sleep(400);
await openKind(page,'conversation');await sleep(2000);
await page.evaluate(()=>{const d=document.querySelector('.conversation-management');if(d&&!d.open)d.querySelector('summary').click();});await sleep(300);
await page.locator('.community-panel [data-group="linked"]').first().click();await sleep(3000);
let st=await page.evaluate(()=>({h2:document.querySelector('.community-panel:not([hidden]) h2')?.textContent,join:!!document.querySelector('.community-panel form[data-group-join]'),layout:!!document.querySelector('.community-panel.conversation-layout'),text:document.querySelector('.community-panel:not([hidden])')?.innerText.slice(0,300)}));
const join=page.locator('.community-panel form[data-group-join]');
if(await join.count()){await join.locator('input[name=consent]').check();await join.locator('button[type=submit]').click();await sleep(3000);}
await page.evaluate(()=>{const d=document.querySelector('.conversation-management');if(d&&!d.open)d.querySelector('summary').click();const c=document.querySelector('.conversation-content');if(c)c.scrollTop=0;document.activeElement?.blur?.();});await sleep(500);
await page.screenshot({path:globalThis.OUT});
const info=await page.evaluate(()=>{const m=document.querySelector('.conversation-management');if(!m)return null;const r=m.getBoundingClientRect(),cs=getComputedStyle(m);return {pos:cs.position,h:Math.round(r.height),ch:m.clientHeight,sh:m.scrollHeight,l:Math.round(r.left),r:Math.round(r.right),buttons:[...m.querySelectorAll('button,summary')].map(b=>b.textContent.trim().slice(0,14))};});
return {st,info};
