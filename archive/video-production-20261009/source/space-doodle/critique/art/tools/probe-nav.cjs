const L=require('./lib.cjs');L.watchdog(120);
(async()=>{const b=await L.launch();for(const kind of ['desktop','phone']){const {page}=await L.open(b,kind);await L.enter(page);
const r=await page.evaluate(()=>[...document.querySelectorAll('nav.camera-nav button')].map(x=>{const c=getComputedStyle(x);const bb=x.getBoundingClientRect();return {t:x.textContent.trim(),fs:c.fontSize,ff:c.fontFamily.split(',')[0],bg:c.backgroundColor,br:c.borderRadius.slice(0,30),sh:c.boxShadow,tr:c.transform,h:Math.round(bb.height),w:Math.round(bb.width)}}));
console.log(kind,JSON.stringify(r,null,0));}
await b.close();})();
