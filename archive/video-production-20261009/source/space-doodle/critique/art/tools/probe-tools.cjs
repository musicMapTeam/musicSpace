const L=require('./lib.cjs');L.watchdog(150);
(async()=>{const b=await L.launch();const {page}=await L.open(b,'desktop');await L.enter(page);
await L.openKind(page,'conversation');await L.sleep(1500);
const join=page.locator('.community-panel form[data-group-join]');if(await join.count()){await join.locator('input[name=consent]').check();await join.locator('button[type=submit]').click();await L.sleep(2500);}
const r=await page.evaluate(()=>[...document.querySelectorAll('.conversation-actions button')].map(x=>x.textContent.trim()+' | '+getComputedStyle(x).backgroundColor));
console.log(r.join('\n'));
await page.evaluate(()=>{const a=document.querySelector('.conversation-actions');if(a)a.scrollLeft=400;});await L.sleep(400);
await page.screenshot({path:L.OUT+'/g-tools-desktop.png',clip:{x:1000,y:220,width:420,height:80}});
await b.close();})();
