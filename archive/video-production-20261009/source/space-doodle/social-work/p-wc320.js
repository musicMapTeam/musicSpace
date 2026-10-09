const kind=globalThis.KIND||'narrow';const {page}=await get(kind);
await closeEverything(page);
await page.evaluate(()=>{for(const b of document.querySelectorAll('.community-panel:not([hidden])>header>button'))if(b.getClientRects().length)b.click();});await sleep(500);
await openKind(page,'conversation');await sleep(2500);
const join=page.locator('.community-panel form[data-group-join]');
if(await join.count()){await join.locator('input[name=consent]').check();await join.locator('button[type=submit]').click();await sleep(2500);}
await page.locator('.conversation-management>summary').click();await sleep(400);
await page.evaluate(()=>document.activeElement?.blur?.());
await page.screenshot({path:`/tmp/space-doodle/social-work/now/state-room-menu2-${kind}.png`});
await page.locator('.conversation-management>summary').click();await sleep(300);
await page.evaluate(()=>{document.querySelector('.conversation-actions').scrollLeft=9999;});await sleep(200);
await page.locator('.community-panel [data-group-worldcup]').first().click();await sleep(2500);
const cupBtn=page.locator('.worldcup-panel .entry-list button').first();if(await cupBtn.count()){await cupBtn.click();await sleep(2500);}
await page.evaluate(()=>{const s=document.querySelector('.worldcup-panel .community-scroll');const m=s.querySelector('.worldcup-match');s.scrollTop=m?m.offsetTop-120:0;document.activeElement?.blur?.();});await sleep(300);
await page.screenshot({path:`/tmp/space-doodle/social-work/now/state-wc-${kind}.png`});
return 'ok';
