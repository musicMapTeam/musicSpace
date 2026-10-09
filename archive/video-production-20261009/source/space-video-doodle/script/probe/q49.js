const {page}=await get('phone');
const out={};
for(let i=0;i<3;i++){await page.keyboard.press('Escape').catch(()=>{});await sleep(150);}
await page.evaluate(()=>{const c=document.querySelector('#panel-close');if(c&&!document.querySelector('#panel').hidden)c.click();});
await sleep(500);
await page.locator('#my-look').click(); await sleep(2000);
out.svgs=await page.evaluate(()=>[...document.querySelectorAll('.wardrobe svg')].map(s=>{const r=s.getBoundingClientRect();return (s.closest('[class]')?.className||'')+' | '+s.getAttribute('viewBox')+' | '+Math.round(r.width)+'x'+Math.round(r.height)+' | len '+s.outerHTML.length;}).slice(0,8));
out.stageSel=await page.evaluate(()=>{const s=[...document.querySelectorAll('.wardrobe svg')].sort((a,b)=>b.getBoundingClientRect().height-a.getBoundingClientRect().height)[0];let p=s;const chain=[];for(let i=0;i<4&&p;i++){chain.push(p.tagName+'.'+String(p.className&&p.className.baseVal!==undefined?p.className.baseVal:p.className));p=p.parentElement;}return chain;});
await page.locator('[data-wardrobe-close]').first().click().catch(()=>{}); await sleep(600);
return out;
