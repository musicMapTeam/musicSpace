const vp=globalThis.VP||'w390';
await drop(vp);
const {page}=await get(vp,{reducedMotion:'reduce'});
await L.enter(page);
await sleep(1000);
await page.click('[data-tour-action="sample:sample-crowd"]');
await page.waitForSelector('form[data-form="upload"] .photo-review',{timeout:30000});
await sleep(1500);
await L.inject(page);
const stops=[];
await page.evaluate(()=>document.querySelector('#panel-close').focus());
for(let i=0;i<45;i++){
  await page.keyboard.press('Tab');await sleep(150);
  const s=await page.evaluate(()=>{const el=document.activeElement;if(!el||el===document.body)return {body:true};const r=el.getBoundingClientRect();const vw=innerWidth,vh=innerHeight;
    const cx=Math.min(vw-1,Math.max(0,(r.left+r.right)/2)),cy=Math.min(vh-1,Math.max(0,(r.top+r.bottom)/2));const h=document.elementFromPoint(cx,cy);
    const self=h&&(h===el||el.contains(h)||(el.labels&&[...el.labels].some(l=>l.contains(h))));
    const inView=r.bottom>0&&r.top<vh&&r.right>0&&r.left<vw;
    return {sel:window.__a11y.sel(el).slice(-70),text:(el.innerText||el.value||el.getAttribute('aria-label')||'').trim().slice(0,18),inPanel:!!el.closest('#panel'),inView,covered:inView&&!self,by:!self&&h?window.__a11y.sel(h).slice(-60):null};});
  stops.push(s);
  if(s.sel&&s.sel.includes('panel-close'))break;
}
const covered=stops.filter(s=>s.covered);
return {total:stops.length,covered:covered.length,coveredList:covered.map(s=>s.sel+' «'+s.text+'» by '+s.by),order:stops.map(s=>s.body?'BODY':(s.inPanel?'P ':'  ')+(s.covered?'[HIDDEN] ':'')+s.text)};
