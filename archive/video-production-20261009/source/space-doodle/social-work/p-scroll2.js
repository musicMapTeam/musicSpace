const {page}=await get('phone');
await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__SPACE_BOOT__==='ready',null,{timeout:90000});await sleep(2000);
await openKind(page,'conversation');await sleep(2000);
const join=page.locator('.community-panel form[data-group-join]');
if(await join.count()){await join.locator('input[name=consent]').check();await join.locator('button[type=submit]').click();await sleep(2500);}
const r1=await page.evaluate(()=>{const t=document.querySelector('.conversation-actions'),c=document.querySelector('.conversation-content');t.scrollLeft=t.scrollWidth;c.scrollTop=c.scrollHeight;return {toolsLeft:t.scrollLeft,toolsMax:t.scrollWidth-t.clientWidth,contentTop:c.scrollTop,contentMax:c.scrollHeight-c.clientHeight};});
await sleep(11000);
const r2=await page.evaluate(()=>{const t=document.querySelector('.conversation-actions'),c=document.querySelector('.conversation-content');return {toolsLeft:t.scrollLeft,contentTop:c.scrollTop,readingScrolls:getComputedStyle(document.querySelector('.chat-reading')).overflowY};});
return {r1,r2};
