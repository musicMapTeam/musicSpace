const s = await get('phone');
const p = s.page;
const r = {};
await p.locator('#my-look').click(); await sleep(2000);
r.shot = await shot(p, 'e13-wardrobe');
r.controls = await p.evaluate(() => {
  const w = document.querySelector('.wardrobe');
  const groups = [...w.querySelectorAll('fieldset, [role=radiogroup], .wardrobe-part, details, section')].slice(0, 40).map(g => (g.querySelector('legend,summary,h3,h4')?.innerText || g.className).replace(/\s+/g, ' ').slice(0, 30) + ' :: ' + [...g.querySelectorAll('button,input')].slice(0, 12).map(b => Object.entries(b.dataset).map(([k, v]) => k + '=' + v).join(',') || b.name + '=' + b.value).join(' | '));
  const data = [...new Set([...w.querySelectorAll('[data-part],[data-value],[data-component],[data-key]')].map(e => Object.keys(e.dataset).join(',')))];
  return { groups, data };
});
return r;
