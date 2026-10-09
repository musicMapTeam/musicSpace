const {page}=await get(globalThis.KIND);
const out={};
const measure=()=>page.evaluate(()=>[...document.querySelectorAll('.music-games .game-choices button')].map(b=>{const r=b.getBoundingClientRect();return Math.round(r.width)+'x'+Math.round(r.height)+'@'+Math.round(r.top);}).join(' | '));
for(const [w,h] of [[414,896],[375,812],[365,740],[361,740],[360,740],[320,568]]){await page.setViewportSize({width:w,height:h});await sleep(500);out[w]=await measure();}
await page.setViewportSize({width:390,height:844});await sleep(500);
// simulate a member-written long title in one button of the second pair; the pair should keep one height
const sim=await page.evaluate(()=>{const b=[...document.querySelectorAll('.music-games .game-choices button')];const old=b[3].textContent;b[3].textContent='我选「一张名字很长很长的成员自填专辑」';const r=b.map(x=>{const q=x.getBoundingClientRect();return Math.round(q.height)+'@'+Math.round(q.top);});return {r,old};});
await page.evaluate(()=>{const s=document.querySelector('.music-games .community-scroll');const r=s.querySelector('.game-round');s.scrollTop=r.offsetTop-90;});await sleep(300);
await page.screenshot({path:'/tmp/space-doodle/social-fix/now/game-longlabel-phone.png'});
await page.evaluate(old=>{const b=[...document.querySelectorAll('.music-games .game-choices button')];b[3].textContent=old;},sim.old);
const sub=await page.evaluate(()=>getComputedStyle(document.querySelector('.music-games .game-choices>div')).gridTemplateRows);
return {out,sim:sim.r,sub};
