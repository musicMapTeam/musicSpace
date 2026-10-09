const {page}=await get('phone');
const out={};
const scroller=await page.evaluate(()=>{const c=['#panel-body','#panel'];for(const s of c){const e=document.querySelector(s);if(e&&e.scrollHeight>e.clientHeight+5)return s;}return null;});
out.scroller=scroller;
for (const y of [700, 1300, 1900]) {
  await page.evaluate(([s,y])=>{document.querySelector(s).scrollTop=y;},[scroller,y]); await sleep(400);
  out['y'+y]=await shot(page,`p11-wall-y${y}`);
}
await page.evaluate(([s])=>{document.querySelector(s).scrollTop=0;},[scroller]); await sleep(300);
return out;
