const kind=globalThis.KIND;const {page}=await get(kind);
const r=await page.evaluate(()=>{const c=document.querySelector('.conversation-content');const m=document.querySelector('.conversation-management');if(!m.open)m.querySelector('summary').click();c.scrollTop=0;document.activeElement?.blur?.();
 const cb=c.getBoundingClientRect(),mb=m.getBoundingClientRect(),st=document.querySelector('.conversation-status').getBoundingClientRect(),p=document.querySelector('.music-community').getBoundingClientRect();return {panel:[Math.round(p.left),Math.round(p.right)],scroller:[Math.round(cb.top),Math.round(cb.bottom),Math.round(cb.left),Math.round(cb.right)],menu:[Math.round(mb.top),Math.round(mb.bottom),Math.round(mb.left),Math.round(mb.right)],status:[Math.round(st.top),Math.round(st.bottom)]};});
await sleep(400);
await page.screenshot({path:globalThis.OUT});
return r;
