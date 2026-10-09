const L=require('./lib.cjs');L.watchdog(150);
(async()=>{const b=await L.launch();for(const kind of ['phone','desktop']){const ctx=await b.newContext({...L.VP[kind]});const page=await ctx.newPage();
await page.goto('http://127.0.0.1:5477/musicSpace/',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.__SPACE_BOOT__==='ready',null,{timeout:90000}).catch(()=>console.log('not ready'));
await L.sleep(1500);
const has=await page.evaluate(()=>typeof window.__SPACE_RESCUE__);console.log(kind,'rescue',has);
// keep the overlay up: block the auto-hide poll by faking boot state
await page.evaluate(()=>{window.__SPACE_BOOT__='booting';window.__SPACE_RESCUE__.show('timeout');});await L.sleep(600);
await page.screenshot({path:L.OUT+'/g-rescue-'+kind+'.png'});
if(kind==='desktop'){await page.setContent('<body style="margin:0;background:#ddd;display:flex;gap:30px;padding:30px;font:14px sans-serif"><div><img src="'+await page.evaluate(()=>'')+'"></div></body>');}
await ctx.close();}
await b.close();})();
