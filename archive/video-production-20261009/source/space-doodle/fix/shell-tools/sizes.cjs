// node sizes.cjs <prefix> vp1,vp2,...  room card coverage at several viewports (expanded + collapsed), one fresh world per viewport
const L = require('./lib.cjs');
L.watchdog(290);
const prefix = process.argv[2] || 'sz';
const list = (process.argv[3] || 'desktop790,d1366').split(',');
(async () => {
  const b = await L.launch();
  for (const kind of list) {
    const { ctx, page } = await L.open(b, kind);
    try {
      await L.enter(page);
      await L.sleep(1200);
      const c1 = await L.cover(page);
      console.log(kind, 'expanded', JSON.stringify({ card: c1.card, shell: c1.shell, togHit: c1.togHit, tags: c1.hotspots.map(h => `${h.label.slice(0, 6)}:${h.coveredPct}%:${h.centerHit}`) }));
      await L.shot(page, `${prefix}-room-tour-${kind}`);
      const tog = page.locator('[data-tour-toggle]');
      if (await tog.count()) {
        await tog.first().click(); await L.sleep(900);
        const c2 = await L.cover(page);
        console.log(kind, 'collapsed', JSON.stringify({ card: c2.card, togHit: c2.togHit, tags: c2.hotspots.map(h => `${h.label.slice(0, 6)}:${h.coveredPct}%:${h.centerHit}`) }));
        await L.shot(page, `${prefix}-room-collapsed-${kind}`);
      }
    } catch (e) { console.error(kind, 'ERR', e.message.split('\n')[0]); }
    await ctx.close();
  }
  await b.close();
})();
