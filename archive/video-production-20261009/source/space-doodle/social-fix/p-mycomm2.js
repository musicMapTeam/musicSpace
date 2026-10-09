const kind=globalThis.KIND;const {page}=await get(kind);
await page.locator('.community-panel .entry-list button[data-community]').first().click();await sleep(3500);
await page.evaluate(()=>{const d=document.querySelector('.conversation-management');if(d&&!d.open)d.querySelector('summary').click();const c=document.querySelector('.conversation-content');if(c)c.scrollTop=0;document.activeElement?.blur?.();});await sleep(600);
await page.screenshot({path:globalThis.OUT});
const info=await page.evaluate(()=>{const m=document.querySelector('.conversation-management');if(!m)return {text:document.querySelector('.community-panel:not([hidden])')?.innerText.slice(0,400)};const r=m.getBoundingClientRect(),cs=getComputedStyle(m),c=document.querySelector('.conversation-content');return {title:document.querySelector('.community-panel:not([hidden]) h2')?.textContent,pos:cs.position,h:Math.round(r.height),ch:m.clientHeight,sh:m.scrollHeight,l:Math.round(r.left),r:Math.round(r.right),scroller:[c.clientHeight,c.scrollHeight],buttons:[...m.querySelectorAll('button,summary')].map(b=>b.textContent.trim().slice(0,14))};});
return info;
