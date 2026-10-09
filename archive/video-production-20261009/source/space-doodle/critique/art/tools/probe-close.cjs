const L=require('./lib.cjs');L.watchdog(150);
(async()=>{const b=await L.launch();const {page}=await L.open(b,'phone');await L.enter(page);
await L.openKind(page,'about');await L.sleep(800);
const r=await page.evaluate(()=>{const p=document.querySelector('#panel'),c=document.querySelector('#panel-close');const cs=getComputedStyle(c);p.scrollTop=400;const cb=c.getBoundingClientRect(),pb=p.getBoundingClientRect();return {pos:cs.position,overflowY:getComputedStyle(p).overflowY,closeTopAfterScroll:Math.round(cb.top),panelTop:Math.round(pb.top),hidden:cb.bottom<pb.top};});
console.log(JSON.stringify(r));await L.sleep(300);await page.screenshot({path:L.OUT+'/g-about-scrolled-phone.png'});
await b.close();})();
