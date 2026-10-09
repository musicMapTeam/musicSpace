// W11: community edge states a Livehouse host can reach: 我愿意打招呼 in a community with no linked show, editing the community profile,
// archiving it, posting while archived, the community greet buttons in the seeded community.
const L = require('./lib.cjs');
L.watchdog(280);
const vp = process.argv[2] || 'phone';
L.setCorpus(`w11-${vp}`);
const openSettings = page => page.evaluate(() => { document.querySelectorAll('.music-community details').forEach(d => d.open = true); });
const toasts = page => page.evaluate(() => [...document.querySelectorAll('#toast,[role="alert"],[role="status"]')].filter(n => n.getClientRects().length).map(n => n.textContent.trim()).filter(Boolean));
(async () => {
  const browser = await L.launch();
  try {
    const run = await L.open(browser, vp);
    const { page } = run; page.__vp = vp;
    await L.ready(run);
    await L.enter(run);
    // seeded community: willing + greet
    await L.clickHidden(page, { open: 'conversation' });
    await page.waitForSelector('.music-community:not([hidden])', { timeout: 20000 });
    await L.sleep(1200);
    await page.evaluate(() => document.querySelector('.music-community [data-group="linked"]')?.click());
    await L.sleep(2000);
    if (await page.locator('.music-community form[data-group-join]').count()) {
      await page.locator('.music-community form[data-group-join] input[name="consent"]').check({ force: true });
      await page.locator('.music-community form[data-group-join] button[type="submit"]').first().evaluate(b => b.click());
      await L.sleep(2500);
    }
    await openSettings(page);
    await L.sleep(300);
    await page.evaluate(() => [...document.querySelectorAll('.music-community button')].find(b => /我愿意打招呼/.test(b.textContent))?.click());
    await L.sleep(2500);
    await openSettings(page);
    console.log('after willing (seeded):', JSON.stringify(await toasts(page)));
    await L.grab(page, 'seeded-community-willing', '.music-community');
    await L.shotScroll(page, 'w11-01-seeded-willing', '.music-community .conversation-content', 3);
    const greet = page.locator('.music-community [data-community-greet]');
    console.log('greet buttons:', await greet.count());
    if (await greet.count()) { await greet.first().evaluate(b => b.click()); await L.sleep(2500); console.log('after greet:', JSON.stringify(await toasts(page))); await openSettings(page); await L.grab(page, 'seeded-community-greeted', '.music-community'); }
    await page.evaluate(() => document.querySelector('.music-community [data-group="close"]')?.click());
    await L.sleep(600);
    // own community: willing without a linked show, then archive, then post while archived
    await L.clickHidden(page, { open: 'communities' });
    await page.waitForSelector('.music-community form[data-community-create]', { timeout: 20000 });
    await page.fill('.music-community form[data-community-create] input[name="title"]', '小酒馆乐迷社群');
    await page.locator('.music-community form[data-community-create] input[name="consent"]').check({ force: true });
    await page.locator('.music-community form[data-community-create] button[type="submit"]').first().evaluate(b => b.click());
    await L.sleep(2500);
    await page.evaluate(() => [...document.querySelectorAll('.music-community [data-community]')].find(b => /小酒馆/.test(b.textContent))?.click());
    await L.sleep(2200);
    await openSettings(page);
    await page.evaluate(() => [...document.querySelectorAll('.music-community button')].find(b => /我愿意打招呼/.test(b.textContent))?.click());
    await L.sleep(2500);
    await openSettings(page);
    console.log('after willing (own):', JSON.stringify(await toasts(page)));
    await L.grab(page, 'own-community-willing', '.music-community');
    await L.log(page, 'w11-a');
    // archive through 下一场预告 → 编辑社群资料
    await page.evaluate(() => document.querySelector('.music-community [data-group-space]')?.click());
    await page.waitForSelector('.space-management', { timeout: 20000 });
    await L.sleep(1500);
    await page.evaluate(() => document.querySelectorAll('.space-management details').forEach(d => d.open = true));
    await page.fill('.space-management form[data-organization="edit"] input[name="description"]', '每周五的小酒馆，散场后在这儿接着聊。').catch(e => console.log('no description field'));
    await page.selectOption('.space-management form[data-organization="edit"] select[name="archived"]', 'true').catch(() => console.log('no archive select'));
    await page.check('.space-management form[data-organization="edit"] input[name="consent"]', { force: true }).catch(() => console.log('no space consent'));
    await page.locator('.space-management form[data-organization="edit"] button:not([type="button"])').first().evaluate(b => b.click()).catch(() => console.log('no space save'));
    await L.sleep(2500);
    await page.evaluate(() => document.querySelectorAll('.space-management details').forEach(d => d.open = true));
    await L.grab(page, 'own-community-archived', '.space-management');
    await L.shotScroll(page, 'w11-02-archived', '.space-management .community-scroll', 4);
    // try to post a next show while archived
    if (await page.locator('.space-management form[data-organization="event"]').count()) {
      await page.fill('.space-management form[data-organization="event"] input[name="title"]', '下周六 · 返场夜');
      await page.locator('.space-management form[data-organization="event"] input[name="consent"]').check({ force: true }).catch(() => {});
      await page.locator('.space-management form[data-organization="event"] button').first().evaluate(b => b.click()).catch(() => {});
      await L.sleep(2500);
      console.log('after post while archived:', JSON.stringify(await toasts(page)));
      await L.grab(page, 'own-community-archived-post', '.space-management');
    } else console.log('event form hidden while archived');
    await page.evaluate(() => [...document.querySelectorAll('.space-management [data-organize="close"]')].pop()?.click());
    await L.sleep(1500);
    await L.grab(page, 'own-community-archived-chat', '.music-community');
    await L.shot(page, 'w11-03-archived-chat');
    await L.log(page, 'w11');
    console.log('errors', JSON.stringify(page.__errors));
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { L.flush(); await browser.close(); }
})();
