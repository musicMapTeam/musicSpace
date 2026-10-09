const vp='w1440';
await drop(vp);
const {page}=await get(vp);
await L.enter(page);
await sleep(2500);
const measure=async(label)=>page.evaluate((label)=>{
  const pr=document.querySelector('.presence').getBoundingClientRect();
  const tour=document.querySelector('#demo-tour');const tr=tour&&!tour.hidden?tour.getBoundingClientRect():null;
  const tags=[...document.querySelectorAll('#hotspots .hotspot')].filter(n=>!n.hidden&&n.getClientRects().length).map(n=>{const r=n.getBoundingClientRect();const ov=Math.max(0,Math.min(r.right,pr.right)-Math.max(r.left,pr.left))*Math.max(0,Math.min(r.bottom,pr.bottom)-Math.max(r.top,pr.top));return {label:n.textContent.trim(),x:[Math.round(r.left),Math.round(r.right)],y:[Math.round(r.top),Math.round(r.bottom)],coveredPct:Math.round(ov/(r.width*r.height)*100)};});
  return {label,presence:[Math.round(pr.left),Math.round(pr.top),Math.round(pr.right),Math.round(pr.bottom)],tour:tr&&[Math.round(tr.left),Math.round(tr.top),Math.round(tr.right),Math.round(tr.bottom)],tags};
},label);
const a=await measure('after-enter');
await page.screenshot({path:'/tmp/space-doodle/critique/a11y/evidence/w1440-presence-cover.png'});
const skip=page.locator('[data-tour-skip]');if(await skip.count()){await skip.first().click();await sleep(1500);}
const b=await measure('tour-skipped');
await page.screenshot({path:'/tmp/space-doodle/critique/a11y/evidence/w1440-presence-cover-skipped.png'});
return [a,b];
