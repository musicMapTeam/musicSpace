const s = await get('phone');
const p = s.page;
// open the upload form again on the crowd sample? The wall is open: check pseudo-elements on wall cards + toast
const pseudo = sel => p.evaluate(sel => { const e = document.querySelector(sel); if (!e) return null; const out = {}; for (const ps of ['::before', '::after']) { const cs = getComputedStyle(e, ps); if (cs.content && cs.content !== 'none') out[ps] = { content: cs.content.slice(0, 30), bg: cs.backgroundImage.slice(0, 60), bgc: cs.backgroundColor, pos: cs.position, w: cs.width, h: cs.height, top: cs.top, left: cs.left, transform: cs.transform, mask: (cs.maskImage || cs.webkitMaskImage || '').slice(0, 40) }; } const cs = getComputedStyle(e); out.self = { bg: cs.backgroundColor, border: cs.border, shadow: cs.boxShadow.slice(0, 60), padding: cs.padding, transform: cs.transform, filter: cs.filter }; return out; }, sel);
const r = {};
for (const sel of ['#panel .moment-card--best', '#panel .moment-card:not(.moment-card--best)', '#panel .moment-card .photo-item', '#panel .moment-badge', '#panel .moment-wall', '#panel .moment-group']) r[sel] = await pseudo(sel);
return r;
