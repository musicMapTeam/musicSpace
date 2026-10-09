const kind='phone';
if(pages[kind]){await pages[kind].ctx.close().catch(()=>{});delete pages[kind];}
const {page}=await get(kind);
await L.enter(page);
const skip=page.locator('button:visible',{hasText:'跳过路线'});if(await skip.count())await skip.first().click().catch(()=>{});
await sleep(800);
const out='/tmp/space-doodle/social-work/now/final';
await openKind(page,'friends');await sleep(1200);await page.evaluate(()=>document.activeElement?.blur?.());
await page.screenshot({path:`${out}-friends-empty-${kind}.png`});
await closeEverything(page);
await openKind(page,'conversation');await sleep(2500);await page.evaluate(()=>document.activeElement?.blur?.());
await page.screenshot({path:`${out}-room-join-${kind}.png`});
const join=page.locator('.community-panel form[data-group-join]');
if(await join.count()){await join.locator('input[name=consent]').check();await join.locator('button[type=submit]').click();await sleep(2500);}
await page.locator('.conversation-management>summary').click();await sleep(500);
await page.evaluate(()=>document.activeElement?.blur?.());
await page.screenshot({path:`${out}-room-menu-${kind}.png`});
await page.locator('.conversation-management>summary').click();await sleep(300);
await page.evaluate(()=>{document.querySelector('.conversation-actions').scrollLeft=9999;});await sleep(200);
await page.locator('.community-panel [data-group-topics]').first().click();await sleep(2500);
await page.evaluate(()=>{const d=document.querySelector('.music-topics details');if(d)d.open=true;});await sleep(200);
const f=page.locator('.music-topics form[data-topic-create]');
await f.locator('input[name=title]').fill('晚班列车');await f.locator('input[name=artist]').fill('纸灯乐队');await f.locator('input[name=note]').fill('返场前那段鼓点，你们是不是也在跟着拍手？');
await f.locator('input[name=consent]').check();await f.locator('button').click();await sleep(3000);
await page.evaluate(()=>{document.activeElement?.blur?.();const s=document.querySelector('.music-topics .community-scroll');const a=s.querySelector('article');s.scrollTop=a?a.offsetTop-150:0;});await sleep(300);
await page.screenshot({path:`${out}-topic-posted-${kind}.png`});
return await page.locator('.music-topics article.music-reference').count();
