// The judge route for the panels task: sticky × on every long sheet, every sheet opening at its top, captions of the recap/library polaroids.
// usage: node route.cjs <phone|desktop|narrow> <lobby|room|social>
const S = require('./sheets.cjs');
const path = require('path');
S.watchdog(285);
const vp = process.argv[2] || 'phone';
const part = process.argv[3] || 'room';
const OUT = process.env.SHOTS_OUT || '/tmp/space-doodle/shots/panels';
const file = name => path.join(OUT, `${name}-${vp}.png`);
const log = (label, value) => console.log(`${label} ${JSON.stringify(value)}`);

async function markScroller(page, root) {
  return page.evaluate(root => {
    document.querySelectorAll('[data-probe-scroller]').forEach(n => n.removeAttribute('data-probe-scroller'));
    const r = document.querySelector(root);
    if (!r) return null;
    const all = [r, ...r.querySelectorAll('*')].filter(n => { const cs = getComputedStyle(n); return /(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 4; });
    all.sort((a, b) => b.clientHeight - a.clientHeight);
    if (!all[0]) return null;
    all[0].setAttribute('data-probe-scroller', '');
    return { tag: all[0].tagName.toLowerCase(), cls: all[0].getAttribute('class'), sh: all[0].scrollHeight, ch: all[0].clientHeight, st: all[0].scrollTop };
  }, root);
}

async function closeSheet(run) {
  const { page } = run;
  if (await page.evaluate(() => !document.querySelector('#panel').hidden)) { await S.press(run, '#panel-close'); await S.sleep(400); }
}

/** One #panel sheet: on open, scrolled to the end; screenshots of both. */
async function sheet(run, name, { ab = true, end = true, mid = false } = {}) {
  const { page } = run;
  await S.sleep(700);
  log(`${name}:open`, await S.measure(page));
  if (ab) log(`${name}:layoutAB`, await S.layoutAB(page));
  await S.shot(page, file(`${name}-top`));
  if (mid) { await S.scrollTo(page, 'mid'); await S.sleep(250); log(`${name}:mid`, await S.measure(page)); await S.shot(page, file(`${name}-mid`)); }
  if (end) { await S.scrollTo(page, 'end'); await S.sleep(250); log(`${name}:end`, await S.measure(page)); await S.shot(page, file(`${name}-end`)); }
}

(async () => {
  const browser = await S.launch();
  try {
    const run = await S.open(browser, vp);
    const { page } = run;
    if (part === 'lobby') {
      await S.press(run, '#join');
      await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 30000 });
      await sheet(run, 'join', { mid: true });
      // about from the join sheet (its own button), opened from a scrolled sheet
      await page.locator('#panel [data-open="about"]').first().evaluate(b => b.click());
      await S.sleep(600);
      await sheet(run, 'about-lobby', { mid: true });
      return;
    }
    await S.enter(run);
    if (part === 'room') {
      // ··· right after entering
      await S.press(run, '#room-info');
      await sheet(run, 'menu', { mid: true });
      // about: its button in the ··· sheet when there is one, else the page's own route
      const aboutHere = await page.locator('#panel [data-open="about"]').count();
      if (aboutHere) await page.locator('#panel [data-open="about"]').first().evaluate(b => b.click()); else await S.clickHidden(page, { open: 'about' });
      log('about:route', aboutHere ? 'button in the ··· sheet' : 'synthetic data-open=about');
      await sheet(run, 'about', { mid: true });
      await closeSheet(run);
      // upload after the reveal
      await S.press(run, '[data-tour-action="sample:sample-crowd"]');
      await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
      await S.aiSettled(page);
      await S.sleep(1500);
      const reveal = await S.measure(page);
      log('upload:reveal', reveal);
      log('upload:reveal-rects', await page.evaluate(() => {
        const p = document.querySelector('#panel').getBoundingClientRect(), c = document.querySelector('#panel-close').getBoundingClientRect();
        const R = sel => [...document.querySelectorAll(sel)].map(e => { const b = e.getBoundingClientRect(); return [Math.round(b.left - p.left), Math.round(b.top - p.top), Math.round(b.right - p.left), Math.round(b.bottom - p.top)]; });
        return { close: [Math.round(c.left - p.left), Math.round(c.top - p.top), Math.round(c.right - p.left), Math.round(c.bottom - p.top)], line: R('form.moment-upload [data-taken-line]'), takenLine: R('form.moment-upload .moment-taken__line'), note: R('form.moment-upload [data-taken-note]'), chips: R('form.moment-upload .moment-chip'), polaroid: R('form.moment-upload .photo-review') };
      }));
      await S.shot(page, file('upload-reveal'));
      await S.scrollTo(page, 'end'); await S.sleep(250);
      log('upload:end', await S.measure(page));
      await S.shot(page, file('upload-end'));
      const chosen = await page.evaluate(() => Boolean(document.querySelector('form[data-form="upload"] .moment-chip[aria-pressed="true"]')));
      if (!chosen) await S.press(run, 'form[data-form="upload"] .moment-chip[data-moment-viewpoint="crowd"]');
      await S.press(run, 'form[data-form="upload"] button[type="submit"]');
      await page.locator('#panel [data-moment-badge] [data-exchange-offer]').first().waitFor({ state: 'attached', timeout: 45000 });
      await page.waitForFunction(() => [...document.querySelectorAll('#panel .moment-card img')].every(i => i.complete && i.naturalWidth), null, { timeout: 30000 }).catch(() => {});
      await sheet(run, 'wall', { mid: true });
      // recap from the ··· sheet's own button
      await closeSheet(run);
      await S.press(run, '#room-info');
      await S.sleep(600);
      await S.scrollTo(page, 'end');
      await page.locator('#panel [data-open="recap"]').first().evaluate(b => b.click());
      await page.waitForSelector('.panel[data-kind="recap"] .photo-grid .photo-item', { timeout: 30000 });
      await page.waitForFunction(() => [...document.querySelectorAll('#panel .photo-item img')].length && [...document.querySelectorAll('#panel .photo-item img')].every(i => i.complete && i.naturalWidth), null, { timeout: 30000 }).catch(() => {});
      await sheet(run, 'recap', { end: false });
      log('recap:captions', await S.lines(page, '.panel[data-kind="recap"] .photo-item .moment-meta', true));
      await page.evaluate(() => { const g = document.querySelector('#panel .photo-grid'); const p = document.querySelector('#panel'); p.scrollTop += g.getBoundingClientRect().top - p.getBoundingClientRect().top - 60; });
      await S.sleep(300);
      log('recap:photos', await S.measure(page));
      await S.shot(page, file('recap-photos'));
      await S.scrollTo(page, 'end'); await S.sleep(250);
      log('recap:end', await S.measure(page));
      await S.shot(page, file('recap-end'));
      // the photo detail of the visitor's own photo (first polaroid with the AI byline if there is one)
      const own = await page.evaluate(() => { const items = [...document.querySelectorAll('#panel .photo-item')]; const i = items.findIndex(b => b.querySelector('.moment-meta__by--ai')); return i < 0 ? 0 : i; });
      await page.locator('#panel .photo-item').nth(own).evaluate(b => b.click());
      await page.waitForSelector('.panel[data-kind="photo"] .photo-review', { timeout: 20000 }).catch(() => {});
      await sheet(run, 'photo', { end: true });
      log('photo:meta', await S.lines(page, '.panel[data-kind="photo"] #panel-body > .moment-meta'));
      // 我的空间 → 我的现场与回顾 → 我的照片
      await closeSheet(run);
      await S.press(run, '#my-space');
      await S.sleep(900);
      await page.locator('[data-space="rooms"]').first().evaluate(b => b.click());
      await page.waitForSelector('.panel[data-kind="rooms"]', { timeout: 20000 });
      await sheet(run, 'rooms', { end: true });
      await page.locator('#panel [data-open="library"]').first().evaluate(b => b.click());
      await page.waitForSelector('.panel[data-kind="library"] .photo-item', { timeout: 20000 });
      await page.waitForFunction(() => [...document.querySelectorAll('#panel .photo-item img')].every(i => i.complete && i.naturalWidth), null, { timeout: 20000 }).catch(() => {});
      await sheet(run, 'library', { end: true });
      log('library:captions', await S.lines(page, '.panel[data-kind="library"] .photo-item .moment-meta', true));
      await S.scrollTo(page, 0); await S.sleep(200);
      await page.locator('#panel .photo-item').first().evaluate(b => b.click());
      await page.waitForSelector('.panel[data-kind="photo"]', { timeout: 20000 });
      await S.sleep(700);
      log('photo-from-library:open', await S.measure(page));
      log('photo-from-library:meta', await S.lines(page, '.panel[data-kind="photo"] #panel-body > .moment-meta'));
      await S.shot(page, file('photo-from-library'));
      return;
    }
    if (part === 'social') {
      // the wardrobe (我的小人)
      await S.press(run, '#my-look');
      await page.waitForSelector('.wardrobe:not([hidden])', { timeout: 20000 });
      await S.sleep(900);
      log('wardrobe:scroller', await markScroller(page, '.wardrobe'));
      const wclose = '.wardrobe .wardrobe-header>button';
      log('wardrobe:open', await S.measure(page, { root: '.wardrobe', close: wclose, scroller: '[data-probe-scroller]' }));
      await S.shot(page, file('wardrobe-top'));
      await S.scrollTo(page, 'end', '[data-probe-scroller]'); await S.sleep(300);
      log('wardrobe:end', await S.measure(page, { root: '.wardrobe', close: wclose, scroller: '[data-probe-scroller]' }));
      await S.shot(page, file('wardrobe-end'));
      await page.locator(wclose).last().evaluate(b => b.click());
      await S.sleep(500);
      // people → a person card → wave → (accepted) → private chat
      await S.clickHidden(page, { open: 'people' });
      await page.waitForSelector('.panel[data-kind="people"] [data-person]', { timeout: 20000 });
      await sheet(run, 'people', { end: true });
      await page.locator('#panel [data-person]').first().evaluate(b => b.click());
      await page.waitForSelector('.panel[data-kind="person"]', { timeout: 20000 });
      await S.sleep(1500);
      await sheet(run, 'person', { end: true });
      const send = page.locator('#panel [data-social-send]');
      if (await send.count()) {
        await send.first().evaluate(b => b.click());
        await page.waitForSelector('#panel [data-open="chats"]', { timeout: 60000 }).catch(() => {});
      }
      await S.scrollTo(page, 0); await S.sleep(500);
      await sheet(run, 'person-friend', { end: true });
      if (await page.locator('#panel [data-open="chats"]').count()) {
        await page.locator('#panel [data-open="chats"]').first().evaluate(b => b.click());
        await page.waitForSelector('.private-chat:not([hidden])', { timeout: 20000 });
        await page.waitForFunction(() => document.querySelectorAll('.private-chat [class*="message"], .private-chat li').length >= 2, null, { timeout: 20000 }).catch(() => {});
        await S.sleep(1200);
        log('chat:scroller', await markScroller(page, '.private-chat'));
        const cclose = '.private-chat>header>button';
        log('chat:open', await S.measure(page, { root: '.private-chat', close: cclose, scroller: '[data-probe-scroller]' }));
        await S.shot(page, file('chat-open'));
        await S.scrollTo(page, 0, '[data-probe-scroller]'); await S.sleep(300);
        log('chat:top', await S.measure(page, { root: '.private-chat', close: cclose, scroller: '[data-probe-scroller]' }));
        await S.shot(page, file('chat-top'));
      } else log('chat', 'no 私聊 button (wave not accepted in time)');
      return;
    }
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { await browser.close(); }
})();
