await drop('w1440');
const {page}=await get('w1440');
await L.enter(page); await sleep(2500);
await page.screenshot({path:'/tmp/space-doodle/fix/3d/probe-room-1440-now.png'});
return await page.evaluate(()=>{const p=document.querySelector('.presence');const r=p.getBoundingClientRect();return {cls:p.className,rect:[r.left,r.top,r.right,r.bottom].map(Math.round),tour:!!document.querySelector('#demo-tour:not([hidden])')};});
