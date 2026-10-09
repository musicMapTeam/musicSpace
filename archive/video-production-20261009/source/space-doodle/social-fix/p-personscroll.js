const {page}=await get(globalThis.KIND);
const r=await page.evaluate(()=>{const out=[];for(const n of [document.querySelector('#panel'),document.querySelector('#panel-body')]){const cs=getComputedStyle(n);out.push({id:n.id,ovf:cs.overflowY,ch:n.clientHeight,sh:n.scrollHeight,st:n.scrollTop,maxh:cs.maxHeight});}
 const p=document.querySelector('#panel');p.scrollTop=p.scrollHeight;const b=document.querySelector('#panel-body');b.scrollTop=b.scrollHeight;document.activeElement?.blur?.();
 const last=[...document.querySelectorAll('#panel-body p.fine')].at(-1).getBoundingClientRect();const pr=p.getBoundingClientRect();return {out,last:[Math.round(last.top),Math.round(last.bottom)],panel:[Math.round(pr.top),Math.round(pr.bottom)]};});
await sleep(300);
await page.screenshot({path:globalThis.OUT});
return r;
