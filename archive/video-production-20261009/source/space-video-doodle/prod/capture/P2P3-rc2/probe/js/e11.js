const s = await get('phone');
const p = s.page;
const out = {};
out.forms = await p.evaluate(() => [...document.querySelectorAll('.corner-panel form')].map(f => ({ attrs: [...f.attributes].map(a => a.name + '=' + a.value).join(' '), fields: [...f.querySelectorAll('input,textarea,select,button')].map(e => `${e.tagName} name=${e.name || ''} type=${e.type || ''} val=${(e.value || '').slice(0, 30)} :: ${(e.closest('label')?.innerText || e.textContent || '').trim().slice(0, 40)}${e.tagName === 'SELECT' ? ' opts=' + [...e.options].map(o => o.value + ':' + o.text).join('|') : ''}`) })));
out.buttons = await H.buttons(p, b => /corner/.test(b));
return out;
