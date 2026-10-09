const kind='narrow';if(pages[kind]){await pages[kind].ctx.close().catch(()=>{});delete pages[kind];}
const {page}=await get(kind);await L.enter(page);const skip=page.locator('button:visible',{hasText:'跳过路线'});if(await skip.count())await skip.first().click().catch(()=>{});await sleep(800);
await closeEverything(page);
await page.evaluate(()=>{for(const b of document.querySelectorAll('.community-panel:not([hidden])>header>button'))if(b.getClientRects().length)b.click();});await sleep(500);
await openKind(page,'conversation');await sleep(2500);
const join=page.locator('.community-panel form[data-group-join]');
if(await join.count()){await join.locator('input[name=consent]').check();await join.locator('button[type=submit]').click();await sleep(2500);}
await page.locator('.conversation-management>summary').click();await sleep(400);
await page.evaluate(()=>document.activeElement?.blur?.());
await page.screenshot({path:`/tmp/space-doodle/social-work/now/final-room-menu-${kind}.png`});
await page.locator('.conversation-management>summary').click();await sleep(300);
await page.evaluate(()=>{document.querySelector('.conversation-actions').scrollLeft=9999;});await sleep(200);
await page.locator('.community-panel [data-group-worldcup]').first().click();await sleep(2500);
const cupBtn=page.locator('.worldcup-panel .entry-list button').first();if(await cupBtn.count()){await cupBtn.click();await sleep(2500);}
await page.evaluate(()=>{const s=document.querySelector('.worldcup-panel .community-scroll');const m=s.querySelector('.worldcup-match');s.scrollTop=m?m.offsetTop-120:0;document.activeElement?.blur?.();});await sleep(300);
await page.screenshot({path:`/tmp/space-doodle/social-work/now/final-wc-${kind}.png`});
return 'ok';
