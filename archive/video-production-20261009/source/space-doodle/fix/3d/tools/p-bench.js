const out={};
for (const [w,h] of [[1440,900],[1536,730]]) {
  const key='bench'+w; await drop(key);
  const {page}=await get('w1440',{key}); await page.setViewportSize({width:w,height:h}); await sleep(800);
  const errors=[];page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,200));});
  await enter(page); await sleep(1500);
  out[`${w}x${h}`]=await page.evaluate(()=>window.__SPACE_EVENT_QA__?.()?.camera?.scene?.renderStyle);
  await page.screenshot({path:`/tmp/space-doodle/fix/3d/wall/${w}x${h}-overview-bench.png`});
  await page.evaluate(()=>{const st=document.createElement('style');st.id='clean3d';st.textContent='#app .frame > *:not(.world-shell), .world-shell > *:not(#world), .desktop-caption, #toast, #connection-banner, #panel { visibility:hidden !important }';document.head.append(st);});
  await sleep(400);
  await page.screenshot({path:`/tmp/space-doodle/fix/3d/wall/${w}x${h}-overview-bench-clean.png`});
  out[`${w}x${h}-errors`]=errors;
  await drop(key);
}
return out;
