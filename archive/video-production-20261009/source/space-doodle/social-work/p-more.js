const kind=globalThis.KIND||'phone';
if(pages[kind]){await pages[kind].ctx.close().catch(()=>{});delete pages[kind];}
const {page}=await get(kind);
await L.enter(page);
const skip=page.locator('button:visible',{hasText:'跳过路线'});if(await skip.count())await skip.first().click().catch(()=>{});
await sleep(800);
const ppl=await people(page);const ayao=ppl.find(p=>p.label.includes('阿遥'))||ppl[0];
await openKind(page,'person',ayao.id);await sleep(600);
const greet=page.locator('#panel-body [data-social-send]');if(await greet.count()){await greet.first().click();await sleep(1200);}
await sleep(9000);
await closeEverything(page);
await openKind(page,'corners',ayao.id);await sleep(2500);
const f=page.locator('.corner-panel form[data-corner-create]');
let created=false;
if(await f.count()){await f.locator('input[name=participation]').check();await f.locator('button[type=submit]').click();await sleep(3000);created=true;}
await page.evaluate(()=>document.activeElement?.blur?.());
await page.screenshot({path:`/tmp/space-doodle/social-work/now/state-corner-invited-${kind}.png`});
const lst=page.locator('.corner-panel [data-corner-list]');if(await lst.count()){await lst.first().click();await sleep(2500);}
await page.evaluate(()=>document.activeElement?.blur?.());
await page.screenshot({path:`/tmp/space-doodle/social-work/now/state-corner-list-${kind}.png`});
await page.evaluate(()=>{for(const b of document.querySelectorAll('.community-panel:not([hidden])>header>button'))if(b.getClientRects().length)b.click();});await sleep(500);
await openKind(page,'personal');await sleep(2500);
await page.evaluate(()=>{const s=document.querySelector('.personal-space .community-scroll');s.scrollTop=s.scrollHeight;document.activeElement?.blur?.();});await sleep(400);
await page.screenshot({path:`/tmp/space-doodle/social-work/now/state-personal-end-${kind}.png`});
return {created,text:await page.evaluate(()=>document.querySelector('.personal-space')?.textContent.slice(-300))};
