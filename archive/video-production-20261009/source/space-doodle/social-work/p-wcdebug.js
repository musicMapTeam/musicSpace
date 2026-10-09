const kind='phone';const {page}=await get(kind);
await page.goto(L.URL,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__SPACE_BOOT__==='ready',null,{timeout:90000});await sleep(1500);
const stage=await page.evaluate(()=>document.querySelector('.frame')?.dataset.stage);
if(stage!=='room'){await L.enter(page);const skip=page.locator('button:visible',{hasText:'跳过路线'});if(await skip.count())await skip.first().click().catch(()=>{});await sleep(800);}
await openKind(page,'conversation');await sleep(2500);
const join=page.locator('.community-panel form[data-group-join]');
if(await join.count()){await join.locator('input[name=consent]').check();await join.locator('button[type=submit]').click();await sleep(2500);}
await page.evaluate(()=>document.activeElement?.blur?.());
const before=await page.evaluate(()=>({n:document.querySelectorAll('.community-panel [data-group-worldcup]').length,sl:document.querySelector('.conversation-actions')?.scrollLeft}));
await page.locator('.community-panel [data-group-worldcup]').first().click();await sleep(2500);
const after=await page.evaluate(()=>({open:[...document.querySelectorAll('.community-panel')].filter(x=>!x.hidden).map(x=>x.className),toast:document.querySelector('#toast')?.textContent,sl:document.querySelector('.conversation-actions')?.scrollLeft}));
await page.screenshot({path:'/tmp/space-doodle/social-work/now/probe-wcdebug.png'});
return {before,after};
