const L=require('./lib.cjs');L.watchdog(200);
(async()=>{const b=await L.launch();for(const kind of ['desktop','phone']){const {page}=await L.open(b,kind);await L.enter(page);
await page.click('[data-tour-action="sample:sample-crowd"]');await page.waitForSelector('form[data-form="upload"] .photo-review',{timeout:30000});
for(const t of [300,1500,6000]){await L.sleep(t===300?300:t-300);const r=await page.evaluate(()=>{const p=document.querySelector('#panel');const c=document.querySelector('#panel-close');const cb=c.getBoundingClientRect();const pb=p.getBoundingClientRect();const h=p.querySelector('h2');const hb=h&&h.getBoundingClientRect();return {scrollTop:Math.round(p.scrollTop),panelTop:Math.round(pb.top),closeTop:Math.round(cb.top),closeVisible:cb.bottom>pb.top+2,h2Top:hb&&Math.round(hb.top),ai:!!document.querySelector('form[data-form="upload"] .moment-chip.is-ai, form[data-form="upload"] .moment-ai-tag')};});console.log(kind,t,JSON.stringify(r));}
await page.screenshot({path:L.OUT+'/g-upload-asis-'+kind+'.png'});}
await b.close();})();
