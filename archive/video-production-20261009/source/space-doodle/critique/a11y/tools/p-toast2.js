const vp='w320';
const {page}=pages[vp];
await L.closeEverything(page);
const ppl=await L.people(page);const xm=ppl.find(p=>p.label.includes('小满'))||ppl[1];
await L.openKind(page,'person',xm.id);await sleep(800);
const greet=page.locator('#panel-body [data-social-send]');if(await greet.count())await greet.first().click();
await sleep(300);
await page.locator('#social-inbox').click();await sleep(700);
const info=await page.evaluate(()=>{const t=document.querySelector('#toast');const r=t.getBoundingClientRect();
 const close=document.querySelector('#panel-close');const cr=close.getBoundingClientRect();
 const hits=[];for(const [fx,fy] of [[0.5,0.2],[0.5,0.5],[0.5,0.8],[0.2,0.5],[0.8,0.5]]){const x=cr.left+cr.width*fx,y=cr.top+cr.height*fy;const h=document.elementFromPoint(x,y);hits.push([fx,fy,h&&(h.id||h.className)]);}
 const eb=document.querySelector('#panel-body .eyebrow');const er=eb&&eb.getBoundingClientRect();
 return {toastVisible:t.classList.contains('visible'),toast:[r.left,r.top,r.right,r.bottom].map(Math.round),close:[cr.left,cr.top,cr.right,cr.bottom].map(Math.round),hits,eyebrow:er&&[er.left,er.top,er.right,er.bottom].map(Math.round)};});
await page.screenshot({path:'/tmp/space-doodle/critique/a11y/evidence/w320-toast-over-inbox-close.png'});
const c=info.close;await page.mouse.click((c[0]+c[2])/2,(c[1]+c[3])/2);await sleep(500);
info.closedByCentreTap=await page.evaluate(()=>document.querySelector('#panel').hidden);
return info;
