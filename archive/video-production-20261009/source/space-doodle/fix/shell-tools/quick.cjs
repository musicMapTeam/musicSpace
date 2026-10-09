// node quick.cjs <prefix> vp1,vp2 : first screen + room + ··· sheet per viewport
const L = require('./lib.cjs');
L.watchdog(290);
const prefix = process.argv[2] || 'q', list = (process.argv[3] || 'w750,w820').split(',');
(async () => {
  const b = await L.launch();
  for (const kind of list) {
    const { ctx, page } = await L.open(b, kind);
    try {
      const geo = () => page.evaluate(() => { const r = s => { const e = document.querySelector(s); if (!e || !e.getClientRects().length) return null; const x = e.getBoundingClientRect(); return [x.left, x.top, x.right, x.bottom].map(Math.round); }; return { track: r('.track'), presence: r('.presence'), panel: r('#panel'), shell: r('.world-shell') }; });
      console.log(kind, 'lobby', JSON.stringify(await geo()));
      await L.shot(page, `${prefix}-first-${kind}`);
      await L.enter(page);
      console.log(kind, 'room', JSON.stringify(await geo()));
      await L.shot(page, `${prefix}-room-${kind}`);
      await page.click('#room-info'); await L.sleep(1000);
      console.log(kind, 'sheet', JSON.stringify(await geo()));
      await L.shot(page, `${prefix}-roommenu-${kind}`);
    } catch (e) { console.error(kind, 'ERR', e.message.split('\n')[0]); }
    await ctx.close();
  }
  await b.close();
})();
