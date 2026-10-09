// Part 3: personal space, community list/create/conversation as host, space management (events), corners, moderation, wardrobe, identity backup.
const S = require('/tmp/space-copy/panels-inv/dump.cjs');
S.watchdog(285);
(async () => {
  const browser = await S.launch();
  try {
    const run = await S.open(browser, process.argv[2] || 'phone');
    const { page } = run;
    await S.enter(run);
    // personal space
    await S.clickHidden(page, { open: 'personal' });
    await page.waitForSelector('.personal-space', { timeout: 20000 });
    await page.waitForFunction(() => !/正在读取本人空间/.test(document.querySelector('.personal-space')?.textContent || ''), null, { timeout: 20000 }).catch(() => {});
    await S.sleep(800);
    await S.dump(page, 'personal-space', '.personal-space');
    await page.evaluate(() => document.querySelector('.personal-space [data-space="close"]')?.click());
    await S.sleep(500);
    // room chat: linked community button (as a joined member)
    await S.clickHidden(page, { open: 'conversation' });
    await page.waitForSelector('.music-community:not([hidden])', { timeout: 20000 });
    await S.sleep(1200);
    await page.evaluate(() => document.querySelector('.music-community [data-group="linked"]')?.click());
    await S.sleep(1500);
    console.log('toasts-after-linked', JSON.stringify(await S.toasts(page)));
    await page.evaluate(() => document.querySelector('.music-community [data-group="close"]')?.click());
    await S.sleep(500);
    // community list
    await S.clickHidden(page, { open: 'communities' });
    await page.waitForSelector('.music-community form[data-community-create]', { timeout: 20000 });
    await S.sleep(800);
    await S.dump(page, 'communities-list', '.music-community');
    await page.fill('.music-community form[data-community-create] input[name="title"]', '月台 Livehouse 乐迷社群');
    await page.locator('.music-community form[data-community-create] input[name="consent"]').check({ force: true });
    await page.locator('.music-community form[data-community-create] button[type="submit"]').first().evaluate(b => b.click());
    await page.waitForSelector('.music-community [data-community]', { timeout: 20000 }).catch(() => console.log('no community row'));
    await S.sleep(1000);
    await S.dump(page, 'communities-list-after-create', '.music-community');
    await page.locator('.music-community [data-community]').first().evaluate(b => b.click());
    await page.waitForFunction(() => document.querySelector('.music-community .community-messages') || document.querySelector('.music-community [data-group-join]'), null, { timeout: 20000 }).catch(() => {});
    await S.sleep(1500);
    await S.dump(page, 'community-host', '.music-community');
    // space management
    await page.evaluate(() => document.querySelector('.music-community [data-group-space]')?.click());
    await page.waitForSelector('.space-management', { timeout: 20000 });
    await page.waitForFunction(() => !/正在读取空间和活动/.test(document.querySelector('.space-management')?.textContent || ''), null, { timeout: 20000 }).catch(() => {});
    await S.sleep(800);
    await S.dump(page, 'space-management', '.space-management');
    await page.evaluate(() => document.querySelectorAll('.space-management details').forEach(d => d.open = true));
    await page.fill('.space-management form[data-organization="event"] input[name="title"]', '下周六 · 晚班列车返场');
    await page.fill('.space-management form[data-organization="event"] input[name="venue"]', '月台 Livehouse');
    await page.fill('.space-management form[data-organization="event"] input[name="note"]', '老位置见');
    await page.locator('.space-management form[data-organization="event"] input[name="consent"]').check({ force: true });
    await page.locator('.space-management form[data-organization="event"] button').first().evaluate(b => b.click());
    await page.waitForSelector('.space-management .space-event', { timeout: 20000 }).catch(() => console.log('no event'));
    await S.sleep(1200);
    await page.evaluate(() => document.querySelectorAll('.space-management details').forEach(d => d.open = true));
    await S.dump(page, 'space-management-event', '.space-management');
    await page.evaluate(() => [...document.querySelectorAll('.space-management [data-organize="close"]')].pop()?.click());
    await S.sleep(1200);
    await S.dump(page, 'community-host-back', '.music-community');
    await page.evaluate(() => document.querySelector('.music-community [data-group="close"]')?.click());
    await S.sleep(600);
    // a friend for the corner: wave to 阿遥
    await S.clickHidden(page, { open: 'people' });
    await page.waitForSelector('.panel[data-kind="people"] [data-person]', { timeout: 20000 });
    await page.locator('#panel [data-person]').first().evaluate(b => b.click());
    await page.waitForSelector('.panel[data-kind="person"]', { timeout: 20000 });
    await S.sleep(800);
    const peer = await page.evaluate(() => document.querySelector('#panel [data-social-send]')?.dataset.socialSend || document.querySelector('#panel [data-open="feedback"]')?.dataset.id);
    await page.evaluate(() => document.querySelector('#panel [data-social-send]')?.click());
    await page.waitForSelector('#panel [data-open="chats"]', { timeout: 60000 }).catch(() => console.log('not accepted'));
    // moderation feedback about 阿遥 (the host) and about 小满
    const others = await page.evaluate(() => [...document.querySelectorAll('#panel [data-open="feedback"]')].map(b => b.dataset.id));
    console.log('feedback buttons', others.length);
    await S.clickHidden(page, { open: 'people' });
    await page.waitForSelector('.panel[data-kind="people"] [data-person]', { timeout: 20000 });
    await page.locator('#panel [data-person]').nth(1).evaluate(b => b.click());
    await page.waitForSelector('.panel[data-kind="person"]', { timeout: 20000 });
    await S.sleep(800);
    await S.dump(page, 'person-man');
    const fb = page.locator('#panel [data-open="feedback"]');
    if (await fb.count()) {
      await fb.first().evaluate(b => b.click());
      await page.waitForSelector('.room-moderation:not([hidden])', { timeout: 20000 });
      await S.sleep(800);
      await S.dump(page, 'moderation-feedback', '.room-moderation');
      await page.fill('.room-moderation textarea[name="details"]', '他一直挡在前面');
      await page.locator('.room-moderation input[name="consent"]').check({ force: true });
      await page.locator('.room-moderation button[type="submit"]').first().evaluate(b => b.click());
      await S.sleep(2500);
      await S.dump(page, 'moderation-my-reports', '.room-moderation');
      const wd = page.locator('.room-moderation [data-mod-withdraw]');
      if (await wd.count()) { await wd.first().evaluate(b => b.click()); await S.sleep(500); await S.dump(page, 'moderation-withdraw-confirm', '.room-moderation'); }
      await page.evaluate(() => document.querySelector('.room-moderation [data-mod-close]')?.click());
      await S.sleep(500);
    }
    // corners with 阿遥
    await S.clickHidden(page, { open: 'corners', id: peer });
    await page.waitForSelector('.corner-panel', { timeout: 20000 });
    await S.sleep(1500);
    await S.dump(page, 'corner-create', '.corner-panel');
    const cc = page.locator('.corner-panel form[data-corner-create]');
    if (await cc.count()) {
      await page.locator('.corner-panel form[data-corner-create] input[name="participation"]').check({ force: true });
      await page.locator('.corner-panel form[data-corner-create] button').first().evaluate(b => b.click());
      await S.sleep(3000);
      await S.dump(page, 'corner-after-create', '.corner-panel');
      await page.waitForFunction(() => document.querySelector('.corner-panel form[data-corner-edit]'), null, { timeout: 25000 }).catch(() => console.log('corner not joined by npc'));
      await S.sleep(800);
      await S.dump(page, 'corner-draft', '.corner-panel');
    }
    await page.evaluate(() => document.querySelector('.corner-panel [data-corner-list]')?.click());
    await S.sleep(1500);
    await S.dump(page, 'corner-list', '.corner-panel');
    await page.evaluate(() => document.querySelector('.corner-panel [data-corner-close]')?.click());
    await S.sleep(500);
    // wardrobe
    await S.press(run, '#my-look');
    await page.waitForSelector('.wardrobe:not([hidden])', { timeout: 20000 });
    await S.sleep(800);
    await S.dump(page, 'wardrobe', '.wardrobe');
    for (const cat of ['eyewear', 'palette', 'pose']) { await page.locator(`.wardrobe [data-category="${cat}"]`).first().evaluate(b => b.click()); await S.sleep(300); await S.dump(page, 'wardrobe-' + cat, '.wardrobe .wardrobe-count'); }
    await page.locator('.wardrobe [data-wardrobe-close]').first().evaluate(b => b.click());
    await S.sleep(500);
    // identity backup
    await S.clickHidden(page, { open: 'identity-backup' });
    await page.waitForSelector('.identity-continuity:not([hidden])', { timeout: 20000 });
    await S.sleep(500);
    await S.dump(page, 'identity-backup', '.identity-continuity');
    await page.evaluate(() => document.querySelector('.identity-continuity [data-identity-close]')?.click());
    console.log('errors', JSON.stringify(page.__errors));
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { await browser.close(); }
})();
