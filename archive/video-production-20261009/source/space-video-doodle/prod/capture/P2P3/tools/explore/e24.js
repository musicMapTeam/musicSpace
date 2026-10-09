const s = await get('phone');
const p = s.page;
return await p.evaluate(() => {
  const body = document.querySelector('.photo-exchanges .exchange-body');
  const kids = [...body.children].map(k => { const b = k.getBoundingClientRect(); return k.tagName + '.' + k.className + ' @' + Math.round(b.y) + ' h' + Math.round(b.height) + ' | ' + (k.innerText || '').replace(/\s+/g, ' ').slice(0, 40); });
  const st = document.querySelector('.exchange-status');
  const stKids = [...st.querySelectorAll('*')].map(k => k.tagName + '.' + k.className).slice(0, 12);
  const pseudo = ['::before', '::after'].map(ps => { const cs = getComputedStyle(st, ps); return ps + ' ' + cs.content + ' ' + cs.width + 'x' + cs.height + ' ' + cs.top + ',' + cs.left; });
  const parentOfStatus = st.parentElement.tagName + '.' + st.parentElement.className;
  return { kids, stKids, pseudo, parentOfStatus };
});
