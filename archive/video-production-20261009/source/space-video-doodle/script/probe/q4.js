const {page}=await get('phone');
const out={};
const sum=page.locator('text=试试组合示例').first();
out.sumTag=await sum.evaluate(e=>e.tagName+' '+e.outerHTML.slice(0,200));
await sum.click(); await sleep(600);
out.afterOpen=await shot(page,'p04-wardrobe-presets-open');
for (const p of [1,3,5]) {
  const b=page.locator(`[data-preset="${p}"]`);
  await b.scrollIntoViewIfNeeded(); await b.click(); await sleep(600);
  await page.evaluate(()=>{const s=document.querySelector('.wardrobe .wardrobe-body, .wardrobe [class*=scroll]'); if(s) s.scrollTop=0;});
  out['preset'+p]=await shot(page,`p04-wardrobe-preset${p}`);
}
return out;
