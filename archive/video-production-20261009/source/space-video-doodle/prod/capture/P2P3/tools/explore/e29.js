const s = await get('phone', true);
const p = s.page;
await p.locator('#join').click();
await p.waitForSelector('form[data-form="demo-entry"] button.primary:not([disabled])', { timeout: 60000 });
await p.locator('form[data-form="demo-entry"] button', { hasText: '现在换个造型' }).first().click();
await p.waitForSelector('.wardrobe', { timeout: 30000 }); await sleep(1200);
return await p.evaluate(() => {
  const fig = document.querySelector('.wardrobe .wardrobe-figure');
  const chain = []; let e = fig; for (let i = 0; i < 5 && e; i++) { const b = e.getBoundingClientRect(); chain.push(e.tagName + '.' + e.className + ' @' + Math.round(b.x) + ',' + Math.round(b.y) + ' ' + Math.round(b.width) + 'x' + Math.round(b.height)); e = e.parentElement; }
  const stage = fig.parentElement;
  const kids = [...stage.children].map(k => { const b = k.getBoundingClientRect(); return k.tagName + '.' + k.className + ' @' + Math.round(b.x) + ',' + Math.round(b.y) + ' ' + Math.round(b.width) + 'x' + Math.round(b.height) + ' | ' + (k.textContent || '').trim().slice(0, 20); });
  const figKids = [...fig.children].map(k => k.tagName + '.' + (k.className.baseVal ?? k.className));
  const pseudo = ['::before', '::after'].map(ps => { const cs = getComputedStyle(fig, ps); return ps + ' ' + cs.content + ' ' + cs.width + 'x' + cs.height + ' bg=' + cs.backgroundColor; });
  return { chain, kids, figKids, pseudo };
});
