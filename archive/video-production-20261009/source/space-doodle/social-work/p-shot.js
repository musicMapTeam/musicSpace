// globalThis.KIND, globalThis.OPEN=[kind,id], globalThis.NAME, globalThis.SCROLL (selector to scroll to end)
const kind=globalThis.KIND||'phone';const {page}=await get(kind);
await closeEverything(page);
await page.evaluate(()=>{for(const sel of ['.wardrobe:not([hidden]) .wardrobe-header>button','.private-chat:not([hidden]) .chat-close','.community-panel:not([hidden])>header>button','#panel:not([hidden]) #panel-close','.room-moderation:not([hidden]) header>button']){const b=document.querySelector(sel);if(b&&b.getClientRects().length)b.click();}});await sleep(400);
if(globalThis.OPEN){await openKind(page,globalThis.OPEN[0],globalThis.OPEN[1]);await sleep(globalThis.WAIT||1500);}
if(globalThis.SCROLL){await page.evaluate(s=>{const n=document.querySelector(s);if(n)n.scrollTop=n.scrollHeight;},globalThis.SCROLL);await sleep(300);}
await page.evaluate(()=>document.activeElement?.blur?.());
await page.screenshot({path:`/tmp/space-doodle/social-work/now/probe-${globalThis.NAME||'shot'}-${kind}.png`});
return 'ok';
