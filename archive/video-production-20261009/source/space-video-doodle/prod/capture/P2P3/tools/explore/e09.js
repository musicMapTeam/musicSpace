const s = await get('phone');
const p = s.page;
const r = {};
await p.locator('[data-topic-discuss]').first().click(); await sleep(2000);
r.shot1 = await shot(p, 'e09-topic-discuss');
r.t = (await H.text(p, 'body')).split('\n').slice(-40).join(' | ');
r.b = await H.buttons(p, b => /group|chat|topic|send|发送/.test(b));
return r;
