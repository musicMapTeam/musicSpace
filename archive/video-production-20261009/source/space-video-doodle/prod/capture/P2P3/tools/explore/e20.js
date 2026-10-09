const s = await get('phone', true);
const p = s.page;
await H.lookAndEnter(s);
await sleep(9500);
await p.locator('[data-tour-action="sample:sample-crowd"]').click();
await p.waitForFunction(() => /AI 判断：/.test(document.querySelector('#panel')?.innerText || ''), null, { timeout: 30000 });
await sleep(800);
const r = {};
r.uploadDom = await p.evaluate(() => {
  const pr = document.querySelector('#panel .photo-review');
  const chain = []; let e = pr; for (let i = 0; i < 4 && e; i++) { chain.push(e.tagName + '.' + e.className); e = e.parentElement; }
  const heads = [...document.querySelectorAll('#panel h2,#panel h3,#panel legend,#panel .moment-view > *')].slice(0, 12).map(h => h.tagName + '.' + h.className + ' ' + (h.textContent || '').trim().slice(0, 20));
  return { chain, heads, view: document.querySelector('.moment-view')?.className, hint: [...document.querySelectorAll('#panel p')].map(p => p.className + ':' + p.textContent.trim().slice(0, 30)).slice(0, 12) };
});
await p.locator('form[data-form="upload"] button[type=submit]').click();
await p.waitForSelector('[data-moment-badge="other-side"]', { timeout: 30000 });
await sleep(1500);
r.wallDom = await p.evaluate(() => {
  const b = document.querySelector('[data-moment-badge="other-side"]');
  const chain = []; let e = b; for (let i = 0; i < 5 && e; i++) { chain.push(e.tagName + '.' + e.className + (e.dataset && Object.keys(e.dataset).length ? ' ' + JSON.stringify(e.dataset) : '')); e = e.parentElement; }
  const pol = [...document.querySelectorAll('#panel figure, #panel .polaroid, #panel [class*=polaroid]')].slice(0, 12).map(f => f.tagName + '.' + f.className + ' | ' + (f.innerText || '').replace(/\s+/g, ' ').slice(0, 60));
  const groups = [...document.querySelectorAll('#panel section, #panel [class*=group]')].slice(0, 10).map(g => g.tagName + '.' + g.className + ' | ' + (g.querySelector('h3,h4,header')?.innerText || '').replace(/\s+/g, ' ').slice(0, 50));
  return { chain, pol, groups };
});
await shot(p, 'e20-wall');
return r;
