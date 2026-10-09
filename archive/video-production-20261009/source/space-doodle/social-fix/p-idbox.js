const kind=globalThis.KIND||'desktop';const {page}=await get(kind);
await page.goto(L.URL,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__SPACE_BOOT__==='ready',null,{timeout:90000});await sleep(1500);
await openKind(page,'identity-backup');await sleep(1500);
const info=await page.evaluate(()=>{const p=document.querySelector('.identity-continuity [data-identity-status]');if(!p)return {missing:true,open:!!document.querySelector('.identity-continuity:not([hidden])')};const r=p.getBoundingClientRect(),cs=getComputedStyle(p);p.scrollIntoView({block:'center'});return {text:p.textContent,h:r.height,w:r.width,border:cs.borderTopStyle+' '+cs.borderTopWidth,pad:cs.padding,margin:cs.margin,bg:cs.backgroundColor,display:cs.display};});
await sleep(300);
const box=await page.locator('.identity-continuity').boundingBox().catch(()=>null);
await page.screenshot({path:`/tmp/space-doodle/social-fix/now/idbox-${kind}.png`});
return {info,box};
