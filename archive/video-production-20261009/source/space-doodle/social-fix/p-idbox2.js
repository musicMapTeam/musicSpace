const kind=globalThis.KIND;const {page}=await get(kind);
await closeEverything(page);
await page.evaluate(()=>{for(const sel of ['.wardrobe:not([hidden]) .wardrobe-header>button','.private-chat:not([hidden]) .chat-close','.community-panel:not([hidden])>header>button','#panel:not([hidden]) #panel-close']){const b=document.querySelector(sel);if(b&&b.getClientRects().length)b.click();}});await sleep(400);
await openKind(page,'identity-backup');await sleep(1500);
const st=await page.evaluate(()=>({stage:document.querySelector('.frame')?.dataset.stage,ic:!!document.querySelector('.identity-continuity'),open:!!document.querySelector('.identity-continuity:not([hidden])'),panels:[...document.querySelectorAll('.community-panel:not([hidden]),#panel:not([hidden])')].map(n=>n.className+'|'+(n.dataset.kind||''))}));
await page.screenshot({path:`/tmp/space-doodle/social-fix/now/idbox2-${kind}.png`});
return st;
