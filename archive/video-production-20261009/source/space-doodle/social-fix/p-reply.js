const kind=globalThis.KIND||'phone';const {page}=await get(kind);
const stage=await page.evaluate(()=>document.querySelector('.frame')?.dataset.stage);
if(stage!=='room'){await page.goto(L.URL,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__SPACE_BOOT__==='ready',null,{timeout:90000});await sleep(1500);await L.enter(page);const skip=page.locator('button:visible',{hasText:'跳过路线'});if(await skip.count())await skip.first().click().catch(()=>{});await sleep(800);}
await closeEverything(page);
await page.evaluate(()=>{for(const sel of ['.wardrobe:not([hidden]) .wardrobe-header>button','.private-chat:not([hidden]) .chat-close','.community-panel:not([hidden])>header>button','#panel:not([hidden]) #panel-close']){const b=document.querySelector(sel);if(b&&b.getClientRects().length)b.click();}});await sleep(400);
await openKind(page,'conversation');await sleep(2000);
const join=page.locator('.community-panel form[data-group-join]');
if(await join.count()){await join.locator('input[name=consent]').check();await join.locator('button[type=submit]').click();await sleep(2500);}
await page.evaluate(()=>{const d=document.querySelector('.conversation-management');if(d&&d.open)d.open=false;const c=document.querySelector('.conversation-content');const a=c?.querySelector('.community-messages article');if(c&&a)c.scrollTop=a.offsetTop-40;document.activeElement?.blur?.();});await sleep(400);
await page.screenshot({path:globalThis.OUT||`/tmp/space-doodle/social-fix/now/reply-${kind}.png`});
return await page.evaluate(()=>[...document.querySelectorAll('.community-messages article>button')].slice(0,6).map(b=>{const r=b.getBoundingClientRect(),cs=getComputedStyle(b);return {t:b.textContent.trim(),attr:[...b.attributes].map(a=>a.name).join(','),w:Math.round(r.width),h:Math.round(r.height),x:Math.round(r.x),pad:cs.padding,mw:cs.minWidth,ta:cs.textAlign};}));
