const {page}=await get('phone');
const log=[];
await openKind(page,'conversation');await sleep(2000);
const join=page.locator('.community-panel form[data-group-join]');
if(await join.count()){await join.locator('input[name=consent]').check();await join.locator('button[type=submit]').click();await sleep(2500);}
log.push(await page.evaluate(()=>({active:document.activeElement?.outerHTML?.slice(0,60)})));
await page.evaluate(()=>document.activeElement?.blur?.());
await page.locator('.community-panel [data-group-worldcup]').first().click();await sleep(2500);
log.push(await page.evaluate(()=>({open:[...document.querySelectorAll('.community-panel,.private-chat,#panel')].filter(x=>!x.hidden).map(x=>x.className||x.id)})));
return log;
