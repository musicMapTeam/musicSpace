const s = await get('phone');
const p = s.page;
const out = {};
await p.locator('.community-panel [data-group-topics]').first().click();
await sleep(1500);
out.topics = await p.evaluate(() => { const m = document.querySelector('.music-topics'); return m ? m.innerText.replace(/\n{2,}/g, '\n') : 'none'; });
out.topicsHtmlHead = await p.evaluate(() => document.querySelector('.music-topics')?.outerHTML.slice(0, 3000));
await shot(p, 'e5-topics');
const sum = p.locator('.music-topics details > summary');
out.summary = await sum.count() ? await sum.first().textContent() : 'none';
if (await sum.count()) { await sum.first().click(); await sleep(1000); }
out.form = await p.evaluate(() => { const f = document.querySelector('.music-topics form[data-topic-create]'); return f ? { text: f.innerText.replace(/\n{2,}/g, '\n'), fields: [...f.querySelectorAll('input,textarea,select,button')].map(e => `${e.tagName} ${e.name || ''} ${e.type || ''} ${(e.placeholder || e.textContent || '').trim().slice(0, 40)}`) } : 'none'; });
out.audit = await H.audit(p);
await shot(p, 'e5-topics-form');
return out;
