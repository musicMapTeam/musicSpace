const {page}=await get('phone');
const out={};
await page.locator('[data-open="chats"]').first().click(); await sleep(2000);
out.chat0=await shot(page,'p17-chat-open');
out.chatText=await L.visibleText(page,'.private-chat');
const ta=page.locator('.private-chat textarea');
await ta.fill('返场那首我在人海里，手都举酸了！');
await sleep(300);
out.typed=await shot(page,'p17-chat-typed');
const t0=Date.now();
await page.locator('.private-chat .chat-composer button[type=submit]').click();
await sleep(800); out.sentShot=await shot(page,'p17-chat-sent');
const before=await page.evaluate(()=>document.querySelectorAll('.private-chat .chat-message, .private-chat li, .private-chat article').length);
for(let i=0;i<40;i++){ const n=await page.evaluate(()=>document.querySelectorAll('.private-chat .chat-message, .private-chat li, .private-chat article').length); if(n>before){out.replyMs=Date.now()-t0;break;} await sleep(250);}
await sleep(800); out.reply=await shot(page,'p17-chat-reply');
out.chatText2=await L.visibleText(page,'.private-chat');
return out;
