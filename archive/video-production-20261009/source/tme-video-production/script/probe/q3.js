const {page}=await get('phone');
await page.evaluate(()=>{const p=document.querySelector('#panel-body')||document.querySelector('#panel');p.scrollTop=0;});
await page.locator('form[data-form="demo-entry"] button',{hasText:'现在换个造型'}).click();
await sleep(2000);
const s1=await shot(page,'p03-wardrobe-from-entry');
const btns=await L.visibleButtons(page);
return {s1,btns:btns.slice(0,60)};
