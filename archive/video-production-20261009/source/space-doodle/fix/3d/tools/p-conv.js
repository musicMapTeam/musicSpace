const out={};
for (const [w,h] of [[1440,900],[1920,970]]) {
  const key='c'+w;
  await drop(key);
  const r=await get('w1440',{key});
  const page=r.page; await page.setViewportSize({width:w,height:h}); await sleep(800);
  await L.enter(page); await sleep(2000);
  const m=()=>page.evaluate(()=>{const R=e=>{if(!e||!e.getClientRects().length)return null;const r=e.getBoundingClientRect();return [Math.round(r.left),Math.round(r.top),Math.round(r.right),Math.round(r.bottom)];};const p=document.querySelector('.presence');return {canvas:R(document.querySelector('#world canvas')),presence:R(p),presenceVis:p&&getComputedStyle(p).visibility,frameCls:document.querySelector('.frame').className,tags:[...document.querySelectorAll('#hotspots .hotspot')].filter(n=>!n.hidden).map(n=>({t:n.textContent.trim().slice(0,12),r:R(n)}))};});
  out[key]={room:await m()};
  await L.openKind(page,'conversation');
  await sleep(1500);
  out[key].conv=await m();
  await page.screenshot({path:`/tmp/space-doodle/fix/3d/probe-conv-${w}.png`});
}
return out;
