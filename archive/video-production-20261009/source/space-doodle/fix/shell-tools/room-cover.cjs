// node room-cover.cjs <vp> <prefix>  : first screen, room overview with the tour expanded / collapsed, coverage of the tags
const L = require('./lib.cjs');
L.watchdog(280);
const kind = process.argv[2] || 'desktop';
const prefix = process.argv[3] || 'base';
(async () => {
  const b = await L.launch();
  const { page } = await L.open(b, kind);
  try {
    await L.shot(page, `${prefix}-first-${kind}`);
    await L.enter(page);
    await L.sleep(1500);
    const c1 = await L.cover(page);
    console.log('expanded', JSON.stringify(c1));
    await L.shot(page, `${prefix}-room-tour-${kind}`);
    const tog = page.locator('[data-tour-toggle]');
    if (await tog.count()) {
      await tog.first().click(); await L.sleep(900);
      console.log('collapsed', JSON.stringify(await L.cover(page)));
      await L.shot(page, `${prefix}-room-collapsed-${kind}`);
      await tog.first().click(); await L.sleep(600);
    }
    console.log('logs', JSON.stringify(page.__logs.slice(0, 6)));
  } catch (e) { console.error('ERR', e.message.split('\n')[0]); await page.screenshot({ path: `${L.OUT}/ERR-room-cover-${kind}.png` }).catch(() => {}); }
  await b.close();
})();
