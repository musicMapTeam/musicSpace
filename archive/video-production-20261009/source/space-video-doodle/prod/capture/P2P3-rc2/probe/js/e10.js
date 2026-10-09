const s = await get('phone');
const p = s.page;
const out = {};
await p.locator('#panel [data-open="corners"]').first().click(); await sleep(2200);
out.corner0 = await H.text(p, '.corner-panel');
out.corner0Html = await p.evaluate(() => document.querySelector('.corner-panel')?.outerHTML.slice(0, 2500));
await shot(p, 'e10-corner-0');
await p.locator('.corner-panel input[type=checkbox]').first().check(); await sleep(250);
await p.locator('.corner-panel button', { hasText: '发出邀请' }).click();
const t0 = Date.now();
await sleep(800);
out.corner1 = await H.text(p, '.corner-panel');
await shot(p, 'e10-corner-1');
const seen = [];
for (let i = 0; i < 40; i++) {
  const t = await H.text(p, '.corner-panel');
  if (!seen.length || seen[seen.length - 1].t !== t) seen.push({ ms: Date.now() - t0, t: t.slice(0, 400) });
  if (!/等 TA 加入/.test(t)) break;
  await sleep(500);
}
out.seen = seen;
await sleep(1000);
out.corner2 = await H.text(p, '.corner-panel');
out.corner2Html = await p.evaluate(() => document.querySelector('.corner-panel')?.outerHTML.slice(0, 5000));
await shot(p, 'e10-corner-2');
return out;
