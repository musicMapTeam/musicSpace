// W9: 音乐探索 (Music Map) beyond the first screen: its About sheet, 目录, 我的发现, 小院, a revealed song, the way back.
const L = require('./lib.cjs');
L.watchdog(250);
const vp = process.argv[2] || 'phone';
L.setCorpus(`w9-${vp}`);
const clickByLabel = (page, re) => page.evaluate(src => { const re = new RegExp(src); const b = [...document.querySelectorAll('button,a,[role="button"]')].find(n => n.getClientRects().length && (re.test(n.getAttribute('aria-label') || '') || re.test((n.textContent || '').trim()))); if (b) { b.click(); return (b.getAttribute('aria-label') || b.textContent).trim().slice(0, 40); } return null; }, re.source);
(async () => {
  const browser = await L.launch();
  try {
    const run = await L.open(browser, vp);
    const { page } = run; page.__vp = vp;
    await L.ready(run);
    await L.enter(run);
    await L.js(page, '#music-map-entry');
    await page.waitForURL(/music-map/, { timeout: 30000 });
    await L.sleep(5000);
    await L.shot(page, 'w9-01-map');
    for (const [label, re] of [['about', /^关于 Music Map$/], ['catalogue', /^目录$/], ['discoveries', /^我的发现$/], ['yard', /^小院$/], ['shop', /^唱片店$/], ['flip', /^翻开$/], ['hint', /提示/]]) {
      const hit = await clickByLabel(page, re);
      await L.sleep(1500);
      console.log(label, '->', hit);
      await L.grab(page, `map-${label}`, 'body', { quiet: false });
      await L.shot(page, `w9-${label}`);
      await page.keyboard.press('Escape').catch(() => {});
      await L.sleep(400);
    }
    const back = await clickByLabel(page, /返回 Music Space|返回现场/);
    console.log('back ->', back);
    await page.waitForURL(u => !/music-map/.test(String(u)), { timeout: 30000 }).catch(() => console.log('no way back'));
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 120000 }).catch(() => {});
    await L.sleep(2500);
    await L.grab(page, 'after-map', '.frame');
    await L.shot(page, 'w9-back');
    await L.log(page, 'map');
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { L.flush(); await browser.close(); }
})();
