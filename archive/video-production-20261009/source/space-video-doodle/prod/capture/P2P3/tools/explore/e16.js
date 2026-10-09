const s = await get('phone');
const p = s.page;
const out = {};
for (const cat of ['palette', 'expression', 'pose', 'accessory']) {
  await p.locator(`.wardrobe [data-category="${cat}"]`).click(); await sleep(500);
  out[cat] = await p.evaluate(() => [...document.querySelectorAll('.wardrobe [data-part][data-value]')].filter(e => e.getClientRects().length).map(e => e.dataset.part + '=' + e.dataset.value + (e.getAttribute('aria-pressed') === 'true' || e.getAttribute('aria-checked') === 'true' ? '*' : '') + ' ' + (e.textContent || '').replace(/\s+/g, '').slice(0, 10)));
}
await shot(p, 'e16-wardrobe-pose');
return out;
