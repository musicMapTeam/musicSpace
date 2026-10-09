const out={};
for(const vp of ['w320','w390','w768','w1440']){
  await drop(vp);
  const {page}=await get(vp);
  await page.locator('#join').click();
  await page.waitForSelector('form[data-form="demo-entry"]');await sleep(800);
  out[vp]=await page.evaluate(()=>{
    const panel=document.querySelector('#panel');const body=document.querySelector('#panel-body');
    const sc=[panel,body].find(n=>n.scrollHeight>n.clientHeight+2&&/auto|scroll/.test(getComputedStyle(n).overflowY))||panel;
    const sr=sc.getBoundingClientRect();const btn=document.querySelector('form[data-form="demo-entry"] button[type=submit]').getBoundingClientRect();
    const consent=document.querySelector('form[data-form="demo-entry"] label.consent').getBoundingClientRect();
    const nav=document.querySelector('nav.camera-nav').getBoundingClientRect();
    return {scroller:sc.id||sc.className,visibleTop:Math.round(sr.top),visibleBottom:Math.round(sr.bottom),clientH:sc.clientHeight,scrollH:sc.scrollHeight,submitTop:Math.round(btn.top),submitBottom:Math.round(btn.bottom),consentTop:Math.round(consent.top),scrollNeededToSeeSubmit:Math.max(0,Math.round(btn.bottom-sr.bottom)),navTop:Math.round(nav.top),vh:innerHeight};
  });
  await drop(vp);
}
return out;
