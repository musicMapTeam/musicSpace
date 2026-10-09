const out={};
const settle=async page=>{const t0=Date.now();await sleep(250);while(Date.now()-t0<6000){const m=await page.evaluate(()=>window.__SPACE_EVENT_QA__?.()?.camera?.moving);if(!m)break;await sleep(80);}await sleep(900);};
for (const vp of ['w390','w1440']) {
  const key='prod2'+vp; await drop(key);
  const {page,errors}=await get(vp,{key,url:'http://127.0.0.1:5611/musicSpace/'});
  const logs=[];page.on('console',m=>{if(['error','warning'].includes(m.type()))logs.push(m.text().slice(0,160));});
  await page.waitForFunction(()=>document.querySelector('#loading')?.hidden===true,null,{timeout:60000});
  await enter(page); await sleep(1200);
  await page.click('nav.camera-nav button[data-view=photos]'); await settle(page);
  out[vp]=await page.evaluate(()=>({style:window.__SPACE_EVENT_QA__?.()?.camera?.scene?.renderStyle,venue:window.__SPACE_EVENT_QA__?.()?.camera?.scene?.venueAsset?.status,people:window.__SPACE_EVENT_QA__?.()?.camera?.scene?.peopleCount}));
  out[vp].logs=logs.slice(0,6);out[vp].errors=errors;
  await page.screenshot({path:`/tmp/space-doodle/fix/3d/prod-photos-${vp}.png`});
  await page.click('nav.camera-nav button[data-view=overview]'); await settle(page);
  await page.screenshot({path:`/tmp/space-doodle/fix/3d/prod-overview-${vp}.png`});
  await drop(key);
}
return out;
