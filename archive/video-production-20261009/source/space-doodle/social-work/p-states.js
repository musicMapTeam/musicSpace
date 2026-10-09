const kind=globalThis.KIND||'phone';
if(pages[kind]){await pages[kind].ctx.close().catch(()=>{});delete pages[kind];}
const {page}=await get(kind);
await L.enter(page);
const skip=page.locator('button:visible',{hasText:'跳过路线'});if(await skip.count())await skip.first().click().catch(()=>{});
await sleep(800);
const out=`/tmp/space-doodle/social-work/now/state`;
await openKind(page,'friends');await sleep(1200);await page.evaluate(()=>document.activeElement?.blur?.());
await page.screenshot({path:`${out}-friends-empty-${kind}.png`});
await closeEverything(page);
await openKind(page,'chats');await sleep(2000);await page.evaluate(()=>document.activeElement?.blur?.());
await page.screenshot({path:`${out}-chats-empty-${kind}.png`});
await page.evaluate(()=>{const b=document.querySelector('.private-chat:not([hidden]) .chat-close');if(b)b.click();});await sleep(400);
await openKind(page,'conversation');await sleep(2500);await page.evaluate(()=>document.activeElement?.blur?.());
await page.screenshot({path:`${out}-room-join-${kind}.png`});
const join=page.locator('.community-panel form[data-group-join]');
if(await join.count()){await join.locator('input[name=consent]').check();await join.locator('button[type=submit]').click();await sleep(2500);}
await page.locator('.conversation-management>summary').click();await sleep(500);
await page.evaluate(()=>document.activeElement?.blur?.());
await page.screenshot({path:`${out}-room-menu-${kind}.png`});
return 'ok';
