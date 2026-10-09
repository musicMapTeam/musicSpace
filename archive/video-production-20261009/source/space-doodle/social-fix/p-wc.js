const kind=globalThis.KIND;const {page}=await get(kind);
const stage=await page.evaluate(()=>document.querySelector('.frame')?.dataset.stage);
if(stage!=='room'){await page.goto(L.URL,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__SPACE_BOOT__==='ready',null,{timeout:90000});await sleep(1500);await L.enter(page);const skip=page.locator('button:visible',{hasText:'跳过路线'});if(await skip.count())await skip.first().click().catch(()=>{});await sleep(800);}
await closeEverything(page);
await page.evaluate(()=>{for(const sel of ['.wardrobe:not([hidden]) .wardrobe-header>button','.private-chat:not([hidden]) .chat-close','.community-panel:not([hidden])>header>button','#panel:not([hidden]) #panel-close']){const b=document.querySelector(sel);if(b&&b.getClientRects().length)b.click();}});await sleep(400);
await openKind(page,'conversation');await sleep(2000);
const join=page.locator('.community-panel form[data-group-join]');
if(await join.count()){await join.locator('input[name=consent]').check();await join.locator('button[type=submit]').click();await sleep(2500);}
await page.evaluate(()=>{const d=document.querySelector('.conversation-management');if(d&&d.open)d.open=false;});
await page.locator('.community-panel [data-group-worldcup]').first().click();await sleep(2500);
const cupBtn=page.locator('.worldcup-panel .entry-list button').first();if(await cupBtn.count()){await cupBtn.click();await sleep(2500);}
const pos=async()=>page.evaluate(()=>{const s=document.querySelector('.worldcup-panel .community-scroll');const m=s.querySelector('.worldcup-match');s.scrollTop=m?m.offsetTop-150:0;document.activeElement?.blur?.();});
await pos();await sleep(400);
await page.screenshot({path:globalThis.OUT1});
const covers=await page.evaluate(()=>[...document.querySelectorAll('.worldcup-cover')].map(c=>{const cs=getComputedStyle(c),h=getComputedStyle(c.querySelector('h3')),sp=getComputedStyle(c.querySelector('span')),p=getComputedStyle(c.querySelector('p'));const r=c.getBoundingClientRect();return {tint:c.dataset.tint,bg:cs.backgroundColor,h3:h.color+' '+h.fontSize+' shadow:'+h.textShadow,span:sp.color,p:p.color,h:Math.round(r.height),t:c.querySelector('h3').textContent};}));
if(globalThis.VOTE){const vote=page.locator('.worldcup-panel [data-cup-choice]').first();
if(await vote.count()){await vote.click();await sleep(600);const vf=page.locator('.worldcup-panel form[data-cup-vote]');if(await vf.count()){await vf.locator('input[name=consent]').check();await vf.locator('button[type=submit]').click();await sleep(2500);}}
await pos();await sleep(400);await page.screenshot({path:globalThis.OUT2});}
return covers;
