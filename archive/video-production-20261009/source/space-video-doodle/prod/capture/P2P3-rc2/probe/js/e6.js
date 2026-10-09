const s = await get('phone');
const p = s.page;
const out = {};
out.trackEls = await p.evaluate(() => [...document.querySelectorAll('#track-title,#track-note,[class*=track],[class*=song]')].map(e => `${e.tagName}#${e.id}.${e.className} vis=${!!e.getClientRects().length} :: ${e.textContent.replace(/\s+/g, ' ').trim().slice(0, 80)}`));
out.hasSpace = await p.evaluate(() => document.body.innerHTML.includes('Space 原创声景'));
return out;
