const L=require('./lib.cjs');L.watchdog(120);
(async()=>{const b=await L.launch();for(const kind of ['phone','desktop']){const {page}=await L.open(b,kind);await L.enter(page);
const skip=page.locator('button:visible',{hasText:'跳过路线'});if(await skip.count())await skip.first().click().catch(()=>{});
const ppl=await L.people(page);await L.openKind(page,'person',ppl[0].id);await L.sleep(800);
const r=await page.evaluate(()=>{const p=document.querySelector('#panel');const c=getComputedStyle(p);const h2=p.querySelector('h2');const f=p.querySelector('.fine');const q=p.querySelector('.quiet');const card=p.getBoundingClientRect();
return {kind:p.dataset.kind,borderTop:c.borderTopColor+' '+c.borderTopWidth,shadow:c.boxShadow,maxH:c.maxHeight,rect:[card.left,card.top,card.right,card.bottom].map(Math.round),h2:h2&&getComputedStyle(h2).fontSize,fine:f&&getComputedStyle(f).fontSize,quiet:q&&getComputedStyle(q).fontSize,scroll:[p.scrollHeight,p.clientHeight]};});
console.log(kind,JSON.stringify(r));
await page.screenshot({path:L.OUT+'/g-person-'+kind+'.png'});
}
await b.close();})();
