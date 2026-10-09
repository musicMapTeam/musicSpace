const out={};
const measure=page=>page.evaluate(()=>{const R=e=>{if(!e||!e.getClientRects().length)return null;const r=e.getBoundingClientRect();return [Math.round(r.left),Math.round(r.top),Math.round(r.right),Math.round(r.bottom)];};const pr=R(document.querySelector('.presence'));
 const tags=[...document.querySelectorAll('#hotspots .hotspot')].filter(n=>!n.hidden&&n.getClientRects().length).map(n=>{const r=R(n);const ov=pr?Math.max(0,Math.min(r[2],pr[2])-Math.max(r[0],pr[0]))*Math.max(0,Math.min(r[3],pr[3])-Math.max(r[1],pr[1])):0;return {t:n.textContent.trim().slice(0,8),r,ov};});
 return {presence:pr,people:window.__SPACE_EVENT_QA__?.()?.camera?.scene?.peopleCount,maxTagRight:Math.max(...tags.filter(t=>t.t!=='照片墙').map(t=>t.r[2])),covered:tags.filter(t=>t.ov>0).map(t=>t.t)};});
for (const [w,h] of [[1440,900],[1280,720]]) {
  const key='skip'+w; await drop(key);
  const {page}=await get('w1440',{key}); await page.setViewportSize({width:w,height:h}); await sleep(800);
  await enter(page); await sleep(800);
  const skip=page.locator('[data-tour-skip]'); if(await skip.count()) { await skip.first().click(); await sleep(1200); }
  out[`${w}x${h}-4`]=await measure(page);
  await page.screenshot({path:`/tmp/space-doodle/fix/3d/frames/${w}x${h}-skipped4.png`});
  await page.waitForFunction(()=>(window.__SPACE_EVENT_QA__?.()?.camera?.scene?.peopleCount||0)>=5,null,{timeout:25000}).catch(()=>{}); await sleep(1500);
  out[`${w}x${h}-5`]=await measure(page);
  await page.screenshot({path:`/tmp/space-doodle/fix/3d/frames/${w}x${h}-skipped5.png`});
  await drop(key);
}
return out;
