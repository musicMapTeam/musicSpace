const kind=globalThis.KIND||'phone';const {page}=await get(kind);
await page.goto(L.URL,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__SPACE_BOOT__==='ready',null,{timeout:90000});await sleep(1500);
const stage=await page.evaluate(()=>document.querySelector('.frame')?.dataset.stage);
if(stage!=='room'){await L.enter(page);const skip=page.locator('button:visible',{hasText:'跳过路线'});if(await skip.count())await skip.first().click().catch(()=>{});await sleep(800);}
await openKind(page,'conversation');await sleep(2000);
const join=page.locator('.community-panel form[data-group-join]');
if(await join.count()){await join.locator('input[name=consent]').check();await join.locator('button[type=submit]').click();await sleep(2500);}
await page.locator('.community-panel [data-group-topics]').first().click();await sleep(2500);
if(!(await page.locator('.music-topics article.music-reference').count())){
 await page.evaluate(()=>{const d=document.querySelector('.music-topics details');if(d)d.open=true;});await sleep(200);
 const f=page.locator('.music-topics form[data-topic-create]');
 await f.locator('input[name=title]').fill('晚班列车');await f.locator('input[name=artist]').fill('纸灯乐队');await f.locator('input[name=note]').fill('返场前那段鼓点，你们是不是也在跟着拍手？');
 await f.locator('input[name=consent]').check();await f.locator('button').click();await sleep(3000);
}
await page.evaluate(()=>{document.activeElement?.blur?.();const s=document.querySelector('.music-topics .community-scroll');s.scrollTop=0;});await sleep(300);
await page.screenshot({path:`/tmp/space-doodle/social-work/now/probe-topic-${kind}.png`});
return await page.locator('.music-topics article.music-reference').count();
