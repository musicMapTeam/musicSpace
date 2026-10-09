const s = await get('phone');
const p = s.page;
const out = {};
const sc = () => p.evaluate(() => { const c = document.querySelector('.corner-panel .community-scroll'); return c ? { top: Math.round(c.scrollTop), max: c.scrollHeight - c.clientHeight } : null; });
// discard my unsaved text first (real time)
const discard = p.locator('.corner-panel button', { hasText: '放弃改动' });
if (await discard.count()) { await discard.first().click(); await sleep(600); }
out.afterDiscard = await sc();
await p.evaluate(() => { const c = document.querySelector('.corner-panel .community-scroll'); const f = document.querySelector('.corner-panel form[data-corner-edit]'); c.scrollTop = c.scrollTop + f.getBoundingClientRect().top - c.getBoundingClientRect().top - (c.clientHeight - f.offsetHeight) / 2; });
await sleep(300);
out.centered = await sc();
await H.freezeKeep(s);
await s.step(2);
const b = await p.locator('.corner-panel form[data-corner-edit] input[name=note]').boundingBox();
await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
await p.mouse.down(); await s.step(3); await p.mouse.up(); await s.step(2);
out.afterTap = { ...(await sc()), active: await p.evaluate(() => document.activeElement?.name) };
const seq = [];
for (const ch of [...'返场那首我']) { await p.keyboard.insertText(ch); seq.push({ ch, now: await sc() }); await s.step(4); seq.push({ after4: await sc() }); }
out.seq = seq;
await s.unfreeze();
await sleep(500);
out.unfrozen = await sc();
return out;
