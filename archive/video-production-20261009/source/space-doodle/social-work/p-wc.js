const kind=globalThis.KIND||'phone';const {page}=await get(kind);
await closeEverything(page);
await page.evaluate(()=>{for(const sel of ['.wardrobe:not([hidden]) .wardrobe-header>button','.private-chat:not([hidden]) .chat-close','.community-panel:not([hidden])>header>button','#panel:not([hidden]) #panel-close']){const b=document.querySelector(sel);if(b&&b.getClientRects().length)b.click();}});await sleep(400);
await openKind(page,'conversation');await sleep(2000);
const join=page.locator('.community-panel form[data-group-join]');
if(await join.count()){await join.locator('input[name=consent]').check();await join.locator('button[type=submit]').click();await sleep(2500);}
await page.locator('.community-panel [data-group-worldcup]').first().click();await sleep(2500);
const cupBtn=page.locator('.worldcup-panel .entry-list button').first();if(await cupBtn.count()){await cupBtn.click();await sleep(2500);}
const vote=page.locator('.worldcup-panel [data-cup-choice]').first();
if(await vote.count()){await vote.click();await sleep(600);const vf=page.locator('.worldcup-panel form[data-cup-vote]');if(await vf.count()){await vf.locator('input[name=consent]').check();await vf.locator('button[type=submit]').click();await sleep(2500);}}
await page.evaluate(()=>{const s=document.querySelector('.worldcup-panel .community-scroll');const m=s.querySelector('.worldcup-match');s.scrollTop=m?m.offsetTop-140:0;document.activeElement?.blur?.();});await sleep(300);
await page.screenshot({path:`/tmp/space-doodle/social-work/now/probe-wc-voted-${kind}.png`});
return await page.evaluate(()=>[...document.querySelectorAll('.worldcup-votes')].map(p=>p.textContent));
