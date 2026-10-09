const {page}=await get('phone',true);
await sleep(2500);
const s=await shot(page,'p01-landing');
return {s, buttons: await L.visibleButtons(page), text: await L.visibleText(page), errors: page.__errors};
