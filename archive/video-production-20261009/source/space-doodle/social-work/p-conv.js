const {page}=await get('phone');
await page.goto(L.URL,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__SPACE_BOOT__==='ready',null,{timeout:90000});
await sleep(1500);
const inRoom=await page.evaluate(()=>document.querySelector('.frame')?.dataset.stage);
if(inRoom!=='room'){await L.enter(page);}
await closeEverything(page);
await openKind(page,'conversation');await sleep(2000);
const join=page.locator('.community-panel form[data-group-join]');
if(await join.count()){await join.locator('input[name=consent]').check();await join.locator('button[type=submit]').click();await sleep(2500);}
await page.screenshot({path:'/tmp/space-doodle/social-work/now/probe-conv-phone.png'});
return await page.evaluate(()=>{const r=document.querySelector('.music-community');const box=n=>{if(!n)return null;const b=n.getBoundingClientRect();const cs=getComputedStyle(n);return {cls:n.className||n.tagName,x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height),pos:cs.position,disp:cs.display,ovf:cs.overflowY,pad:cs.padding,margin:cs.margin};};
 return {stage:document.querySelector('.frame').dataset.stage,root:box(r),header:box(r.querySelector(':scope>header')),h2:box(r.querySelector(':scope>header h2')),eyebrow:box(r.querySelector(':scope>header .eyebrow')),avatar:box(r.querySelector(':scope>header .community-own-avatar')),content:box(r.querySelector('.conversation-content')),status:box(r.querySelector('.conversation-status')),menu:box(r.querySelector('.conversation-management')),summary:box(r.querySelector('.conversation-management>summary')),actions:box(r.querySelector('.conversation-actions')),reading:box(r.querySelector('.chat-reading')),msgs:box(r.querySelector('.community-messages')),composer:box(r.querySelector('.community-composer')),ta:box(r.querySelector('.community-composer textarea')),send:box(r.querySelector('.community-composer>button')),world:box(document.querySelector('.world-shell')),nav:box(document.querySelector('.camera-nav')),footer:box(document.querySelector('.frame>footer')),vh:innerHeight};});
