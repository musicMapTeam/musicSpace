const s = await get('phone');
const p = s.page;
await s.unfreeze();
return await p.evaluate(() => { const a = document.activeElement; const r = a.getBoundingClientRect(); return { tag: a.tagName, name: a.name, cls: a.className, parent: a.parentElement?.className, form: a.form?.outerHTML.slice(0, 300), box: [r.x, r.y, r.width, r.height] }; });
