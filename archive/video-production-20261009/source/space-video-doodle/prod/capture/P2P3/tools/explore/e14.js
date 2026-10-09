const s = await get('phone');
const p = s.page;
return await p.evaluate(() => {
  const w = document.querySelector('.wardrobe');
  const layers = [...w.querySelectorAll('[data-layer]')].map(e => e.dataset.layer + ':' + e.dataset.part + ' ' + (e.textContent||'').replace(/\s+/g, ' ').slice(0, 20) + (e.getAttribute('aria-pressed') ? ' pressed=' + e.getAttribute('aria-pressed') : '') + (e.getAttribute('aria-selected') ? ' sel=' + e.getAttribute('aria-selected') : ''));
  const byPart = {};
  for (const e of w.querySelectorAll('[data-part][data-value]')) { (byPart[e.dataset.part] ||= []).push(e.dataset.value + (e.getAttribute('aria-pressed') === 'true' || e.classList.contains('is-active') || e.getAttribute('aria-checked') === 'true' ? '*' : '') + '(' + (e.textContent||'').replace(/\s+/g, '').slice(0, 6) + ')'); }
  return { layers, byPart };
});
