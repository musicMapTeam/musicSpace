const kind=globalThis.KIND;const {page}=await get(kind);
const r=await page.evaluate(()=>{const c=document.querySelector('.conversation-content');const m=document.querySelector('.conversation-management');if(!m.open)m.querySelector('summary').click();const last=[...m.querySelectorAll('button')].at(-1);c.scrollTop=m.offsetTop+m.offsetHeight-c.clientHeight+16;document.activeElement?.blur?.();
 const cb=c.getBoundingClientRect(),mb=m.getBoundingClientRect(),lb=last.getBoundingClientRect();return {scroller:[Math.round(cb.top),Math.round(cb.bottom)],menu:[Math.round(mb.top),Math.round(mb.bottom),Math.round(mb.left),Math.round(mb.right)],last:[last.textContent.trim(),Math.round(lb.top),Math.round(lb.bottom)],lastVisible:lb.top>=cb.top&&lb.bottom<=cb.bottom};});
await sleep(400);
await page.screenshot({path:globalThis.OUT});
return r;
