const {page}=await get('phone');
const out={};
out.forms=await page.evaluate(()=>[...document.querySelectorAll('.music-games form')].map(f=>f.outerHTML.slice(0,600)));
out.btns=(await L.visibleButtons(page)).filter(b=>!b.includes('data-view')).slice(-25);
return out;
