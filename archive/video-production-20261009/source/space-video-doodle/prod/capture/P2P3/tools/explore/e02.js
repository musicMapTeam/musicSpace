const s = await get('phone');
const p = s.page;
return await p.evaluate(() => {
  const w = document.querySelectorAll('.wardrobe');
  return { wardrobes: [...w].map(e => ({ cls: e.className, vis: e.getClientRects().length, hiddenAnc: !!e.closest('[hidden]'), parent: e.parentElement?.id || e.parentElement?.className })), panelHidden: document.querySelector('#panel')?.hidden };
});
