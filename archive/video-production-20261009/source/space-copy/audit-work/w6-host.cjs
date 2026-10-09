// W6: a Livehouse opens its own room from the lobby (开个房): profile, create form, the own room (tour, room panel as host, moderation
// tabs, group chat as host with the community link form), its own fan community (create, link, 下一场预告 as host + post), own recap,
// memory card with photo + avatar, the close / leave / withdraw / delete confirmations.
const L = require('./lib.cjs');
const fs = require('fs');
L.watchdog(295);
const vp = process.argv[2] || 'phone';
L.setCorpus(`w6-${vp}`);
const openSettings = page => page.evaluate(() => { document.querySelectorAll('.music-community details').forEach(d => d.open = true); });
(async () => {
  const browser = await L.launch();
  try {
    const run = await L.open(browser, vp);
    const { page } = run; page.__vp = vp;
    await L.ready(run);
    await L.press(run, '#join');
    await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 30000 });
    await page.locator('#panel details.demo-entry-more summary').first().evaluate(s => s.click());
    await L.sleep(300);
    await L.js(page, '#panel details.demo-entry-more [data-open="create"]');
    await L.sleep(800);
    const nameNow = await page.inputValue('#panel form[data-form="profile"] input[name="name"]').catch(() => '');
    console.log('profile name prefilled:', JSON.stringify(nameNow));
    await L.grab(page, 'profile-before-create', '#panel');
    if (!nameNow) await page.fill('#panel form[data-form="profile"] input[name="name"]', '小酒馆阿杰');
    await L.js(page, '#panel form[data-form="profile"] button[type="submit"]');
    await page.waitForSelector('form[data-form="create"]', { timeout: 30000 }).catch(async () => { await L.grab(page, 'profile-submit-stuck', 'body'); await L.shot(page, 'w6-00-stuck'); throw new Error('create form never came'); });
    await L.sleep(800);
    await L.grab(page, 'create-form', '#panel');
    await L.shotScroll(page, 'w6-01-create', '#panel', 3);
    await L.check(page, 'create-form', '#panel');
    await page.fill('form[data-form="create"] input[name="title"]', '周五的最后一首');
    await page.fill('form[data-form="create"] input[name="venue"]', '小酒馆 Livehouse');
    const consent = page.locator('form[data-form="create"] input[name="consent"]');
    if (await consent.count()) await consent.check({ force: true });
    await page.locator('form[data-form="create"] button[type="submit"]').first().evaluate(b => b.click());
    await page.waitForFunction(() => /周五的最后一首/.test(document.querySelector('#room-title')?.textContent || ''), null, { timeout: 30000 }).catch(() => console.log('room not opened'));
    await L.sleep(2000);
    await L.grab(page, 'own-room', '.frame');
    await L.shot(page, 'w6-02-own-room');
    // room panel as host
    await L.js(page, '#join');
    await L.sleep(1000);
    await L.grab(page, 'own-room-panel', '#panel');
    await L.shotScroll(page, 'w6-03-own-room-panel', '#panel', 3);
    await L.check(page, 'own-room-panel', '#panel');
    await L.closeSheet(page);
    // moderation tabs
    await L.clickHidden(page, { open: 'moderation' });
    await page.waitForSelector('.room-moderation:not([hidden])', { timeout: 20000 });
    await L.sleep(1200);
    await L.grab(page, 'mod-reports', '.room-moderation');
    await L.shot(page, 'w6-04-mod-reports');
    for (const tab of ['members', 'exclusions']) { await page.evaluate(t => document.querySelector(`.room-moderation [data-mod-tab="${t}"]`)?.click(), tab); await L.sleep(800); await L.grab(page, `mod-${tab}`, '.room-moderation'); await L.shot(page, `w6-05-mod-${tab}`); }
    await page.evaluate(() => document.querySelector('.room-moderation [data-mod-close]')?.click());
    await L.sleep(500);
    // the close-entry confirmation
    await L.clickHidden(page, { open: 'close' });
    await L.sleep(700);
    await L.grab(page, 'close-confirm', '#panel');
    await L.shot(page, 'w6-06-close-confirm');
    await L.clickHidden(page, { open: 'leave' });
    await L.sleep(700);
    await L.grab(page, 'leave-confirm', '#panel');
    await L.closeSheet(page);
    // own fan community: create, then link from the room chat
    await L.clickHidden(page, { open: 'communities' });
    await page.waitForSelector('.music-community form[data-community-create]', { timeout: 20000 });
    await L.sleep(1000);
    await L.grab(page, 'communities-host-empty', '.music-community');
    await L.shot(page, 'w6-07-communities-empty');
    await page.fill('.music-community form[data-community-create] input[name="title"]', '小酒馆乐迷社群');
    await page.locator('.music-community form[data-community-create] input[name="consent"]').check({ force: true });
    await page.locator('.music-community form[data-community-create] button[type="submit"]').first().evaluate(b => b.click());
    await L.sleep(2500);
    await L.grab(page, 'communities-host-created', '.music-community');
    await page.evaluate(() => [...document.querySelectorAll('.music-community [data-community]')].find(b => /小酒馆/.test(b.textContent))?.click());
    await page.waitForFunction(() => document.querySelector('.music-community .community-messages') || document.querySelector('.music-community [data-group-join]'), null, { timeout: 20000 }).catch(() => {});
    await L.sleep(2000);
    await L.grab(page, 'host-community', '.music-community');
    await L.shot(page, 'w6-08-host-community');
    await openSettings(page);
    await L.sleep(400);
    await L.grab(page, 'host-community-settings', '.music-community');
    await L.shotScroll(page, 'w6-09-host-community-settings', '.music-community .conversation-content', 4);
    await page.evaluate(() => document.querySelectorAll('.music-community details').forEach(d => d.open = false));
    // 下一场预告 as the host
    await page.evaluate(() => document.querySelector('.music-community [data-group-space]')?.click());
    await page.waitForSelector('.space-management', { timeout: 20000 });
    await page.waitForFunction(() => !/正在读取/.test(document.querySelector('.space-management')?.textContent || ''), null, { timeout: 20000 }).catch(() => {});
    await L.sleep(1000);
    await page.evaluate(() => document.querySelectorAll('.space-management details').forEach(d => d.open = true));
    await L.sleep(300);
    await L.grab(page, 'host-next-show', '.space-management');
    await L.shotScroll(page, 'w6-10-host-next-show', '.space-management .community-scroll', 5);
    await L.check(page, 'host-next-show', '.space-management');
    const ev = page.locator('.space-management form[data-organization="event"]');
    if (await ev.count()) {
      await page.fill('.space-management form[data-organization="event"] input[name="title"]', '下周六 · 返场夜');
      await page.fill('.space-management form[data-organization="event"] input[name="venue"]', '小酒馆 Livehouse').catch(() => {});
      await page.fill('.space-management form[data-organization="event"] input[name="note"]', '老位置见').catch(() => {});
      await page.locator('.space-management form[data-organization="event"] input[name="consent"]').check({ force: true }).catch(() => {});
      await page.locator('.space-management form[data-organization="event"] button').first().evaluate(b => b.click());
      await page.waitForSelector('.space-management .space-event', { timeout: 20000 }).catch(() => console.log('no event'));
      await L.sleep(1500);
      await page.evaluate(() => document.querySelectorAll('.space-management details').forEach(d => d.open = true));
      await L.grab(page, 'host-next-show-posted', '.space-management');
      await L.shotScroll(page, 'w6-11-host-next-show-posted', '.space-management .community-scroll', 5);
      await L.check(page, 'host-next-show-posted', '.space-management');
    }
    // edit community profile form
    await L.grab(page, 'host-next-show-final', '.space-management');
    await page.evaluate(() => [...document.querySelectorAll('.space-management [data-organize="close"]')].pop()?.click());
    await L.sleep(1200);
    await page.evaluate(() => document.querySelector('.music-community [data-group="close"]')?.click());
    await L.sleep(600);
    // the room chat as host: link form
    await L.clickHidden(page, { open: 'conversation' });
    await page.waitForSelector('.music-community:not([hidden])', { timeout: 20000 });
    await L.sleep(1500);
    const join = page.locator('.music-community form[data-group-join]');
    if (await join.count()) {
      await page.locator('.music-community form[data-group-join] input[name="consent"]').check({ force: true });
      await page.locator('.music-community form[data-group-join] button[type="submit"]').first().evaluate(b => b.click());
      await L.sleep(2500);
    }
    await openSettings(page);
    await L.sleep(400);
    await L.grab(page, 'host-room-chat', '.music-community');
    await L.shotScroll(page, 'w6-12-host-room-chat', '.music-community .conversation-content', 4);
    const link = page.locator('.music-community form[data-community-link] button');
    if (await link.count()) { await link.first().evaluate(b => b.click()); await L.sleep(2500); await openSettings(page); await L.grab(page, 'host-room-chat-linked', '.music-community'); await L.shot(page, 'w6-13-linked'); }
    await page.evaluate(() => document.querySelector('.music-community [data-group="linked"]')?.click());
    await L.sleep(2000);
    await L.grab(page, 'host-linked-community', '.music-community');
    await page.evaluate(() => document.querySelector('.music-community [data-group="close"]')?.click());
    await L.sleep(600);
    // a photo in the own room: then withdraw/delete confirmations, own recap and memory card
    await L.clickHidden(page, { open: 'upload' });
    await page.waitForSelector('form[data-form="upload"]', { timeout: 20000 });
    await L.grab(page, 'own-room-upload-empty', '#panel');
    await page.setInputFiles('form[data-form="upload"] input[type="file"]', { name: 'mine.jpg', mimeType: 'image/jpeg', buffer: fs.readFileSync('/tmp/space-copy/audit/dist-pages/demo/man-near.jpg') });
    await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
    await L.aiSettled(page); await L.sleep(1500);
    await L.grab(page, 'own-room-upload', '#panel');
    await page.locator('form[data-form="upload"] .moment-chip[data-moment-viewpoint="friends"]').first().evaluate(b => b.click()).catch(() => {});
    await L.sleep(300);
    await L.grab(page, 'own-room-upload-chosen', 'form[data-form="upload"]');
    await page.locator('form[data-form="upload"] button[type="submit"]').first().evaluate(b => b.click());
    await L.sleep(3000);
    await L.grab(page, 'own-room-wall', '#panel');
    await L.shotScroll(page, 'w6-14-own-wall', '#panel', 3);
    // photo detail of my photo
    const myPhoto = await page.evaluate(() => window.__SPACE_EVENT_QA__().photos.find(p => p.ownerId === window.__SPACE_EVENT_QA__().actorId)?.id);
    if (myPhoto) {
      await L.clickHidden(page, { open: 'photo', id: myPhoto });
      await L.sleep(1200);
      await L.grab(page, 'own-photo-detail', '#panel');
      await L.shotScroll(page, 'w6-15-own-photo', '#panel', 3);
      await L.clickHidden(page, { open: 'withdraw', id: myPhoto }); await L.sleep(600); await L.grab(page, 'withdraw-confirm', '#panel'); await L.shot(page, 'w6-16-withdraw');
      await L.clickHidden(page, { open: 'delete', id: myPhoto }); await L.sleep(600); await L.grab(page, 'delete-confirm', '#panel'); await L.shot(page, 'w6-17-delete');
    }
    await L.closeSheet(page);
    await L.clickHidden(page, { open: 'recap' });
    await page.waitForSelector('.panel[data-kind="recap"]', { timeout: 30000 });
    await L.sleep(1800);
    await L.grab(page, 'own-recap', '#panel');
    await L.shotScroll(page, 'w6-18-own-recap', '#panel', 5);
    await page.locator('#panel [data-open="memory-card"]').first().evaluate(b => b.click());
    await page.waitForSelector('form[data-form="memory-card"]', { timeout: 20000 });
    await L.sleep(900);
    // pick the photo and the avatar
    await page.evaluate(() => { for (const box of document.querySelectorAll('form[data-form="memory-card"] input[type="checkbox"]')) if (box.name !== 'memory-confirm' && !box.checked) box.click(); });
    await L.sleep(500);
    await L.grab(page, 'own-memory-form', '#panel');
    await L.shotScroll(page, 'w6-19-own-memory', '#panel', 4);
    await page.locator('form[data-form="memory-card"] input[name="memory-confirm"]').check({ force: true }).catch(() => {});
    await page.locator('form[data-form="memory-card"] button[type="submit"]').first().evaluate(b => b.click());
    await page.waitForSelector('.memory-result img', { timeout: 30000 }).catch(() => console.log('no memory preview'));
    await L.sleep(1000);
    const src = await page.evaluate(() => document.querySelector('.memory-result img')?.src);
    if (src) { const b64 = await page.evaluate(async src => { const r = await fetch(src); const b = await r.blob(); return await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); }); }, src); fs.writeFileSync(`${L.OUT}/${vp}-memory-card-photo.png`, Buffer.from(b64.split(',')[1], 'base64')); console.log('saved memory png'); }
    await L.closeSheet(page);
    // my rooms list
    await L.clickHidden(page, { open: 'rooms' });
    await L.sleep(1200);
    await L.grab(page, 'my-rooms', '#panel');
    await L.shotScroll(page, 'w6-20-my-rooms', '#panel', 2);
    await L.log(page, 'w6');
    console.log('errors', JSON.stringify(page.__errors));
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { L.flush(); await browser.close(); }
})();
