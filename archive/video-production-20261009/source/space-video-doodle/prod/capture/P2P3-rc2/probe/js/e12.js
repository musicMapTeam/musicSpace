const s = await get('phone');
const p = s.page;
const out = {};
const ed = p.locator('.corner-panel form[data-corner-edit]');
out.maxlen = await ed.locator('input[name=note]').getAttribute('maxlength');
await ed.locator('input[name=note]').fill('返场那首我在人海里，手都举酸了！');
await ed.locator('input[name=share]').check();
await ed.locator('button[type=submit]').click();
await sleep(1500);
out.afterSave = await H.text(p, '.corner-panel');
const t0 = Date.now();
const seen = [];
for (let i = 0; i < 30; i++) {
  const t = await H.text(p, '.corner-panel');
  const v = (t.match(/版本[^\n]*/) || [''])[0];
  if (!seen.length || seen[seen.length - 1].v !== v) seen.push({ ms: Date.now() - t0, v });
  await sleep(400);
}
out.seen = seen;
out.forms = await p.evaluate(() => [...document.querySelectorAll('.corner-panel form')].map(f => [...f.attributes].map(a => a.name).join(' ')));
await shot(p, 'e12-after-save');
return out;
