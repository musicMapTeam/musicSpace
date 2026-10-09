const {page}=await get('phone');
const out={};
await page.locator('[data-corner-close]').click().catch(()=>{}); await sleep(1000);
await page.locator('#my-space').click(); await sleep(2500);
out.personal=await shot(page,'p32-my-space');
out.t=(await L.visibleText(page,'body')).split('\n').slice(-45).join(' | ');
out.btns=(await L.visibleButtons(page)).filter(b=>!b.includes('data-view')&&!b.includes('scene-target')).slice(0,40);
return out;
