const s = await get('phone');
const p = s.page;
const r = {};
await p.keyboard.press('Escape').catch(() => {}); await sleep(300);
await p.locator('.private-chat .chat-close').first().click().catch(() => {}); await sleep(600);
r.state1 = await H.buttons(p, b => /close|×|chat/.test(b));
for (let i = 0; i < 3; i++) { const hid = await p.evaluate(() => document.querySelector('#panel')?.hidden); if (hid === false) { await p.locator('#panel-close').click().catch(() => {}); await sleep(400); } }
await p.locator('#scene-details').click(); await sleep(1200);
await p.locator('#panel [data-open="conversation"]').first().click(); await sleep(2000);
const join = p.locator('.community-panel form[data-group-join]');
if (await join.count()) { await join.locator('input[name=consent]').check(); await join.locator('button[type=submit]').click(); await sleep(2500); }
r.castSvgs = await p.evaluate(() => [...document.querySelectorAll('.community-panel article')].map(a => ({ name: (a.innerText || '').split('\n')[0].trim(), svg: !!a.querySelector('svg[data-illustrated-avatar]'), len: a.querySelector('svg')?.outerHTML.length })));
await p.evaluate(() => { const row = document.querySelector('.conversation-actions'); const b = row.querySelector('[data-group-worldcup]'); row.scrollLeft = b.offsetLeft - row.offsetLeft - 2; });
await p.locator('[data-group-worldcup]').click(); await sleep(2000);
r.cupList = await H.buttons(p, b => /cup|世界杯/.test(b));
await p.locator('.worldcup-panel .entry-list button').first().click(); await sleep(2000);
await shot(p, 'e26-cup');
r.cup = await p.evaluate(() => { const w = document.querySelector('.worldcup-panel'); const els = [...w.querySelectorAll('[class*=vs], [class*=match], [class*=versus], [data-cup-choice]')].slice(0, 12).map(e => { const b = e.getBoundingClientRect(); return e.tagName + '.' + e.className + ' ' + JSON.stringify(e.dataset) + ' @' + Math.round(b.y) + ' h' + Math.round(b.height) + ' | ' + e.innerText.replace(/\s+/g, ' ').slice(0, 40); }); return els; });
return r;
