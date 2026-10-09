// C: personal space, community list/create/host view, next-show preview (space management), corners, feedback, wardrobe, identity backup.
const Q = require('/tmp/space-copy/panels-qa/qa.cjs');
Q.watchdog(295);
const kind = process.argv[2] || 'phone';
(async () => {
  const browser = await Q.launch();
  try {
    const run = await Q.open(browser, kind);
    const { page } = run;
    await Q.enter(run);
    await Q.clickHidden(page, { open: 'personal' });
    await page.waitForSelector('.personal-space', { timeout: 20000 });
    await page.waitForFunction(() => !/正在读取/.test(document.querySelector('.personal-space')?.textContent || ''), null, { timeout: 20000 }).catch(() => {});
    await Q.sleep(800);
    console.log('TEXT personal:', await Q.text(page, '.personal-space'));
    console.log('personal', JSON.stringify(await Q.audit(page, '.personal-space')));
    await Q.snapScroll(page, 'personal', kind, '.personal-space .community-scroll', 3);
    await page.evaluate(() => document.querySelector('.personal-space [data-space="close"]')?.click());
    await Q.sleep(500);
    await Q.clickHidden(page, { open: 'communities' });
    await page.waitForSelector('.music-community form[data-community-create]', { timeout: 20000 });
    await Q.sleep(800);
    console.log('TEXT communities:', await Q.text(page, '.music-community'));
    console.log('communities', JSON.stringify(await Q.audit(page, '.music-community')));
    await Q.snapScroll(page, 'communities', kind, '.music-community .community-scroll', 2);
    await page.fill('.music-community form[data-community-create] input[name="title"]', '月台 Livehouse 乐迷社群');
    await page.locator('.music-community form[data-community-create] input[name="consent"]').check({ force: true });
    await page.locator('.music-community form[data-community-create] button[type="submit"]').first().evaluate(b => b.click());
    await page.waitForSelector('.music-community [data-community]', { timeout: 20000 }).catch(() => console.log('no community row'));
    await Q.sleep(1000);
    await page.locator('.music-community [data-community]').last().evaluate(b => b.click());
    await page.waitForFunction(() => document.querySelector('.music-community .community-messages') || document.querySelector('.music-community [data-group-join]'), null, { timeout: 20000 }).catch(() => {});
    await Q.sleep(1500);
    await page.evaluate(() => { const d = document.querySelector('.music-community .conversation-management'); if (d) d.open = true; document.querySelectorAll('.music-community details').forEach(d => d.open = true); });
    await Q.sleep(400);
    console.log('TEXT community-host:', await Q.text(page, '.music-community'));
    console.log('community-host', JSON.stringify(await Q.audit(page, '.music-community')));
    await Q.snapScroll(page, 'community-host', kind, '.music-community .conversation-content', 3);
    await page.evaluate(() => document.querySelector('.music-community [data-group-space]')?.click());
    await page.waitForSelector('.space-management', { timeout: 20000 });
    await page.waitForFunction(() => !/正在读取/.test(document.querySelector('.space-management')?.textContent || ''), null, { timeout: 20000 }).catch(() => {});
    await Q.sleep(800);
    await page.evaluate(() => document.querySelectorAll('.space-management details').forEach(d => d.open = true));
    await Q.sleep(300);
    console.log('TEXT space:', await Q.text(page, '.space-management'));
    console.log('space', JSON.stringify(await Q.audit(page, '.space-management')));
    await Q.snapScroll(page, 'space', kind, '.space-management .community-scroll', 4);
    await page.fill('.space-management form[data-organization="event"] input[name="title"]', '下周六 · 晚班列车返场');
    await page.fill('.space-management form[data-organization="event"] input[name="venue"]', '月台 Livehouse');
    await page.fill('.space-management form[data-organization="event"] input[name="note"]', '老位置见');
    await page.locator('.space-management form[data-organization="event"] input[name="consent"]').check({ force: true });
    await page.locator('.space-management form[data-organization="event"] button').first().evaluate(b => b.click());
    await page.waitForSelector('.space-management .space-event', { timeout: 20000 }).catch(() => console.log('no event'));
    await Q.sleep(1200);
    await page.evaluate(() => document.querySelectorAll('.space-management details').forEach(d => d.open = true));
    console.log('TEXT space-event:', await Q.text(page, '.space-management'));
    await Q.snapScroll(page, 'space-event', kind, '.space-management .community-scroll', 4);
    await page.evaluate(() => [...document.querySelectorAll('.space-management [data-organize="close"]')].pop()?.click());
    await Q.sleep(1200);
    await page.evaluate(() => document.querySelector('.music-community [data-group="close"]')?.click());
    await Q.sleep(600);
    // a friend: wave to 阿遥, then corners
    await Q.clickHidden(page, { open: 'people' });
    await page.waitForSelector('.panel[data-kind="people"] [data-person]', { timeout: 20000 });
    await page.locator('#panel [data-person]').first().evaluate(b => b.click());
    await page.waitForSelector('.panel[data-kind="person"]', { timeout: 20000 });
    await Q.sleep(800);
    const peer = await page.evaluate(() => document.querySelector('#panel [data-social-send]')?.dataset.socialSend || document.querySelector('#panel [data-open="feedback"]')?.dataset.id);
    await page.evaluate(() => document.querySelector('#panel [data-social-send]')?.click());
    await page.waitForSelector('#panel [data-open="chats"]', { timeout: 60000 }).catch(() => console.log('not accepted'));
    // feedback on the host and on 小满
    const hostErr = await page.evaluate(() => { const b = document.querySelector('#panel [data-open="feedback"]'); if (!b) return 'no host feedback button'; b.click(); return 'clicked'; });
    await Q.sleep(800);
    console.log('host feedback:', hostErr, JSON.stringify(await Q.toasts(page)));
    await page.evaluate(() => document.querySelector('.room-moderation [data-mod-close]')?.click());
    await Q.clickHidden(page, { open: 'people' });
    await page.waitForSelector('.panel[data-kind="people"] [data-person]', { timeout: 20000 });
    await page.locator('#panel [data-person]').nth(1).evaluate(b => b.click());
    await page.waitForSelector('.panel[data-kind="person"]', { timeout: 20000 });
    await Q.sleep(800);
    const fb = page.locator('#panel [data-open="feedback"]');
    if (await fb.count()) {
      await fb.first().evaluate(b => b.click());
      await page.waitForSelector('.room-moderation:not([hidden])', { timeout: 20000 });
      await Q.sleep(800);
      console.log('TEXT feedback:', await Q.text(page, '.room-moderation'));
      console.log('feedback', JSON.stringify(await Q.audit(page, '.room-moderation')));
      await Q.snapScroll(page, 'feedback', kind, '.room-moderation .moderation-body', 3);
      await page.fill('.room-moderation textarea[name="details"]', '他一直挡在前面');
      await page.locator('.room-moderation input[name="consent"]').check({ force: true });
      await page.locator('.room-moderation button[type="submit"]').first().evaluate(b => b.click());
      await Q.sleep(2500);
      console.log('TEXT my-reports:', await Q.text(page, '.room-moderation'));
      await Q.snapScroll(page, 'my-reports', kind, '.room-moderation .moderation-body', 2);
      const wd = page.locator('.room-moderation [data-mod-withdraw]');
      if (await wd.count()) { await wd.first().evaluate(b => b.click()); await Q.sleep(500); console.log('TEXT withdraw-confirm:', await Q.text(page, '.room-moderation .moderation-confirm')); }
      await page.evaluate(() => document.querySelector('.room-moderation [data-mod-close]')?.click());
      await Q.sleep(500);
    }
    // corners with 阿遥
    await Q.clickHidden(page, { open: 'corners', id: peer });
    await page.waitForSelector('.corner-panel', { timeout: 20000 });
    await Q.sleep(1500);
    console.log('TEXT corner-create:', await Q.text(page, '.corner-panel'));
    await Q.snap(page, 'corner-create', kind);
    const cc = page.locator('.corner-panel form[data-corner-create]');
    if (await cc.count()) {
      await page.locator('.corner-panel form[data-corner-create] input[name="participation"]').check({ force: true });
      await page.locator('.corner-panel form[data-corner-create] button').first().evaluate(b => b.click());
      await Q.sleep(3000);
      console.log('TEXT corner-after-create:', await Q.text(page, '.corner-panel'));
      await page.waitForFunction(() => document.querySelector('.corner-panel form[data-corner-edit]'), null, { timeout: 25000 }).catch(() => console.log('corner not joined by npc'));
      await Q.sleep(800);
      console.log('TEXT corner-draft:', await Q.text(page, '.corner-panel'));
      console.log('corner', JSON.stringify(await Q.audit(page, '.corner-panel')));
      await Q.snapScroll(page, 'corner-draft', kind, '.corner-panel .community-scroll', 4);
    }
    await page.evaluate(() => document.querySelector('.corner-panel [data-corner-list]')?.click());
    await Q.sleep(1500);
    console.log('TEXT corner-list:', await Q.text(page, '.corner-panel'));
    await Q.snap(page, 'corner-list', kind);
    await page.evaluate(() => document.querySelector('.corner-panel [data-corner-close]')?.click());
    await Q.sleep(500);
    // wardrobe
    await Q.press(run, '#my-look');
    await page.waitForSelector('.wardrobe:not([hidden])', { timeout: 20000 });
    await Q.sleep(800);
    await page.evaluate(() => { const d = document.querySelector('.wardrobe details'); if (d) d.open = true; d?.scrollIntoView({ block: 'center' }); });
    await Q.sleep(300);
    console.log('TEXT wardrobe-presets:', await Q.text(page, '.wardrobe .wardrobe-examples'));
    await Q.snap(page, 'wardrobe', kind);
    await page.locator('.wardrobe [data-wardrobe-close]').first().evaluate(b => b.click());
    await Q.sleep(500);
    const hasBackup = await page.evaluate(() => Boolean(document.querySelector('.identity-continuity')));
    if (hasBackup) { await Q.clickHidden(page, { open: 'identity-backup' }); await Q.sleep(800); console.log('TEXT identity:', await Q.text(page, '.identity-continuity')); await Q.snap(page, 'identity', kind); }
    console.log('errors', JSON.stringify(page.__errors));
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { await browser.close(); }
})();
