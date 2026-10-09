const out={};
for (const vp of ['w390','w768','w1440']) {
  await drop(vp);
  const {page}=await get(vp);
  const q=()=>page.evaluate(()=>{const s=window.__SPACE_EVENT_QA__?.();const c=document.querySelector('#world canvas').getBoundingClientRect();return {people:s?.camera?.scene?.peopleCount,style:s?.camera?.scene?.renderStyle,view:s?.camera?.view,cam:s?.camera?.camera&&{p:s.camera.camera.position.map(n=>+n.toFixed(2)),t:s.camera.camera.target.map(n=>+n.toFixed(2)),aspect:+s.camera.camera.aspect.toFixed(3)},canvas:[Math.round(c.left),Math.round(c.top),Math.round(c.width),Math.round(c.height)],stage:document.querySelector('.frame')?.dataset.stage,members:(s?.members||[]).length};});
  out[vp]={lobby:await q()};
  await page.screenshot({path:`/tmp/space-doodle/fix/3d/probe-lobby-${vp}.png`});
  await L.enter(page);
  await sleep(1500);
  out[vp].room=await q();
  await page.screenshot({path:`/tmp/space-doodle/fix/3d/probe-room-${vp}.png`});
}
return out;
