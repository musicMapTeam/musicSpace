const {page}=await get('phone');
await page.screenshot({path:'/tmp/space-doodle/social-work/now/probe-state.png'});
return await page.evaluate(()=>({stage:document.querySelector('.frame')?.dataset.stage,open:[...document.querySelectorAll('.community-panel,.private-chat,.wardrobe,#panel,.room-moderation')].filter(x=>!x.hidden).map(x=>x.className||x.id),boot:window.__SPACE_BOOT__}));
