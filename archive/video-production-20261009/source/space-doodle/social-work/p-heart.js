const {page}=await get('phone');
await closeEverything(page);
await page.evaluate(()=>{for(const b of document.querySelectorAll('.community-panel:not([hidden])>header>button'))if(b.getClientRects().length)b.click();});await sleep(500);
await openKind(page,'friends');await sleep(1200);
return await page.evaluate(()=>{const b=document.querySelector('#panel-body .entry-list>button[data-open="person"]');if(!b)return 'no friend rows: '+document.querySelector('#panel-body')?.textContent.slice(0,100);const a=getComputedStyle(b,'::after'),bf=getComputedStyle(b,'::before');return {after:{content:a.content,pos:a.position,w:a.width},before:{content:bf.content,bg:bf.backgroundColor}};});
