const vp='w320';
await drop(vp);
const {page}=await get(vp);
await L.enter(page);
const skip=page.locator('button:visible',{hasText:'跳过路线'});if(await skip.count())await skip.first().click().catch(()=>{});
await sleep(800);
const ppl=await L.people(page);const ayao=ppl.find(p=>p.label.includes('阿遥'))||ppl[0];
await L.openKind(page,'person',ayao.id);await sleep(800);
const greet=page.locator('#panel-body [data-social-send]');await greet.first().click();
await sleep(400);
const info=await page.evaluate(()=>{const t=document.querySelector('#toast');const cs=getComputedStyle(t);const r=t.getBoundingClientRect();
 const close=document.querySelector('#panel-close');const cr=close.getBoundingClientRect();
 const hits=[];for(const [fx,fy] of [[0.5,0.2],[0.5,0.5],[0.5,0.8],[0.2,0.5],[0.8,0.5]]){const x=cr.left+cr.width*fx,y=cr.top+cr.height*fy;const h=document.elementFromPoint(x,y);hits.push([fx,fy,h&&(h.id||h.className)]);}
 return {toast:{text:t.textContent,visible:t.classList.contains('visible'),pe:cs.pointerEvents,z:cs.zIndex,rect:[r.left,r.top,r.right,r.bottom].map(Math.round),opacity:cs.opacity,vis:cs.visibility},close:{rect:[cr.left,cr.top,cr.right,cr.bottom].map(Math.round)},hits};});
await page.screenshot({path:'/tmp/space-doodle/critique/a11y/evidence/w320-toast-over-close.png'});
// try a real tap on the close button centre
let closedByTap=null;
try{await page.mouse.click(info.close.rect[0]+ (info.close.rect[2]-info.close.rect[0])/2, info.close.rect[1]+(info.close.rect[3]-info.close.rect[1])/2);await sleep(500);closedByTap=await page.evaluate(()=>document.querySelector('#panel').hidden);}catch(e){closedByTap='err '+e.message}
return {...info,closedByTap};
