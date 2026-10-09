const L=require('./lib.cjs');L.watchdog(200);
(async()=>{const b=await L.launch();for(const kind of ['phone','desktop']){const ctx=await b.newContext({...L.VP[kind]});const page=await ctx.newPage();
await page.goto('http://127.0.0.1:5477/musicSpace/',{waitUntil:'domcontentloaded'});
await L.ready(page);
console.log(kind,'channel',await page.evaluate(()=>document.documentElement.dataset.channel));
await page.screenshot({path:L.OUT+'/h-prod-first-'+kind+'.png'});
await ctx.close();}
await b.close();})();
