const out = {};
await page.locator('[data-person]', { hasText: '小满' }).first().click();
const t0 = Date.now();
await page.waitForFunction(() => !!document.querySelector('[data-social-send]') && document.querySelector('[data-social-send]').getClientRects().length, null, { timeout: 20000 });
out.cardMs = Date.now() - t0;
await sleep(1500);
await shot('21-xiaoman');
out.card = await txt('#panel');
out.cam = await page.evaluate(() => { const c = window.__SPACE_EVENT_QA__().camera; return { view: c.view, moving: c.moving }; });
out.h = await page.evaluate(() => document.querySelector('#panel').querySelector('h2, h3')?.innerText);
out.send = await page.evaluate(() => { const b = document.querySelector('[data-social-send]'); const r = b.getBoundingClientRect(); return b.innerText + ' @' + Math.round(r.x) + ',' + Math.round(r.y) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height); });
out.inbox0 = await page.evaluate(() => document.querySelector('#social-inbox')?.textContent);
await page.click('[data-social-send]');
const t1 = Date.now();
let toast = ''; for (let i = 0; i < 60; i++) { const t = await page.evaluate(() => { const e = document.querySelector('#toast'); return e && !e.hidden && e.getClientRects().length ? e.textContent : ''; }); if (/招呼/.test(t)) { toast = t; break; } await sleep(50); }
out.toast = toast;
await sleep(300);
out.waiting = await txt('#panel');
await shot('22-waved');
await page.waitForFunction(() => /你们已经认识了/.test(document.querySelector('#panel')?.innerText || ''), null, { timeout: 30000 });
out.friendsMs = Date.now() - t1;
let inbox = ''; for (let i = 0; i < 40; i++) { inbox = await page.evaluate(() => document.querySelector('#social-inbox')?.textContent || ''); if (/2/.test(inbox)) break; await sleep(100); }
out.inbox = inbox; out.inboxMs = Date.now() - t1;
await sleep(800);
await shot('23-friends');
out.friends = await txt('#panel');
out.btns = (await btns()).filter(b => /私聊|邀请|反馈|屏蔽|移除/.test(b));
return out;
