const L=require('./lib.cjs');L.watchdog(150);
(async()=>{const b=await L.launch();for(const kind of ['phone','desktop']){const {page}=await L.open(b,kind);await L.enter(page);
await page.click('[data-tour-action="sample:sample-crowd"]');await page.waitForSelector('form[data-form="upload"]',{timeout:30000});await L.sleep(1500);
const r=await page.evaluate(()=>{const R=e=>{const b=e.getBoundingClientRect();return [b.left,b.top,b.right,b.bottom].map(Math.round)};const p=document.querySelector('#panel'),w=document.querySelector('.world-shell');
const pb=getComputedStyle(p,'::before'),wb=getComputedStyle(w,'::before'),wa=getComputedStyle(w,'::after');
return {panel:R(p),world:R(w),panelBefore:[pb.top,pb.left,pb.width,pb.height,pb.backgroundColor],worldBefore:[wb.top,wb.left,wb.width],worldAfter:[wa.top,wa.right,wa.width],panelRadius:getComputedStyle(p).borderRadius,worldRadius:getComputedStyle(w).borderRadius};});
console.log(kind,JSON.stringify(r));}
await b.close();})();
