const {page}=await get('phone');
const out={};
await page.locator('[data-tour-skip]').click().catch(()=>{}); await sleep(600);
await page.locator('#scene-details').click(); await sleep(1500);
out.roomPanel=await shot(page,'p19-room-panel');
out.text=await L.visibleText(page,'#panel');
out.btns=(await L.visibleButtons(page)).filter(b=>!b.includes('data-view')&&!b.includes('scene-target')).slice(0,40);
return out;
