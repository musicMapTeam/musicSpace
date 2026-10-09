const L=require('./lib.cjs');L.watchdog(150);
(async()=>{const b=await L.launch();const {page}=await L.open(b,'desktop');await L.enter(page);
for(let i=0;i<6;i++){const s=await page.evaluate(()=>{const q=window.__SPACE_EVENT_QA__?.();const sc=q?.camera?.scene||{};return {members:q.members.map(m=>m.name),keys:Object.keys(sc),people:sc.people||sc.livePeople||null,tags:[...document.querySelectorAll('#hotspots .hotspot')].map(h=>h.textContent.trim()+(h.hidden?'(hidden)':''))};});console.log(i,JSON.stringify(s).slice(0,900));await L.sleep(4000);}
await page.click('[data-tour-skip]').catch(()=>{});await L.sleep(2500);
await page.screenshot({path:L.OUT+'/e-people-after-skip-desktop.png'});
await b.close();})();
