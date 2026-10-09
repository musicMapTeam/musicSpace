const s = await get('phone');
const p = s.page;
const r = {};
await p.locator('[data-x-close]').first().click().catch(() => {}); await sleep(800);
for (let i = 0; i < 2; i++) { if (!(await p.evaluate(() => document.querySelector('#panel')?.hidden))) { await p.locator('#panel-close').click().catch(() => {}); await sleep(500); } }
await p.locator('[data-view="person"]').click(); await sleep(1500);
await p.locator('[data-person]', { hasText: '小满' }).first().click(); await sleep(2000);
await p.locator('[data-social-send]').first().click();
await p.waitForFunction(() => /你们已经认识了/.test(document.body.innerText), null, { timeout: 30000 }); await sleep(800);
await shot(p, 'e25-friends');
await p.locator('[data-open="chats"]').first().click(); await sleep(1500);
const ta = p.locator('.private-chat textarea'); await ta.click(); await p.keyboard.insertText('返场那首我在人海里，手都举酸了！');
await p.locator('.private-chat .chat-composer button[type=submit]').click();
await p.waitForFunction(() => /今晚的返场太好听了/.test(document.querySelector('.private-chat')?.innerText || ''), null, { timeout: 30000 }); await sleep(800);
await p.evaluate(() => document.activeElement?.blur?.());
await shot(p, 'e25-chat');
r.chat = await p.evaluate(() => { const pc = document.querySelector('.private-chat'); const msgs = [...pc.querySelectorAll('.chat-messages > *')].map(m => { const b = m.getBoundingClientRect(); return m.tagName + '.' + m.className + ' @' + Math.round(b.x) + ',' + Math.round(b.y) + ' ' + Math.round(b.width) + 'x' + Math.round(b.height) + ' | ' + m.innerText.replace(/\s+/g, ' ').slice(0, 50); }); const thread = pc.querySelector('.chat-thread'); return { msgs, thread: thread && [thread.scrollTop, thread.scrollHeight, thread.clientHeight], head: pc.querySelector('header')?.innerText.replace(/\s+/g, ' ').slice(0, 80) }; });
return r;
