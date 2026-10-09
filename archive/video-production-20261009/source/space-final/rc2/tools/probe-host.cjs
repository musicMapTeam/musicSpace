// The host path from the lobby: 进入现场 → 我是 Livehouse / 主办方，开个房 → 开一个房间 → (nickname) → the 开房 form. Dumps its text
// (innerText and every <select> option, which innerText does not list) without submitting anything.
//   node probe-host.cjs <phone|desktop> <siteBaseUrl> <outDir>
const { launch, openContext, act, dump, sleep, mkdir, fs } = require('./lib.cjs');
const [kind = 'phone', BASE = 'http://127.0.0.1:4783/musicSpace/', OUT_ARG] = process.argv.slice(2);
const OUT = mkdir(OUT_ARG || `/tmp/space-final/rc2/probe-host/${kind}`);
(async () => {
  const browser = await launch();
  const { ctx, page, rec } = await openContext(browser, kind, BASE);
  const tap = (t, l) => act(page, kind, t, l, rec, { timeout: 10000 });
  await page.goto(BASE);
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 120000 });
  await sleep(1500);
  await tap('#join', '进入现场');
  await page.waitForSelector('form[data-form="demo-entry"]');
  await tap('#panel details.demo-entry-more > summary', 'host details');
  await sleep(500);
  await tap(page.locator('#panel details.demo-entry-more button').filter({ visible: true }).first(), '开一个房间');
  await sleep(1500);
  const states = {};
  const grab = async label => {
    const d = await dump(page);
    d.options = await page.evaluate(() => [...document.querySelectorAll('#panel select')].map(s => ({ name: s.name, options: [...s.options].map(o => o.text) })));
    states[label] = d;
    await page.screenshot({ path: `${OUT}/${label}.png` });
  };
  await grab('profile');
  const nameInput = page.locator('#panel form input:not([type]), #panel form input[type="text"]').filter({ visible: true }).first();
  if (await nameInput.count()) await nameInput.fill('月台的小林');
  const save = page.locator('#panel button[type="submit"]').filter({ visible: true }).first();
  if (await save.count()) { await tap(save, '保存昵称，继续'); await sleep(2500); }
  await page.waitForSelector('#panel select[name="songId"]', { timeout: 15000 }).catch(() => {});
  await grab('create-form');
  await page.evaluate(() => { const p = document.querySelector('#panel'); if (p) p.scrollTop = p.scrollHeight; });
  await sleep(500);
  await page.screenshot({ path: `${OUT}/create-form-bottom.png` });
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify({ kind, states, rec: { api: rec.api, thirdParty: rec.thirdParty, failed: rec.failed, console: rec.console, pageErrors: rec.pageErrors } }, null, 1));
  console.log(states['create-form'].body.split('\n').filter(Boolean).slice(-30).join(' | '));
  console.log('selects:', JSON.stringify(states['create-form'].options, null, 0));
  console.log('net:', rec.api.length, rec.thirdParty.length, rec.failed.length, rec.console.length, rec.pageErrors.length);
  await browser.close();
})().catch(e => { console.error('FATAL', e.message.split('\n')[0]); process.exit(1); });
