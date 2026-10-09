globalThis.KIND="phone";globalThis.WHO=0;
const kind=globalThis.KIND||'phone';const {page}=await get(kind);
const stage=await page.evaluate(()=>document.querySelector('.frame')?.dataset.stage);
if(stage!=='room'){await page.goto(L.URL,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__SPACE_BOOT__==='ready',null,{timeout:90000});await sleep(1500);await L.enter(page);const skip=page.locator('button:visible',{hasText:'跳过路线'});if(await skip.count())await skip.first().click().catch(()=>{});await sleep(800);}
await closeEverything(page);
await openKind(page,'people');await sleep(1200);
const host=await page.evaluate(()=>{const b=[...document.querySelectorAll('#panel-body [data-person]')];return b.map(x=>x.textContent.trim().slice(0,30));});
const which=globalThis.WHO||0;
await page.locator('#panel-body [data-person]').nth(which).click();await sleep(1500);
const fine=await page.evaluate(()=>[...document.querySelectorAll('#panel-body p.fine, #panel-body .quiet')].map(p=>{const cs=getComputedStyle(p);return {tag:p.tagName,cls:p.className,text:p.textContent.trim().slice(0,24),fs:cs.fontSize,lh:cs.lineHeight,ff:cs.fontFamily.slice(0,30)};}));
await page.evaluate(()=>{const b=document.querySelector('#panel-body');b.scrollTop=b.scrollHeight;document.activeElement?.blur?.();});await sleep(300);
await page.screenshot({path:`/tmp/space-doodle/social-fix/now/person-${kind}-${which}.png`});
return {host,fine};
