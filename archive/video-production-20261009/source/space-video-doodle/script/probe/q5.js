const {page}=await get('phone');
const out={};
// type a nickname in the wardrobe
const nick=page.locator('.wardrobe input').first();
out.nickInfo=await nick.evaluate(e=>e.outerHTML.slice(0,200));
await nick.fill('阿宁');
await page.locator('[data-wardrobe-save]').click(); await sleep(1500);
out.afterSave=await shot(page,'p05-after-wardrobe-save');
out.text=await L.visibleText(page,'#panel');
out.btns=(await L.visibleButtons(page)).slice(0,30);
return out;
