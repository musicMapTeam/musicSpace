const L=require('./lib.cjs');L.watchdog(100);
(async()=>{const b=await L.launch();for(const kind of ['phone','desktop']){const {page}=await L.open(b,kind);
const has=await page.evaluate(()=>typeof window.__SPACE_RESCUE__);console.log(kind,'rescue',has);
if(has==='object'){await page.evaluate(()=>window.__SPACE_RESCUE__.show('timeout'));await L.sleep(500);await page.screenshot({path:L.OUT+'/g-rescue-'+kind+'.png'});}
const fav=await page.evaluate(()=>document.querySelector('link[rel=icon]')?.href.slice(0,400));console.log('favicon',fav);}
await b.close();})();
