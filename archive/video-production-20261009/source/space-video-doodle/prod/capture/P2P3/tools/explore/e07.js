const s = await get('phone');
const p = s.page;
const r = {};
await p.locator('.music-topics details > summary').click(); await sleep(800);
r.shotForm = await shot(p, 'e07-topic-form');
r.b = await H.buttons(p, b => /topic|summary|title|artist|note|consent|发布|留下/.test(b));
r.formHtml = await p.evaluate(() => document.querySelector('.music-topics form[data-topic-create]')?.outerHTML.slice(0, 2500));
r.scroller = await p.evaluate(() => { const m = document.querySelector('.music-topics'); const sc = m.querySelector('.community-scroll'); const pr = m.getBoundingClientRect(); return { panel: [pr.top, pr.height], sh: sc.scrollHeight, ch: sc.clientHeight, st: sc.scrollTop }; });
return r;
