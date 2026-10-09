const {page}=await get('phone');
const out={};
await page.locator('#panel [data-open="memory-card"]').first().click(); await sleep(2500);
out.mc0=await shot(page,'p28-memory-card-form');
out.t=(await L.visibleText(page,'#panel')).slice(0,1800);
out.btns=(await L.visibleButtons(page)).filter(b=>!b.includes('data-view')&&!b.includes('scene-target')).slice(0,40);
out.inputs=await page.evaluate(()=>[...document.querySelectorAll('#panel input, #panel select, #panel textarea')].map(e=>e.tagName+' '+e.name+' '+e.type+' '+(e.value||'')+' '+(e.checked?'checked':'')));
return out;
