// Item 8: --disable-webgl --disable-3d-apis: the error/fallback shows and the panels still carry the whole route.
const L = require('./lib.js');
const vp = process.argv[2] || 'phone';
const label = `nowebgl-${vp}`;
(async () => {
  const browser = await L.launch(['--disable-webgl', '--disable-3d-apis']);
  const run = await L.open(browser, vp, { label });
  const { page } = run;
  const taps = [];
  const say = (k, v) => console.log(k, '=>', typeof v === 'string' ? v : JSON.stringify(v));
  try {
    const b = await L.boot(page, L.baseUrl('root'));
    say('boot', b);
    say('webgl', await page.evaluate(() => { const c = document.createElement('canvas'); return { webgl2: !!c.getContext('webgl2'), webgl: !!document.createElement('canvas').getContext('webgl') }; }));
    await L.sleep(2500);
    const ui = () => page.evaluate(() => {
      const vis = el => !!el && !el.hidden && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' && el.getClientRects().length > 0;
      const err = document.querySelector('#error'), load = document.querySelector('#loading');
      return { errorVisible: vis(err), errorText: err?.innerText.trim().replace(/\s+/g, ' '), loadingVisible: vis(load) && getComputedStyle(load).opacity !== '0', status: document.querySelector('#render-status')?.textContent.trim(), scene: window.__SPACE_EVENT_QA__?.()?.camera ?? null, hotspots: document.querySelectorAll('#hotspots .hotspot').length };
    });
    say('lobby', await ui());
    await L.shot(run, '01-lobby');
    await L.tap(run, page.locator('#join'), '进入示例现场', taps);
    await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button[type="submit"]')?.disabled, null, { timeout: 60000 });
    await L.tap(run, page.locator('form[data-form="demo-entry"] input[name="consent"]'), 'consent', taps);
    await L.tap(run, page.locator('form[data-form="demo-entry"] button[type="submit"]'), 'submit', taps);
    await page.waitForFunction(() => document.querySelector('.frame')?.dataset.stage === 'room', null, { timeout: 30000 });
    await L.sleep(2000);
    say('room', await ui());
    await L.shot(run, '02-room');
    await L.tap(run, page.locator('[data-tour-action="sample:sample-crowd"]'), '人海 · 示例照片', taps);
    await page.waitForFunction(() => /^(sure|unsure|off)/.test(document.querySelector('form[data-form="upload"] [data-ai-line]')?.getAttribute('data-ai-key') || ''), null, { timeout: 90000 }).catch(() => {});
    say('ai', await page.evaluate(() => document.querySelector('form[data-form="upload"] [data-ai-line]')?.getAttribute('data-ai-key') + ' | ' + document.querySelector('form[data-form="upload"] [data-ai-line]')?.textContent.trim()));
    const needChip = await page.evaluate(() => !document.querySelector('form[data-form="upload"] .moment-chip[aria-pressed="true"]'));
    if (needChip) await L.tap(run, page.locator('form[data-form="upload"] .moment-chip[data-moment-viewpoint="crowd"]'), 'choose 人海 (AI off)', taps);
    await L.tap(run, page.locator('form[data-form="upload"] button[type="submit"]'), '保存这张照片', taps);
    const offer = page.locator('[data-moment-badge] [data-exchange-offer]').first();
    await offer.waitFor({ state: 'visible', timeout: 30000 });
    await L.sleep(1000);
    await L.shot(run, '03-wall');
    await L.tap(run, offer, '和 TA 交换这个视角', taps);
    await page.locator('.photo-exchanges [data-x-consent]').waitFor({ state: 'attached' });
    await L.tap(run, page.locator('.photo-exchanges [data-x-consent]'), 'consent', taps);
    await page.waitForFunction(() => !document.querySelector('.photo-exchanges [data-x-send]')?.disabled, null, { timeout: 20000 });
    await L.tap(run, page.locator('.photo-exchanges [data-x-send]'), 'send', taps);
    await page.waitForFunction(() => /交换已接受/.test(document.querySelector('.photo-exchanges .exchange-status')?.textContent || ''), null, { timeout: 60000 });
    await L.sleep(1000);
    say('accepted', 'yes');
    await L.shot(run, '04-accepted');
    // the camera nav without a 3D scene
    await page.click('.photo-exchanges [data-x-close]');
    await L.sleep(800);
    for (const v of ['person', 'photos', 'overview']) {
      await page.click(`.camera-nav [data-view="${v}"]`);
      await L.sleep(1200);
      say(`nav ${v}`, await page.evaluate(() => ({ panel: document.querySelector('#panel')?.hidden ? null : document.querySelector('#panel')?.dataset.kind, pressed: [...document.querySelectorAll('.camera-nav [data-view]')].map(b => `${b.dataset.view}:${b.getAttribute('aria-pressed')}`).join(' ') })));
      if (!(await page.evaluate(() => document.querySelector('#panel')?.hidden))) { await L.shot(run, `05-nav-${v}`); await page.click('#panel-close').catch(() => {}); await L.sleep(600); }
    }
  } catch (e) { say('FAILED', e.message.split('\n')[0]); await L.shot(run, 'zz-failure').catch(() => {}); }
  say('taps', taps.map(t => `${t.n}. ${t.desc}`));
  say('console', run.consoleMsgs.map(c => `${c.type}: ${c.text.slice(0, 220)}`));
  say('pageErrors', run.pageErrors);
  const net = L.summarizeNet(run); say('net', { api: net.api.length, external: net.external.length, bad: net.bad.map(r => `${r.status} ${r.url}`) });
  await browser.close();
})();
