const {page}=await get(globalThis.KIND);
await page.evaluate(()=>{const s=document.querySelector('.music-games .community-scroll');const r=s.querySelector('.game-round');s.scrollTop=r?r.offsetTop-90:0;document.activeElement?.blur?.();});await sleep(400);
await page.screenshot({path:globalThis.OUT});
return await page.evaluate(()=>[...document.querySelectorAll('.music-games .game-choices button')].map(b=>{const r=b.getBoundingClientRect();return b.textContent.trim()+' '+Math.round(r.width)+'x'+Math.round(r.height);}));
