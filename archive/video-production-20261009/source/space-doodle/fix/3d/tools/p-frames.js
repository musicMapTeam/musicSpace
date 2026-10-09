// args via globalThis.ARGS: list of [w,h,label]
const sizes=[[1440,900],[1440,790],[1536,730],[1280,720],[1920,970],[768,1024],[744,1133],[390,844]];
const out={};
const measure=page=>page.evaluate(()=>{const R=e=>{if(!e||!e.getClientRects().length)return null;const r=e.getBoundingClientRect();return [Math.round(r.left),Math.round(r.top),Math.round(r.right),Math.round(r.bottom)];};
 const s=window.__SPACE_EVENT_QA__?.();const p=document.querySelector('.presence');const pr=R(p);
 const tags=[...document.querySelectorAll('#hotspots .hotspot')].filter(n=>!n.hidden&&n.getClientRects().length).map(n=>{const r=R(n);const ov=pr?Math.max(0,Math.min(r[2],pr[2])-Math.max(r[0],pr[0]))*Math.max(0,Math.min(r[3],pr[3])-Math.max(r[1],pr[1])):0;return {t:n.textContent.trim().slice(0,10),r,ov};});
 return {people:s?.camera?.scene?.peopleCount,style:s?.camera?.scene?.renderStyle,cam:s?.camera?.camera&&{p:s.camera.camera.position.map(n=>+n.toFixed(2)),t:s.camera.camera.target.map(n=>+n.toFixed(2)),aspect:+s.camera.camera.aspect.toFixed(3)},canvas:R(document.querySelector('#world canvas')),presence:pr,tags,hidden:[...document.querySelectorAll('#hotspots .hotspot')].filter(n=>n.hidden).map(n=>n.textContent.trim().slice(0,10))};});
for(const [w,h] of sizes){
  const key='f'+w+'x'+h; await drop(key);
  const vp=w<700?'w390':w<1000?'w768':'w1440';
  const {page}=await get(vp,{key});
  await page.setViewportSize({width:w,height:h}); await sleep(1200);
  const tag=`${w}x${h}`;
  out[tag]={lobby:await measure(page)};
  await page.screenshot({path:`/tmp/space-doodle/fix/3d/frames/${tag}-lobby.png`});
  await enter(page); await sleep(1500);
  out[tag].room4=await measure(page);
  await page.screenshot({path:`/tmp/space-doodle/fix/3d/frames/${tag}-room4.png`});
  // wait for the fifth member (林间) to join
  await page.waitForFunction(()=>(window.__SPACE_EVENT_QA__?.()?.camera?.scene?.peopleCount||0)>=5,null,{timeout:25000}).catch(()=>{});
  await sleep(1500);
  out[tag].room5=await measure(page);
  await page.screenshot({path:`/tmp/space-doodle/fix/3d/frames/${tag}-room5.png`});
  await drop(key);
}
return out;
