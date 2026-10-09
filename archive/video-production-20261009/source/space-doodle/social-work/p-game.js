const kind=globalThis.KIND||'phone';const {page}=await get(kind);
await page.goto(L.URL,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__SPACE_BOOT__==='ready',null,{timeout:90000});await sleep(1500);
const stage=await page.evaluate(()=>document.querySelector('.frame')?.dataset.stage);
if(stage!=='room'){await L.enter(page);const skip=page.locator('button:visible',{hasText:'跳过路线'});if(await skip.count())await skip.first().click().catch(()=>{});await sleep(800);}



await openKind(page,'conversation');await sleep(2000);
const join=page.locator('.community-panel form[data-group-join]');
if(await join.count()){await join.locator('input[name=consent]').check();await join.locator('button[type=submit]').click();await sleep(2500);}
await page.locator('.community-panel [data-group-games]').first().click();await sleep(2500);
const gBtn=page.locator('.music-games .entry-list button').first();if(await gBtn.count()){await gBtn.click();await sleep(2500);}
await page.evaluate(()=>document.activeElement?.blur?.());
await page.screenshot({path:`/tmp/space-doodle/social-work/now/probe-game-detail-${kind}.png`});
const jf=page.locator('.music-games form[data-game-form="join"]');
if(await jf.count()){await jf.locator('input[name=consent]').check();await jf.locator('button').click();await sleep(7000);}
const ch=page.locator('.music-games [data-game-choice]').first();if(await ch.count()){await ch.click();await sleep(800);}
await page.evaluate(()=>{const s=document.querySelector('.music-games .community-scroll');const r=s.querySelector('.game-progress');s.scrollTop=r?r.offsetTop-90:0;document.activeElement?.blur?.();});await sleep(300);
await page.screenshot({path:`/tmp/space-doodle/social-work/now/probe-game-${kind}.png`});
return 'ok';
