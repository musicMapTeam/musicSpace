const {page}=await get('phone');
const out={};
await page.locator('[data-open="conversation"]').first().click(); await sleep(2500);
out.conv0=await shot(page,'p20-conversation-join');
out.text0=await L.visibleText(page,'.community-panel');
const join=page.locator('.community-panel form[data-group-join]');
if(await join.count()){await join.locator('input[name=consent]').check();await sleep(200);out.joinShot=await shot(page,'p20-conversation-join-checked');await join.locator('button[type=submit]').click();await sleep(2500);}
out.conv1=await shot(page,'p20-conversation');
out.text1=await L.visibleText(page,'.community-panel');
out.btns=(await L.visibleButtons(page)).filter(b=>!b.includes('data-view')&&!b.includes('scene-target')).slice(0,40);
return out;
