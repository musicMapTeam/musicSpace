const s = await get('phone');
const p = s.page;
const out = {};
const cf = p.locator('.corner-panel form[data-corner-confirm]');
await cf.locator('input[name=confirm]').check();
await cf.locator('button[type=submit]').click();
const t0 = Date.now();
const seen = [];
for (let i = 0; i < 40; i++) {
  const t = await H.text(p, '.corner-panel');
  const v = (t.match(/版本[^\n]*/) || [''])[0] + ' | ' + ((await p.evaluate(() => [...document.querySelectorAll('.corner-panel form')].map(f => [...f.attributes].map(a => a.name).join(' ')).join(','))));
  if (!seen.length || seen[seen.length - 1].v !== v) seen.push({ ms: Date.now() - t0, v });
  if (/生成纪念图/.test(t)) break;
  await sleep(400);
}
out.seen = seen;
out.text = await H.text(p, '.corner-panel');
out.forms = await p.evaluate(() => [...document.querySelectorAll('.corner-panel form')].map(f => ({ attrs: [...f.attributes].map(a => a.name).join(' '), fields: [...f.querySelectorAll('input,textarea,select,button')].map(e => `${e.tagName} name=${e.name || ''} :: ${(e.closest('label')?.innerText || e.textContent || '').trim().slice(0, 40)}`) })));
await shot(p, 'e13-after-confirm');
return out;
