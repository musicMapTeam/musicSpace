const vp='w390';
await drop(vp);
const {page}=await get(vp,{reducedMotion:'reduce'});
const desc=()=>page.evaluate(()=>{const a=document.activeElement;return a?(a.id?'#'+a.id:a.tagName.toLowerCase()+(a.className?'.'+String(a.className).split(' ')[0]:''))+' «'+(a.textContent||'').trim().slice(0,12)+'»':null;});
await page.evaluate(()=>document.querySelector('#join').focus());
await page.keyboard.press('Enter');await page.waitForSelector('form[data-form="demo-entry"]');await sleep(800);
const r={afterOpen:await desc()};
await page.keyboard.press('Escape');await sleep(600);
r.afterEscape=await desc();r.panelHiddenAfterEscape=await page.evaluate(()=>document.querySelector('#panel').hidden);
if(!r.panelHiddenAfterEscape){await page.keyboard.press('Enter');await sleep(600);r.afterEnterOnFocused=await desc();r.panelHidden2=await page.evaluate(()=>document.querySelector('#panel').hidden);}
// reopen and close with the close button via keyboard
await page.evaluate(()=>document.querySelector('#join').focus());await page.keyboard.press('Enter');await sleep(800);
r.reopenFocus=await desc();
await page.keyboard.press('Enter');await sleep(600);
r.afterCloseButton=await desc();r.panelHidden3=await page.evaluate(()=>document.querySelector('#panel').hidden);
await page.keyboard.press('Tab');await sleep(300);r.nextTabAfterClose=await desc();
return r;
