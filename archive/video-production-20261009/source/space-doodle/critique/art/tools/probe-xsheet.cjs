const L=require('./lib.cjs');L.watchdog(200);
(async()=>{const b=await L.launch();const {page}=await L.open(b,'desktop');await L.enter(page);
await page.click('[data-tour-action="sample:sample-crowd"]');await page.waitForSelector('form[data-form="upload"] .photo-review',{timeout:30000});
try{await page.waitForSelector('form[data-form="upload"] .moment-chip.is-ai, form[data-form="upload"] .moment-ai-tag',{timeout:45000});}catch{}
const hasView=await page.evaluate(()=>Boolean(document.querySelector('form[data-form="upload"] .moment-chip[aria-pressed="true"]')));if(!hasView)await page.click('form[data-form="upload"] .moment-chip[data-moment-viewpoint="crowd"]');
await page.click('form[data-form="upload"] button[type="submit"]');
await page.waitForSelector('[data-moment-badge] [data-exchange-offer]',{timeout:30000});await L.sleep(800);
await page.click('[data-moment-badge] [data-exchange-offer]');await page.waitForSelector('.photo-exchanges:not([hidden]) .exchange-pair',{timeout:20000});await L.sleep(1200);
const r=await page.evaluate(()=>{const R=e=>{if(!e)return null;const b=e.getBoundingClientRect();return [b.left,b.top,b.right,b.bottom].map(Math.round)};const p=document.querySelector('.presence'),x=document.querySelector('.photo-exchanges'),pn=document.querySelector('#panel');
return {presence:R(p),presenceVis:getComputedStyle(p).visibility,presenceParent:p.parentElement.className,xsheet:R(x),xParent:x.parentElement.className,panelHidden:pn.hidden,panel:R(pn),tour:document.querySelector('.demo-tour')?.hidden};});
console.log(JSON.stringify(r));
await page.screenshot({path:L.OUT+'/g-xsheet-desktop.png'});
await b.close();})();
