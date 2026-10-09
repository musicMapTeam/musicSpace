const {page,ctx}=await get('phone');
const out={};
await page.locator('#panel input[name="memory-photo"]').check();
await page.locator('#panel input[name="memory-avatar"]').check();
await page.locator('#panel input[name="memory-confirm"]').check();
await sleep(300);
out.checked=await shot(page,'p29-memory-checked');
const dl=page.waitForEvent('download',{timeout:20000}).catch(e=>null);
await page.locator('#panel button',{hasText:'下载纪念卡 PNG'}).click();
const d=await dl;
if(d){ const p='/tmp/space-video-doodle/script/probe/shots/memory-card-export.png'; await d.saveAs(p); out.download=p; out.suggested=d.suggestedFilename(); }
await sleep(2500);
out.after=await shot(page,'p29-memory-after');
out.t=(await L.visibleText(page,'#panel')).slice(0,1200);
out.btns=(await L.visibleButtons(page)).filter(b=>!b.includes('data-view')&&!b.includes('scene-target')).slice(0,30);
return out;
