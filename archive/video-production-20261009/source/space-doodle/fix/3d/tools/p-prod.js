const out={};
for (const vp of ['w390','w1440']) {
  const key='prod'+vp; await drop(key);
  const {page}=await get(vp,{key,url:'http://127.0.0.1:5611/musicSpace/'});
  await page.waitForFunction(()=>document.querySelector('#loading')?.hidden===true,null,{timeout:60000});
  await sleep(1500);
  out[vp]=await page.evaluate(()=>({style:window.__SPACE_EVENT_QA__?.()?.camera?.scene?.renderStyle,venue:window.__SPACE_EVENT_QA__?.()?.camera?.scene?.venueAsset?.status,token:getComputedStyle(document.documentElement).getPropertyValue('--ds-paper').trim(),links:[...document.querySelectorAll('link[rel=stylesheet],style')].length}));
  await page.screenshot({path:`/tmp/space-doodle/fix/3d/prod-lobby-${vp}.png`});
  await drop(key);
}
return out;
