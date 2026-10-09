const {page}=await get('phone');
const r1=await page.evaluate(()=>{const rd=document.querySelector('.music-community .chat-reading'),ct=document.querySelector('.music-community .conversation-content');rd.scrollTop=rd.scrollHeight;return {readingTop:rd.scrollTop,readingSH:rd.scrollHeight,readingCH:rd.clientHeight,contentTop:ct.scrollTop,contentSH:ct.scrollHeight,contentCH:ct.clientHeight};});
await sleep(6500);
const r2=await page.evaluate(()=>{const rd=document.querySelector('.music-community .chat-reading'),ct=document.querySelector('.music-community .conversation-content');return {readingTop:rd.scrollTop,contentTop:ct.scrollTop,msgs:[...document.querySelectorAll('.community-messages article>p')].map(p=>p.textContent.slice(0,14))};});
return {r1,r2};
