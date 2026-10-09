const s = await get('phone');
const p = s.page;
const r = {};
const join = p.locator('.community-panel form[data-group-join]');
r.joinCount = await join.count();
if (r.joinCount) { await join.locator('input[name=consent]').check(); await join.locator('button[type=submit]').click(); await sleep(2500); }
r.shotConv = await shot(p, 'e05-conversation');
r.b = await H.buttons(p, b => /group|conversation|topics|worldcup|games/.test(b));
r.actions = await p.evaluate(() => { const a = document.querySelector('.conversation-actions'); if (!a) return null; return { sw: a.scrollWidth, cw: a.clientWidth, sl: a.scrollLeft, items: [...a.children].map(c => c.outerHTML.slice(0, 120)) }; });
return r;
