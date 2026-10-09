const s = await get('phone');
const p = s.page;
const r = {};
await p.locator('[data-group=close]').first().click().catch(() => {}); await sleep(800);
await p.locator('[data-view="person"]').click(); await sleep(1800);
r.shot = await shot(p, 'e12-people');
r.people = await p.evaluate(() => [...document.querySelectorAll('[data-person]')].map(e => ({ t: e.innerText.replace(/\s+/g, ' ').slice(0, 60), svg: !!e.querySelector('svg[data-illustrated-avatar]'), img: !!e.querySelector('img') })));
r.anySvg = await p.evaluate(() => [...document.querySelectorAll('svg[data-illustrated-avatar]')].map(sv => { const c = sv.closest('[data-person],article,li,section,div'); return (c?.className || c?.tagName) + ' | ' + (c?.innerText || '').replace(/\s+/g, ' ').slice(0, 40) + ' | ' + sv.getAttribute('data-view'); }));
return r;
