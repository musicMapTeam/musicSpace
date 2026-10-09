const out = {};
out.items = await page.evaluate(() => { const p = document.querySelector('#panel'); const st = p.scrollTop; const pr = p.getBoundingClientRect();
  const sel = ['[data-moment-badge="other-side"]', '.moment-group', '.moment-group__note', 'article', 'figure', 'img', 'h3', '.moment-group__time'];
  const res = [];
  for (const s of sel) for (const e of p.querySelectorAll(s)) { const r = e.getBoundingClientRect(); res.push(s + ' ' + (e.className||'').toString().slice(0,40) + ' y=' + Math.round(r.top - pr.top + st) + ' h=' + Math.round(r.height) + ' ' + (e.innerText||e.alt||'').replace(/\s+/g,' ').slice(0, 40)); }
  return res; });
for (const y of [330, 420, 600, 820, 1050, 1270, 1474]) { await page.evaluate(v => document.querySelector('#panel').scrollTo({ top: v, behavior: 'instant' }), y); await sleep(250); await shot('14-wall-' + y); }
await page.evaluate(() => document.querySelector('#panel').scrollTo({ top: 0, behavior: 'instant' }));
return out;
