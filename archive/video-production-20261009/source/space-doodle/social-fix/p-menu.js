const kind=globalThis.KIND||'narrow';const {page}=await get(kind);
const stage=await page.evaluate(()=>document.querySelector('.frame')?.dataset.stage);
if(stage!=='room'){await page.goto(L.URL,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__SPACE_BOOT__==='ready',null,{timeout:90000});await sleep(1500);await L.enter(page);const skip=page.locator('button:visible',{hasText:'跳过路线'});if(await skip.count())await skip.first().click().catch(()=>{});await sleep(800);}
await closeEverything(page);
await page.evaluate(()=>{for(const sel of ['.wardrobe:not([hidden]) .wardrobe-header>button','.private-chat:not([hidden]) .chat-close','.community-panel:not([hidden])>header>button','#panel:not([hidden]) #panel-close']){const b=document.querySelector(sel);if(b&&b.getClientRects().length)b.click();}});await sleep(400);
await openKind(page,'conversation');await sleep(2000);
const join=page.locator('.community-panel form[data-group-join]');
if(await join.count()){await join.locator('input[name=consent]').check();await join.locator('button[type=submit]').click();await sleep(2500);}
await page.evaluate(()=>{const d=document.querySelector('.conversation-management');if(d&&!d.open)d.querySelector('summary').click();});await sleep(600);
const info=await page.evaluate(()=>{const box=n=>{if(!n)return null;const b=n.getBoundingClientRect(),cs=getComputedStyle(n);return {x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height),r:Math.round(b.right),b:Math.round(b.bottom),pos:cs.position,ovf:cs.overflowY,ch:n.clientHeight,sh:n.scrollHeight,maxh:cs.maxHeight,inset:cs.inset};};
 const m=document.querySelector('.conversation-management');const items=[...m.querySelectorAll(':scope>*:not(summary), :scope>* button')].slice(0,30).map(n=>({t:(n.textContent||'').trim().slice(0,16),...box(n)}));
 return {vh:innerHeight,vw:innerWidth,menu:box(m),content:box(document.querySelector('.conversation-content')),panel:box(document.querySelector('.music-community')),composer:box(document.querySelector('.community-composer')),items,children:[...m.children].map(c=>c.tagName+'.'+c.className+'['+(c.textContent||'').trim().slice(0,12)+']')};});
await page.screenshot({path:`/tmp/space-doodle/social-fix/now/menu-${kind}.png`});
return info;
