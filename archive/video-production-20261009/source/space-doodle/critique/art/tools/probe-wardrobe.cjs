const L=require('./lib.cjs');L.watchdog(120);
(async()=>{const b=await L.launch();const {page}=await L.open(b,'desktop');await L.enter(page);
await page.click('#my-look');await L.sleep(2500);
const r=await page.evaluate(()=>{const pick=s=>{const e=document.querySelector(s);if(!e)return null;const c=getComputedStyle(e);return s+' '+c.fontSize+' '+c.fontFamily.split(',')[0];};
return ['.wardrobe .wardrobe-header .eyebrow','.wardrobe .wardrobe-header h2','.wardrobe label','.wardrobe .wardrobe-tabs button','.wardrobe .wardrobe-options button','.wardrobe .wardrobe-options button b','.wardrobe .wardrobe-options button span','.wardrobe .wardrobe-tools footer button','.wardrobe summary','.wardrobe .wardrobe-tools p','.wardrobe .wardrobe-tools small','.wardrobe h3'].map(pick).filter(Boolean);});
console.log(r.join('\n'));
const heads=await page.evaluate(()=>[...document.querySelectorAll('.wardrobe *')].filter(e=>e.children.length===0&&e.textContent.trim()&&e.getClientRects().length).slice(0,40).map(e=>e.tagName+'.'+e.className+' '+getComputedStyle(e).fontSize+' «'+e.textContent.trim().slice(0,14)+'»'));
console.log(heads.join('\n'));
await b.close();})();
