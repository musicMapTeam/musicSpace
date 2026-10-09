const kind=globalThis.KIND||'phone';const {page}=await get(kind);
await page.goto(L.URL,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__SPACE_BOOT__==='ready',null,{timeout:90000});await sleep(1500);
const stage=await page.evaluate(()=>document.querySelector('.frame')?.dataset.stage);
if(stage!=='room'){await L.enter(page);const skip=page.locator('button:visible',{hasText:'跳过路线'});if(await skip.count())await skip.first().click().catch(()=>{});await sleep(800);}
await openKind(page,'communities');await sleep(2000);
let has=await page.locator('.music-community .entry-list button').count();
if(!has){const f=page.locator('.music-community form[data-community-create]');await f.locator('input[name=title]').fill('周五散场以后');await f.locator('input[name=consent]').check();await f.locator('button[type=submit]').click();await sleep(3000);}
await page.locator('.music-community .entry-list button').first().click();await sleep(3000);
await page.evaluate(()=>document.activeElement?.blur?.());
await page.screenshot({path:`/tmp/space-doodle/social-work/now/probe-mycommunity-${kind}.png`});
// open 空间与活动
const sb=page.locator('.music-community [data-group-space]');
const n=await sb.count();
if(n){await page.evaluate(()=>{const d=document.querySelector('.conversation-management');if(d)d.open=true;});await sleep(200);await sb.first().click();await sleep(2500);}
await page.evaluate(()=>document.activeElement?.blur?.());
await page.screenshot({path:`/tmp/space-doodle/social-work/now/probe-space-${kind}.png`});
return {n,open:await page.evaluate(()=>[...document.querySelectorAll('.community-panel')].filter(x=>!x.hidden).map(x=>x.className))};
