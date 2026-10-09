const out={};
const settle=async page=>{const t0=Date.now();await sleep(250);while(Date.now()-t0<6000){const m=await page.evaluate(()=>window.__SPACE_EVENT_QA__?.()?.camera?.moving);if(!m)break;await sleep(80);}await sleep(900);};
for (const [w,h] of (globalThis.SIZES||[[1440,900],[1280,720],[1920,970]])) {
  const key='wall'+w; await drop(key);
  const {page}=await get(w<700?'w390':'w1440',{key}); await page.setViewportSize({width:w,height:h}); await sleep(800);
  await enter(page);
  await page.click('nav.camera-nav button[data-view=photos]'); await settle(page);
  const s=await page.evaluate(()=>{const q=window.__SPACE_EVENT_QA__?.();return {photos:q?.photos?.length,cam:q?.camera?.camera&&{p:q.camera.camera.position.map(n=>+n.toFixed(2)),t:q.camera.camera.target.map(n=>+n.toFixed(2))}};});
  out[`${w}x${h}`]=s;
  await page.screenshot({path:`/tmp/space-doodle/fix/3d/wall/${w}x${h}-photos4.png`});
  await drop(key);
}
return out;
