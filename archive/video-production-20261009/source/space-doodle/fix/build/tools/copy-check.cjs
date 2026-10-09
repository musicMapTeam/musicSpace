// Production build (serve-prefix): after a confirmed write, do World Cup, topics and games say 示例已确认 (COPY_RULES), never 服务器已确认?
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const URL = process.argv[2] || 'http://127.0.0.1:4791/musicSpace/';
const kind = process.argv[3] || 'phone';
const OUT = '/tmp/space-doodle/fix/build';
const VP = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
  const ctx = await browser.newContext({ ...VP[kind], locale: 'zh-CN', timezoneId: 'Asia/Shanghai' });
  const page = await ctx.newPage();
  const log = { console: [], bad: [], pageerror: [] };
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) log.console.push(`[${m.type()}] ${m.text().slice(0, 300)}`); });
  page.on('pageerror', e => log.pageerror.push(String(e?.message || e).slice(0, 300)));
  page.on('response', r => { if (r.status() >= 400) log.bad.push(`${r.status()} ${r.url().slice(0, 160)}`); });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
  await sleep(1200);
  const enter = async () => {
    if ((await page.evaluate(() => document.querySelector('.frame')?.dataset.stage)) === 'room') return;
    if (!(await page.locator('#panel-body form[data-form="demo-entry"]').count())) await page.locator('button:visible', { hasText: '进入示例现场' }).first().click();
    await page.waitForSelector('form[data-form="demo-entry"] button.primary:not([disabled])', { timeout: 60000 });
    await page.locator('form[data-form="demo-entry"] input[name=consent]').check();
    await page.locator('form[data-form="demo-entry"] button.primary').click();
    await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"]'), null, { timeout: 60000 });
    await sleep(1500);
    const skip = page.locator('button:visible', { hasText: '跳过路线' }); if (await skip.count()) await skip.first().click().catch(() => {});
    await sleep(800);
  };
  await enter();
  const openKind = async k => { await page.evaluate(k => { const b = document.createElement('button'); b.dataset.open = k; b.style.position = 'fixed'; b.style.left = '-9999px'; document.body.append(b); b.click(); b.remove(); }, k); await sleep(2000); };
  const joinGroup = async () => { const join = page.locator('.community-panel form[data-group-join]'); if (await join.count()) { await join.locator('input[name=consent]').check(); await join.locator('button[type=submit]').click(); await sleep(2500); } };
  const statusText = sel => page.evaluate(sel => [...document.querySelectorAll(`${sel} [role=status]`)].map(n => n.textContent.trim()).filter(Boolean), sel);
  const result = {};
  // World Cup: vote once
  await openKind('conversation'); await joinGroup();
  await page.locator('.community-panel [data-group-worldcup]').first().click(); await sleep(2500);
  const cupBtn = page.locator('.worldcup-panel .entry-list button').first(); if (await cupBtn.count()) { await cupBtn.click(); await sleep(2500); }
  const vote = page.locator('.worldcup-panel [data-cup-choice]').first();
  if (await vote.count()) { await vote.click(); await sleep(600); const vf = page.locator('.worldcup-panel form[data-cup-vote]'); if (await vf.count()) { await vf.locator('input[name=consent]').check(); await vf.locator('button[type=submit]').click(); await sleep(3000); } }
  result.worldcup = await statusText('.worldcup-panel'); console.log('worldcup', JSON.stringify(result.worldcup));
  await page.evaluate(() => { const s = document.querySelector('.worldcup-panel .community-scroll'); if (s) s.scrollTop = 0; document.activeElement?.blur?.(); }); await sleep(300);
  await page.screenshot({ path: `${OUT}/after-prod-worldcup-confirmed-${kind}.png` });
  // Topics: create one
  await page.goto(URL, { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 }); await sleep(1500); await enter();
  await openKind('conversation'); await joinGroup();
  await page.locator('.community-panel [data-group-topics]').first().click(); await sleep(2500);
  await page.evaluate(() => { const d = document.querySelector('.music-topics details'); if (d) d.open = true; }); await sleep(200);
  const f = page.locator('.music-topics form[data-topic-create]');
  if (await f.count()) { await f.locator('input[name=title]').fill('晚班列车'); await f.locator('input[name=artist]').fill('纸灯乐队'); await f.locator('input[name=note]').fill('返场前那段鼓点，你们是不是也在跟着拍手？'); await f.locator('input[name=consent]').check(); await f.locator('button').click(); await sleep(3500); }
  result.topics = await statusText('.music-topics'); console.log('topics', JSON.stringify(result.topics));
  await page.evaluate(() => { document.activeElement?.blur?.(); const s = document.querySelector('.music-topics .community-scroll'); if (s) s.scrollTop = 0; }); await sleep(300);
  await page.screenshot({ path: `${OUT}/after-prod-topics-confirmed-${kind}.png` });
  // Games: join one
  await page.goto(URL, { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 }); await sleep(1500); await enter();
  await openKind('conversation'); await joinGroup();
  await page.locator('.community-panel [data-group-games]').first().click(); await sleep(2500);
  const gBtn = page.locator('.music-games .entry-list button').first(); if (await gBtn.count()) { await gBtn.click(); await sleep(2500); }
  const jf = page.locator('.music-games form[data-game-form="join"]');
  if (await jf.count()) { await jf.locator('input[name=consent]').check(); await jf.locator('button').click(); await sleep(4000); }
  result.games = await statusText('.music-games');
  await page.evaluate(() => { document.activeElement?.blur?.(); const s = document.querySelector('.music-games .community-scroll'); if (s) s.scrollTop = 0; }); await sleep(300);
  await page.screenshot({ path: `${OUT}/after-prod-games-confirmed-${kind}.png` });
  result.anyServerWording = await page.evaluate(() => /服务器已确认|服务已确认|服务已收到/.test(document.body.innerText));
  console.log(JSON.stringify(result, null, 1));
  console.log(JSON.stringify(log, null, 1));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
