const {page}=await get('phone');
const info=await page.evaluate(()=>{const b=document.querySelector('#music-map-entry');return b?{text:b.textContent.trim(),visible:!!b.getClientRects().length,tag:b.tagName,href:b.getAttribute('href'),open:b.dataset.open}:null;});
await page.locator('#music-map-entry').click();
await sleep(3000);
await page.screenshot({path:'/tmp/space-doodle/social-work/now/probe-map-phone.png'});
const after=await page.evaluate(()=>({url:location.href,mapSection:[...document.querySelectorAll('.music-map,[class*=map]')].filter(n=>n.getClientRects().length).map(n=>n.className).slice(0,10),stage:document.querySelector('.frame')?.dataset.stage}));
return {info,after};
