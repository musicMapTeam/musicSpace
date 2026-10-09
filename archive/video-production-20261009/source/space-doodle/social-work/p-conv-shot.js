const kind=globalThis.KIND||'phone';
const {page}=await get(kind);
const open=await page.evaluate(()=>!!document.querySelector('.music-community.conversation-layout:not([hidden])'));
if(!open){
  const stage=await page.evaluate(()=>document.querySelector('.frame')?.dataset.stage);
  if(stage!=='room'){await L.enter(page);const skip=page.locator('button:visible',{hasText:'跳过路线'});if(await skip.count())await skip.first().click().catch(()=>{});}
  await closeEverything(page);await openKind(page,'conversation');await sleep(2000);
  const join=page.locator('.community-panel form[data-group-join]');
  if(await join.count()){await join.locator('input[name=consent]').check();await join.locator('button[type=submit]').click();await sleep(2500);}
}
await sleep(500);
const name=globalThis.NAME||'probe-conv';
await page.screenshot({path:`/tmp/space-doodle/social-work/now/${name}-${kind}.png`});
return await page.evaluate(()=>{const r=document.querySelector('.music-community');const b=n=>{if(!n)return null;const x=n.getBoundingClientRect();return [Math.round(x.x),Math.round(x.y),Math.round(x.width),Math.round(x.height)];};return {root:b(r),header:b(r.querySelector(':scope>header')),content:b(r.querySelector('.conversation-content')),status:b(r.querySelector('.conversation-status')),menu:b(r.querySelector('.conversation-management')),actions:b(r.querySelector('.conversation-actions')),reading:b(r.querySelector('.chat-reading')),composer:b(r.querySelector('.community-composer')),ta:b(r.querySelector('.community-composer textarea')),send:b(r.querySelector('.community-composer>button')),hscroll:[r.querySelector('.conversation-content').scrollWidth,r.querySelector('.conversation-content').clientWidth]};});
