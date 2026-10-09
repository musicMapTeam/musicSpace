const {page}=await get('phone');
const out={};
out.s=await shot(page,'p27-state');
out.btns=(await L.visibleButtons(page)).filter(b=>!b.includes('data-view')&&!b.includes('scene-target')).slice(0,40);
return out;
