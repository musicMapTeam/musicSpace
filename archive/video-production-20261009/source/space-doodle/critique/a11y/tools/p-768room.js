const vp='w768';
await drop(vp);
const {page}=await get(vp);
await page.locator('#join').click();
await page.waitForSelector('form[data-form="demo-entry"]');
await page.locator('form[data-form="demo-entry"] input[name=consent]').check();
await page.waitForFunction(()=>!document.querySelector('form[data-form="demo-entry"] button[type=submit]')?.disabled,null,{timeout:60000});
await page.locator('form[data-form="demo-entry"] button[type=submit]').click();
await page.waitForSelector(".frame[data-stage='room']",{timeout:30000});
const snaps=[];
for(const t of [1500,4000,8000]){
  await sleep(t-(snaps.length?[1500,4000,8000][snaps.length-1]:0));
  const s=await page.evaluate(()=>({
    tags:[...document.querySelectorAll('#hotspots .hotspot')].map(n=>({label:n.textContent.trim(),hidden:n.hidden,rect:n.getClientRects().length?(r=>[Math.round(r.left),Math.round(r.top),Math.round(r.right)])(n.getBoundingClientRect()):null})),
    canvas:(r=>[Math.round(r.left),Math.round(r.top),Math.round(r.right),Math.round(r.bottom)])(document.querySelector('#world canvas').getBoundingClientRect()),
    view:document.querySelector('#view-label')?.textContent, stage:document.querySelector('.frame').dataset.stage
  }));
  s.t=t;snaps.push(s);
  await page.screenshot({path:`/tmp/space-doodle/critique/a11y/evidence/w768-room-${t}ms.png`});
}
return snaps;
