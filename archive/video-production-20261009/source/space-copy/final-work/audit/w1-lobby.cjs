// W1: loading, first screen, entry sheet (+ host details), About, entering, the 第一次来 card, room panel, people, every person card.
const L = require('./lib.cjs');
L.watchdog(285);
const vp = process.argv[2] || 'phone';
L.setCorpus(`w1-${vp}`);
(async () => {
  const browser = await L.launch();
  try {
    const run = await L.open(browser, vp);
    const { page } = run; page.__vp = vp;
    await L.sleep(150);
    await L.grab(page, 'loading', 'body');
    await L.shot(page, 'w1-00-loading');
    await L.ready(run);
    await L.sleep(1200);
    await L.grab(page, 'lobby', 'body');
    await L.shot(page, 'w1-01-lobby');
    await L.check(page, 'lobby', '.frame');
    // entry
    await L.press(run, '#join');
    await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 30000 });
    await L.sleep(700);
    await L.grab(page, 'entry', '#panel');
    await L.shotScroll(page, 'w1-02-entry');
    await L.check(page, 'entry', '#panel');
    await page.locator('#panel details.demo-entry-more summary').first().evaluate(s => s.click());
    await L.sleep(400);
    await page.evaluate(() => { const p = document.querySelector('#panel'); p.scrollTop = p.scrollHeight; });
    await L.grab(page, 'entry-host-details', '#panel details.demo-entry-more');
    await L.shot(page, 'w1-03-entry-host');
    await L.check(page, 'entry-host', '#panel');
    // the host create panel from the entry sheet
    await L.js(page, '#panel details.demo-entry-more [data-open="create"]');
    await L.sleep(900);
    await L.grab(page, 'create-from-entry', '#panel');
    await L.shotScroll(page, 'w1-04-create-from-entry');
    await L.check(page, 'create-from-entry', '#panel');
    await L.closeSheet(page);
    await L.sleep(400);
    // About from the footer
    const footer = await page.evaluate(() => document.querySelector('#evidence')?.innerText);
    console.log('footer:', footer);
    await page.locator('#evidence button, #evidence [data-open="about"]').first().evaluate(b => b.click());
    await L.sleep(900);
    await L.grab(page, 'about', '#panel');
    await L.shotScroll(page, 'w1-05-about');
    await L.check(page, 'about', '#panel');
    await L.closeSheet(page);
    // wardrobe from the entry (before identity)
    await L.press(run, '#join');
    await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 30000 });
    await L.js(page, 'form[data-form="demo-entry"] [data-open="wardrobe"]');
    await page.waitForSelector('.wardrobe:not([hidden])', { timeout: 20000 }).catch(() => console.log('no wardrobe'));
    await L.sleep(800);
    await L.grab(page, 'wardrobe-before-entry', '.wardrobe');
    await L.shot(page, 'w1-06-wardrobe-pre');
    await page.locator('.wardrobe [data-wardrobe-close]').first().evaluate(b => b.click()).catch(() => {});
    await L.sleep(600);
    await L.closeSheet(page);
    // enter
    await L.enter(run);
    await L.sleep(1500);
    await L.grab(page, 'room-first', 'body');
    await L.shot(page, 'w1-07-room-tour');
    await L.check(page, 'room-tour', '.frame');
    await page.locator('[data-tour-toggle]').first().evaluate(b => b.click());
    await L.sleep(500);
    await L.grab(page, 'tour-collapsed', '#demo-tour, .demo-tour');
    await L.shot(page, 'w1-08-tour-collapsed');
    await page.locator('[data-tour-toggle]').first().evaluate(b => b.click());
    await L.sleep(300);
    // room panel
    await L.js(page, '#join');
    await L.sleep(900);
    await L.grab(page, 'room-panel', '#panel');
    await L.shotScroll(page, 'w1-09-room-panel');
    await L.check(page, 'room-panel', '#panel');
    // participation change sheet
    const part = page.locator('#panel [data-open="participation"], #panel [data-form="participation"], #panel [data-participation]');
    console.log('participation controls:', await part.count());
    await L.closeSheet(page);
    // people
    await L.clickHidden(page, { view: 'person' });
    await L.sleep(1200);
    await L.grab(page, 'view-person', 'body');
    await L.shot(page, 'w1-10-view-person');
    await L.clickHidden(page, { open: 'people' });
    await L.sleep(900);
    await L.grab(page, 'people', '#panel');
    await L.shot(page, 'w1-11-people');
    await L.check(page, 'people', '#panel');
    const n = await page.locator('#panel [data-person]').count();
    console.log('people buttons', n);
    for (let i = 0; i < n; i++) {
      await L.clickHidden(page, { open: 'people' });
      await page.waitForSelector('#panel [data-person]', { timeout: 20000 });
      const name = await page.locator('#panel [data-person]').nth(i).innerText();
      await page.locator('#panel [data-person]').nth(i).evaluate(b => b.click());
      await L.sleep(1300);
      await L.grab(page, `person-${i}-${name.split('\n')[0]}`, '#panel');
      await L.shotScroll(page, `w1-12-person-${i}`, '#panel', 2);
      await L.check(page, `person-${i}`, '#panel');
    }
    // the visitor's own card via the view label / my-look
    await L.clickHidden(page, { view: 'photos' });
    await L.sleep(1200);
    await L.grab(page, 'view-photos', 'body');
    await L.shot(page, 'w1-13-view-photos');
    await L.clickHidden(page, { view: 'overview' });
    await L.sleep(800);
    await L.log(page, 'w1');
    console.log('errors', JSON.stringify(page.__errors));
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { L.flush(); await browser.close(); }
})();
