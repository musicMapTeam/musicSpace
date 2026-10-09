const {page}=await get('phone');
const out={};
await page.locator('[data-x-consent]').check();
await sleep(300);
out.checked=await shot(page,'p13-exchange-checked');
const t0=Date.now();
await page.locator('[data-x-send]').click();
await sleep(600); out.pending=await shot(page,'p13-exchange-pending');
out.pendingText=(await L.visibleText(page,'body')).split('\n').slice(-30).join(' | ');
for(let i=0;i<40;i++){ const ok=await page.evaluate(()=>/交换已接受/.test(document.body.innerText)); if(ok){out.acceptedMs=Date.now()-t0;break;} await sleep(250);}
await sleep(500); out.accepted=await shot(page,'p13-exchange-accepted');
out.btns=(await L.visibleButtons(page)).filter(b=>!b.includes('data-view')).slice(0,40);
return out;
