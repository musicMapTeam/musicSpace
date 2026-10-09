// Part C: the group chat after joining (seeded lines), the album cup, the game, the room's community and the visitor's communities.
const L = require('./lib.cjs');
L.watchdog(285);
const vp = process.argv[2] || 'phone';
const submitForm = (page, sel) => page.evaluate(sel => { const f = document.querySelector(sel); if (!f) return false; f.querySelectorAll('input[type="checkbox"]').forEach(c => { c.checked = true; }); f.requestSubmit(); return true; }, sel);
(async () => {
  const browser = await L.launch();
  try {
    const run = await L.open(browser, vp);
    const { page } = run;
    await L.enter(run);
    await L.press(run, '#room-info');
    await L.sleep(800);
    await page.locator('#panel [data-open="conversation"]').first().evaluate(b => b.click());
    await page.waitForSelector('.community-panel form[data-group-join]', { timeout: 20000 });
    console.log('join form', await submitForm(page, '.community-panel form[data-group-join]'));
    await page.waitForFunction(() => /示例角色的自动回复|舞台这一面/.test(document.querySelector('.community-panel')?.innerText || ''), null, { timeout: 30000 }).catch(() => console.log('no seeded lines'));
    await L.sleep(1500);
    await L.grab(page, 'group-chat-joined', '.community-panel');
    await L.shot(page, `c-groupchat-${vp}`);
    // the album cup
    const cup = page.locator('.community-panel [data-group-worldcup]').first();
    if (await cup.count()) {
      await cup.evaluate(b => b.click());
      await L.sleep(2500);
      await L.grab(page, 'worldcup', '[class*="worldcup"]');
      await L.shot(page, `c-worldcup-${vp}`);
      await page.locator('[data-cup-close]').first().evaluate(b => b.click()).catch(() => {});
      await L.sleep(1500);
    }
    const games = page.locator('.community-panel [data-group-games]').first();
    if (await games.count()) {
      await games.evaluate(b => b.click());
      await L.sleep(2500);
      await L.grab(page, 'games', '[class*="game"]');
      await L.shot(page, `c-games-${vp}`);
      await page.locator('[class*="game"] header button').first().evaluate(b => b.click()).catch(() => {});
      await L.sleep(1500);
    }
    // the room's long-term community link, then the list of the visitor's communities
    const linked = page.locator('.community-panel [data-group="linked"]').first();
    if (await linked.count()) { await linked.evaluate(b => b.click()); await L.sleep(1500); await L.grab(page, 'linked-community', '.community-panel'); }
    await L.log(page, 'log-c1');
    const list = page.locator('.community-panel [data-group="list"]').first();
    if (await list.count()) { await list.evaluate(b => b.click()); await L.sleep(1500); await L.grab(page, 'community-list', '.community-panel'); await L.shot(page, `c-community-list-${vp}`); }
    // create a community (the visitor as a host)
    const create = page.locator('.community-panel form[data-community-create]').first();
    if (await create.count()) {
      await page.fill('.community-panel form[data-community-create] input[name="title"]', '我的乐迷社群').catch(() => {});
      await submitForm(page, '.community-panel form[data-community-create]');
      await L.sleep(2500);
      await L.grab(page, 'community-created', '.community-panel');
      await L.shot(page, `c-community-created-${vp}`);
      const space = page.locator('.community-panel [data-group-space]').first();
      if (await space.count()) { await space.evaluate(b => b.click()); await L.sleep(2500); await L.grab(page, 'space-management', '[class*="space-management"], [class*="space-manage"], .space-panel'); await L.shot(page, `c-space-${vp}`); }
    }
    await L.log(page, 'log-c');
    L.save(`part-c-${vp}`);
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); L.save(`part-c-${vp}`); } finally { await browser.close(); }
})();
