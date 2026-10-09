const {page}=await get('phone');
await page.evaluate(()=>{document.activeElement?.blur?.();});
await page.screenshot({path:'/tmp/space-doodle/social-work/now/probe-conv-end-phone.png'});
await page.evaluate(()=>{const t=document.querySelector('.conversation-actions'),c=document.querySelector('.conversation-content');t.scrollLeft=0;c.scrollTop=0;});await sleep(300);
await page.screenshot({path:'/tmp/space-doodle/social-work/now/probe-conv-top-phone.png'});
return 'ok';
