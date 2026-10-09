const L=require('./lib.cjs');
(async()=>{const b=await L.launch();const {ctx,page}=await L.open(b,'desktop');
await L.enter(page);
await page.evaluate(()=>{const b=document.createElement('button');b.dataset.open='conversation';document.body.append(b);b.click();b.remove();});
await page.waitForTimeout(2000);
const join=page.locator('.community-panel form[data-group-join]');
if(await join.count()){await join.locator('input[name=consent]').check();await join.locator('button[type=submit]').click();await page.waitForTimeout(2500);}
await page.locator('.community-panel [data-group-worldcup]').click();
await page.waitForTimeout(2500);
const info=await page.evaluate(()=>{const r=document.querySelector('.worldcup-panel');if(!r)return 'no panel';const cs=getComputedStyle(r);const bb=r.getBoundingClientRect();return {bb:[bb.x,bb.y,bb.width,bb.height],display:cs.display,vis:cs.visibility,op:cs.opacity,z:cs.zIndex,pos:cs.position,anim:cs.animationName,transform:cs.transform,html:r.innerHTML.slice(0,300),parent:r.parentElement.className};});
console.log(JSON.stringify(info,null,1));
const top=await page.evaluate(()=>{const e=document.elementFromPoint(1100,400);return e?e.outerHTML.slice(0,200):null;});console.log('top at 1100,400:',top);
await page.screenshot({path:'/tmp/space-doodle/social-work/dbg-wc.png'});
await b.close();})();
