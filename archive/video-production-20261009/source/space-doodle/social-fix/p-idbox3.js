const kind=globalThis.KIND;const {page}=await get(kind);
const r=await page.evaluate(()=>{const p=document.querySelector('.identity-continuity [data-identity-status]');const s=document.querySelector('.identity-continuity .community-scroll');s.scrollTop=s.scrollHeight;const b=p.getBoundingClientRect(),cs=getComputedStyle(p);return {h:b.height,border:cs.borderTopStyle,pad:cs.padding};});
await sleep(400);
await page.screenshot({path:globalThis.OUT||`/tmp/space-doodle/social-fix/now/idbox3-${kind}.png`});
// now simulate a status message, to make sure the box still appears once it has text
const r2=await page.evaluate(()=>{const p=document.querySelector('.identity-continuity [data-identity-status]');p.textContent='正在本机核对，请稍候…';const b=p.getBoundingClientRect(),cs=getComputedStyle(p);const out={h:b.height,border:cs.borderTopStyle+' '+cs.borderTopWidth,pad:cs.padding};return out;});
await sleep(200);
await page.screenshot({path:`/tmp/space-doodle/social-fix/now/idbox3-filled-${kind}.png`});
await page.evaluate(()=>{document.querySelector('.identity-continuity [data-identity-status]').textContent='';});
return {empty:r,filled:r2};
