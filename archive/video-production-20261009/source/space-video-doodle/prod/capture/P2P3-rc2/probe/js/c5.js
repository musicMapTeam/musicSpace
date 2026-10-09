// fresh corner in the driver world: is the per-keystroke scroll jump a product behaviour, and does it depend on the scroll position?
const s = await get('phone');
const p = s.page;
const out = {};
// the driver world from c4 has a finished corner; open a fresh invitation flow is not possible with the same friend while one exists, so test on the existing edit form
const sc = () => p.evaluate(() => { const c = document.querySelector('.corner-panel .community-scroll'); return c ? { top: Math.round(c.scrollTop), max: c.scrollHeight - c.clientHeight } : null; });
out.start = await sc();
const note = p.locator('.corner-panel form[data-corner-edit] input[name=note]');
await note.evaluate(e => e.scrollIntoView({ block: 'center' }));
await sleep(300);
out.centered = await sc();
await note.click(); await sleep(200);
await p.keyboard.press('End');
const seq = [];
for (const ch of ['啊', '哦', '嗯', '呀', '哈']) { await p.keyboard.insertText(ch); await sleep(120); seq.push({ ch, ...(await sc()), notice: await p.evaluate(() => /你的改动还没保存/.test(document.querySelector('.corner-panel')?.innerText || '')) }); }
out.seq = seq;
// undo: discard changes
const discard = p.locator('.corner-panel button', { hasText: '放弃改动' });
if (await discard.count()) { await discard.first().click(); await sleep(400); }
out.after = await sc();
return out;
