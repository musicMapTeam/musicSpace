const kind=globalThis.KIND||'phone';
const {page}=await get(kind);
await closeEverything(page);
await openKind(page,'wardrobe');await sleep(2000);
await page.screenshot({path:`/tmp/space-doodle/social-work/now/probe-wardrobe-${kind}.png`});
return await page.evaluate(()=>{const w=document.querySelector('.wardrobe');const b=n=>{if(!n)return null;const x=n.getBoundingClientRect();return [Math.round(x.x),Math.round(x.y),Math.round(x.width),Math.round(x.height)];};const f=w.querySelector('.wardrobe-tools footer');return {w:b(w),tools:b(w.querySelector('.wardrobe-tools')),footer:b(f),footerKids:[...f.children].map(c=>c.tagName+'.'+c.className+':'+c.textContent.trim().slice(0,20)+':'+JSON.stringify(b(c))),count:b(w.querySelector('.wardrobe-count')),countText:w.querySelector('.wardrobe-count')?.textContent,countParent:w.querySelector('.wardrobe-count')?.parentElement?.className,vh:innerHeight,toolsScroll:[w.querySelector('.wardrobe-tools').scrollHeight,w.querySelector('.wardrobe-tools').clientHeight,getComputedStyle(w.querySelector('.wardrobe-tools')).overflowY]};});
