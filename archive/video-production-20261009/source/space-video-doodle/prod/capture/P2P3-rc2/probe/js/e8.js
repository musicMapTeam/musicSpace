const s = await get('phone', true);
const p = s.page;
const out = {};
await H.lookAndEnter(s);
await sleep(9500);
const skip = p.locator('[data-tour-skip]'); if (await skip.count() && await skip.first().isVisible()) { await skip.first().click(); await sleep(800); }
await p.locator('[data-view="person"]').click(); await sleep(1500);
out.people = await H.text(p, '#panel');
await shot(p, 'e8-people');
await p.locator('[data-person]', { hasText: '小满' }).first().click(); await sleep(2000);
out.person = await H.text(p, '#panel');
out.personButtons = await H.buttons(p, b => /#panel|data-/.test(b));
await shot(p, 'e8-person-man');
return out;
