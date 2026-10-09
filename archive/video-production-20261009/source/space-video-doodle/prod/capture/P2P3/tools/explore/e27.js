const s = await get('phone');
const p = s.page;
const r = {};
await p.locator('[data-cup-close]').first().click().catch(() => {}); await sleep(600);
await p.locator('[data-group="close"]').first().click().catch(() => {}); await sleep(800);
for (let i = 0; i < 3; i++) { const hid = await p.evaluate(() => document.querySelector('#panel')?.hidden); if (hid === false) { await p.locator('#panel-close').click().catch(() => {}); await sleep(400); } }
await p.locator('[data-view="person"]').click(); await sleep(1500);
await p.locator('[data-person]', { hasText: '小满' }).first().click(); await sleep(2000);
r.personBtns = await H.buttons(p, b => /open|social|corner|chat/.test(b));
await p.locator('#panel [data-open="corners"]').first().click(); await sleep(2000);
await shot(p, 'e27-corner-form');
r.cornerPanel = await p.evaluate(() => { const c = document.querySelector('.corner-panel'); if (!c) return null; const b = c.getBoundingClientRect(); return { cls: c.className, box: [b.x, b.y, b.width, b.height], text: c.innerText.replace(/\s+/g, ' ').slice(0, 300) }; });
await p.locator('.corner-panel input[type=checkbox]').first().check(); await sleep(200);
await p.locator('.corner-panel button', { hasText: '创建共同创作邀请' }).click(); await sleep(2500);
await shot(p, 'e27-corner-invited');
r.cornerInvited = await p.evaluate(() => { const c = document.querySelector('.corner-panel'); const b = c.getBoundingClientRect(); return { box: [b.x, b.y, b.width, b.height], text: c.innerText.replace(/\s+/g, ' ').slice(0, 300), kids: [...c.querySelectorAll('.community-scroll > *')].map(k => k.tagName + '.' + k.className + ' | ' + (k.innerText || '').replace(/\s+/g, ' ').slice(0, 40)) }; });
return r;
