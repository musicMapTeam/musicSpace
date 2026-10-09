const {page}=await get('phone');
const out={};
await page.locator('[data-tour-action="sample:sample-crowd"]').click();
const t0=Date.now();
await page.waitForSelector('form[data-form="upload"]',{timeout:30000});
out.formMs=Date.now()-t0;
await sleep(200); out.s0=await shot(page,'p08-upload-0s');
// wait for AI tag
try{ await page.waitForSelector('.moment-ai-tag',{timeout:20000}); out.aiMs=Date.now()-t0; }catch(e){ out.aiErr=e.message.slice(0,100); }
await sleep(400); out.s1=await shot(page,'p08-upload-ai');
out.text=await L.visibleText(page,'#panel');
out.btns=(await L.visibleButtons(page)).filter(b=>!b.includes('data-view')).slice(0,40);
// scroll to the end of the form
await page.evaluate(()=>{const p=document.querySelector('#panel-body')||document.querySelector('#panel');p.scrollTop=99999;});
await sleep(500); out.s2=await shot(page,'p08-upload-end');
out.text2=await L.visibleText(page,'#panel');
return out;
