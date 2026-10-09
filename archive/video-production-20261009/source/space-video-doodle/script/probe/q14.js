const {page}=await get('phone');
const out={};
await page.locator('[data-person]',{hasText:'小满'}).first().click(); await sleep(1800);
out.person=await shot(page,'p15-person-xiaoman');
out.text=(await L.visibleText(page,'#panel'));
out.btns=(await L.visibleButtons(page)).filter(b=>!b.includes('data-view')&&!b.includes('scene-target')).slice(0,30);
return out;
