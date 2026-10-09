const kind=globalThis.KIND||'phone';const {page}=await get(kind);
const stage=await page.evaluate(()=>document.querySelector('.frame')?.dataset.stage);
if(stage!=='room'){await page.goto(L.URL,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__SPACE_BOOT__==='ready',null,{timeout:90000});await sleep(1500);await L.enter(page);const skip=page.locator('button:visible',{hasText:'跳过路线'});if(await skip.count())await skip.first().click().catch(()=>{});await sleep(800);}
await closeEverything(page);
await page.evaluate(()=>{for(const sel of ['.wardrobe:not([hidden]) .wardrobe-header>button','.private-chat:not([hidden]) .chat-close','.community-panel:not([hidden])>header>button','#panel:not([hidden]) #panel-close']){const b=document.querySelector(sel);if(b&&b.getClientRects().length)b.click();}});await sleep(400);
await openKind(page,'conversation');await sleep(2000);
const join=page.locator('.community-panel form[data-group-join]');
if(await join.count()){await join.locator('input[name=consent]').check();await join.locator('button[type=submit]').click();await sleep(2500);}
await page.locator('.community-panel [data-group-games]').first().click();await sleep(2500);
const gBtn=page.locator('.music-games .entry-list button').first();if(await gBtn.count()){await gBtn.click();await sleep(2500);}
const jf=page.locator('.music-games form[data-game-form="join"]');
if(await jf.count()){await jf.locator('input[name=consent]').check();await jf.locator('button').click();await sleep(7000);}
const ch=page.locator('.music-games [data-game-choice]').first();if(await ch.count()&&!globalThis.NOCHOICE){await ch.click();await sleep(800);}
await page.evaluate(()=>{const s=document.querySelector('.music-games .community-scroll');const r=s.querySelector('.game-round')||s.querySelector('.game-progress');s.scrollTop=r?r.offsetTop-90:0;document.activeElement?.blur?.();});await sleep(400);
await page.screenshot({path:`/tmp/space-doodle/social-fix/now/game-${kind}.png`});
return await page.evaluate(()=>[...document.querySelectorAll('.music-games .game-choices button')].map(b=>{const r=b.getBoundingClientRect(),cs=getComputedStyle(b);return {t:b.textContent.trim(),w:Math.round(r.width),h:Math.round(r.height),fs:cs.fontSize,pad:cs.padding,ws:cs.whiteSpace,sw:b.scrollWidth,cw:b.clientWidth};}));
