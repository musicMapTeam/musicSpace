const {page}=await get('phone');
const out={};
for(let i=0;i<3;i++){await page.keyboard.press('Escape').catch(()=>{});await sleep(150);}
await page.evaluate(()=>{const c=document.querySelector('#panel-close');if(c&&!document.querySelector('#panel').hidden)c.click();});
await sleep(500);
await page.locator('#scene-details').click(); await sleep(1200);
await page.locator('#panel [data-open="conversation"]').first().click(); await sleep(2500);
out.avatars=await page.evaluate(()=>[...document.querySelectorAll('.community-panel svg, .community-panel img')].slice(0,12).map(e=>{const r=e.getBoundingClientRect();const msg=e.closest('article,li,div');return e.tagName+' '+(e.getAttribute('viewBox')||e.getAttribute('src')?.slice(0,40)||'')+' '+Math.round(r.width)+'x'+Math.round(r.height)+' | '+(msg?.innerText||'').slice(0,20).replace(/\n/g,' ');}));
return out;
