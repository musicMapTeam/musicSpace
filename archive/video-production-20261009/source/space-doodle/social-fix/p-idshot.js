const kind=globalThis.KIND;const {page}=await get(kind);
await page.goto(L.URL,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__SPACE_BOOT__==='ready',null,{timeout:90000});await sleep(2500);
await openKind(page,'identity-backup');await sleep(1500);
const r=await page.evaluate(()=>{const p=document.querySelector('.identity-continuity [data-identity-status]');if(!p)return null;const s=document.querySelector('.identity-continuity .community-scroll');s.scrollTop=s.scrollHeight;document.activeElement?.blur?.();const b=p.getBoundingClientRect(),cs=getComputedStyle(p);return {h:b.height,border:cs.borderTopStyle};});
await sleep(400);
await page.screenshot({path:globalThis.OUT});
return r;
