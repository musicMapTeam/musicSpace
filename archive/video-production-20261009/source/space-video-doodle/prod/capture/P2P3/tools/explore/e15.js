const s = await get('phone');
const p = s.page;
const tabs = await p.evaluate(() => [...document.querySelectorAll('.wardrobe button, .wardrobe [role=tab]')].filter(b => !b.dataset.part && !b.dataset.preset && !b.dataset.angle).map(b => (b.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 20) + ' [' + Object.entries(b.dataset).map(([k, v]) => k + '=' + v).join(',') + ']' + (b.getAttribute('role') ? ' role=' + b.getAttribute('role') : '')));
return tabs;
