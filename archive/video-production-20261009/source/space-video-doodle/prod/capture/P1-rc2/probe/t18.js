const p0 = await page.evaluate(() => performance.now());
await page.click('.private-chat textarea'); await page.keyboard.type('测试时间');
await page.click('.private-chat .chat-composer button[type=submit]');
await sleep(800);
const r = await page.evaluate(() => { const a = [...document.querySelectorAll('.private-chat .chat-message.mine small')].map(e => e.textContent); return { a, perf: performance.now(), now: new Date().toLocaleTimeString('zh-CN') }; });
return { p0, ...r, predicted60x: new Date(new Date('2026-10-07T22:40:00+08:00').getTime() + p0 * 60).toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai' }) };
