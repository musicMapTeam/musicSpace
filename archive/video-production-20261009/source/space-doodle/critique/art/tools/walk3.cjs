// walk3: social screens — person card, inbox, friends, chat, community, World Cup, games, topics, communities, corner, 我的空间 (nav), wardrobe (header).
// usage: node walk3.cjs <phone|desktop>
const L = require('./lib.cjs');
L.watchdog(295);
const kind = process.argv[2] || 'phone';
const sleep = L.sleep;
(async () => {
  const b = await L.launch();
  const { page } = await L.open(b, kind);
  try {
    await L.enter(page);
    const skip = page.locator('button:visible', { hasText: '跳过路线' }); if (await skip.count()) await skip.first().click().catch(() => {});
    await sleep(800);
    const ppl = await L.people(page); console.log('people', JSON.stringify(ppl));
    const ayao = ppl.find(p => p.label.includes('阿遥')) || ppl[0]; const xiaoman = ppl.find(p => p.label.includes('小满')) || ppl[1];
    // person card via the 3D tag (real click)
    const tag = page.locator(`#hotspots [data-scene-target="${ayao.id}"]`);
    if (await tag.isVisible().catch(() => false)) { await tag.click(); await sleep(2200); } else { await L.openKind(page, 'person', ayao.id); await sleep(800); }
    await L.shot(page, 'c01-person-card', kind, { scope: '#panel' });
    const greet = page.locator('#panel-body [data-social-send]'); if (await greet.count()) { await greet.first().click(); await sleep(400); await L.shot(page, 'c02-person-greeted', kind, { scope: '#panel', settle: 300 }); await sleep(800); }
    await L.closeEverything(page);
    await L.openKind(page, 'person', xiaoman.id); const g2 = page.locator('#panel-body [data-social-send]'); if (await g2.count()) { await g2.first().click(); await sleep(1000); }
    await L.closeEverything(page);
    // inbox via the header heart (real click)
    await page.click('#social-inbox').catch(() => {}); await sleep(1500);
    await L.shot(page, 'c03-inbox-pending', kind);
    await L.closeEverything(page);
    await sleep(8000);
    await page.click('#social-inbox').catch(() => {}); await sleep(1500);
    await L.shot(page, 'c04-inbox', kind);
    await L.openKind(page, 'friends'); await sleep(800); await L.shot(page, 'c05-friends', kind);
    await L.openKind(page, 'person', ayao.id); await sleep(900); await L.shot(page, 'c06-person-friend', kind);
    // chat
    await L.openKind(page, 'chats', ayao.id); await sleep(2000);
    const ta = page.locator('.private-chat textarea');
    if (await ta.count() && await ta.isEnabled()) { await ta.fill('刚刚返场那首我也拍到了！你在哪个位置？'); await page.locator('.private-chat .chat-composer button[type=submit]').click(); await sleep(1500); }
    await L.closeEverything(page); await sleep(8000);
    await L.openKind(page, 'chats', ayao.id); await sleep(2500);
    await L.shot(page, 'c07-chat', kind, { scope: '.private-chat' });
    const back = page.locator('.private-chat .chat-back'); if (await back.isVisible().catch(() => false)) { await back.click(); await sleep(1200); await L.shot(page, 'c08-chat-list', kind, { scope: '.private-chat' }); }
    await L.closeEverything(page);
    // community: room conversation
    await L.openKind(page, 'conversation'); await sleep(2000);
    await L.shot(page, 'c09-community-join', kind);
    const join = page.locator('.community-panel form[data-group-join]');
    if (await join.count()) { await join.locator('input[name=consent]').check(); await join.locator('button[type=submit]').click(); await sleep(2500); }
    await L.shot(page, 'c10-community', kind);
    const wc = page.locator('.community-panel [data-group-worldcup]');
    if (await wc.count()) {
      await wc.first().click(); await sleep(2500); await L.shot(page, 'c11-worldcup', kind);
      const cupBtn = page.locator('.worldcup-panel .entry-list button').first();
      if (await cupBtn.count()) {
        await cupBtn.click(); await sleep(2500); await L.shot(page, 'c12-worldcup-detail', kind);
        const vote = page.locator('.worldcup-panel [data-cup-choice]').first();
        if (await vote.count()) { await vote.click(); await sleep(600); const vf = page.locator('.worldcup-panel form[data-cup-vote]'); if (await vf.count()) { await vf.locator('input[name=consent]').check(); await vf.locator('button[type=submit]').click(); await sleep(2500); } await page.evaluate(() => document.querySelector('.worldcup-panel .community-scroll')?.scrollTo(0, 0)); await L.shot(page, 'c13-worldcup-voted', kind); }
      }
      await page.locator('.worldcup-panel header [data-cup-close]').click().catch(() => {}); await sleep(1200);
    }
    const gm = page.locator('.community-panel [data-group-games]');
    if (await gm.count()) {
      await gm.first().click(); await sleep(2500); await L.shot(page, 'c14-game-list', kind);
      const gBtn = page.locator('.music-games .entry-list button').first();
      if (await gBtn.count()) {
        await gBtn.click(); await sleep(2500); await L.shot(page, 'c15-game-detail', kind);
        const jf = page.locator('.music-games form[data-game-form="join"]');
        if (await jf.count()) { await jf.locator('input[name=consent]').check(); await jf.locator('button').click(); await sleep(7000); const ch = page.locator('.music-games [data-game-choice]').first(); if (await ch.count()) { await ch.click(); await sleep(800); } await L.shot(page, 'c16-game', kind); }
      }
      await page.locator('.music-games header [data-game="close"]').click().catch(() => {}); await sleep(1200);
    }
    const tp = page.locator('.community-panel [data-group-topics]');
    if (await tp.count()) { await tp.first().click(); await sleep(2500); await L.shot(page, 'c17-topics', kind); await page.locator('.music-topics header [data-topic="close"]').click().catch(() => {}); await sleep(1200); }
    await L.closeEverything(page);
    await L.openKind(page, 'communities'); await sleep(2000); await L.shot(page, 'c18-communities', kind); await L.closeEverything(page);
    await L.openKind(page, 'corners', ayao.id); await sleep(2500); await L.shot(page, 'c19-corner', kind); await L.closeEverything(page);
    // 我的空间 via the nav (real click)
    await page.click('#my-space').catch(() => {}); await sleep(2500); await L.shot(page, 'c20-my-space', kind);
    await page.evaluate(() => { const s = document.querySelector('.personal-space .community-scroll, .personal-space'); if (s) s.scrollTop = s.scrollHeight; }); await sleep(500); await L.shot(page, 'c21-my-space-end', kind);
    await L.closeEverything(page);
    // wardrobe via the header (real click)
    await page.click('#my-look').catch(() => {}); await sleep(2500); await L.shot(page, 'c22-wardrobe', kind);
    await page.evaluate(() => { const s = document.querySelector('.wardrobe .wardrobe-body, .wardrobe [class*=scroll], .wardrobe'); if (s) s.scrollTop = 600; }); await sleep(500); await L.shot(page, 'c23-wardrobe-scrolled', kind);
    await L.closeEverything(page);
    // music map
    const mm = page.locator('#music-map-entry'); if (await mm.isVisible().catch(() => false)) { await mm.click(); await sleep(3000); await L.shot(page, 'c24-musicmap', kind, { audit: false }); }
    console.log('logs', JSON.stringify(page.__logs.slice(0, 10)));
  } catch (e) { console.error('ERR', e.message.split('\n')[0]); await page.screenshot({ path: `${L.OUT}/ERR-walk3-${kind}.png` }).catch(() => {}); }
  await b.close();
})();
