// Second message in a private thread with a cast member the visitor never exchanged with: which line comes back?
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clickHidden = (page, dataset) => page.evaluate(dataset => { const o = document.createElement('button'); Object.assign(o.dataset, dataset); o.style.position = 'fixed'; o.style.left = '-9999px'; document.body.append(o); o.click(); o.remove(); }, dataset);
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    const page = await (await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' })).newPage();
    await page.goto('http://127.0.0.1:5471/musicSpace/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 120000 });
    await page.locator('#join').click(); await page.waitForSelector('form[data-form="demo-entry"]');
    await page.check('form[data-form="demo-entry"] input[name="consent"]', { force: true });
    await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button[type="submit"]')?.disabled, null, { timeout: 90000 });
    await page.locator('form[data-form="demo-entry"] button[type="submit"]').click();
    await page.waitForSelector('[data-tour-action="sample:sample-crowd"]', { timeout: 60000 });
    await clickHidden(page, { open: 'people' }); await sleep(1200);
    const id = await page.evaluate(() => [...document.querySelectorAll('#panel [data-person]')].find(b => /小满/.test(b.innerText))?.dataset.person);
    await clickHidden(page, { person: id }); await page.waitForSelector('#panel [data-social-send]', { timeout: 20000 });
    await page.locator('#panel [data-social-send]').click();
    await page.waitForFunction(() => /你们已经是朋友了/.test(document.querySelector('#panel')?.innerText || ''), null, { timeout: 30000 });
    await page.locator('#panel [data-open="chats"]').first().click(); await sleep(1500);
    await page.waitForFunction(() => /你拍到的是哪一面/.test(document.querySelector('.chat-messages')?.innerText || ''), null, { timeout: 30000 });
    for (const text of ['我在二楼。', '你最喜欢哪首？']) {
      const before = await page.evaluate(() => document.querySelectorAll('.chat-messages .theirs').length);
      await page.fill('#chat-text', text); await page.locator('.chat-composer button[type="submit"]').click();
      await page.waitForFunction(n => document.querySelectorAll('.chat-messages .theirs').length > n, before, { timeout: 30000 });
      await sleep(500);
    }
    console.log('thread with 小满 (no exchange):', await page.evaluate(() => [...document.querySelectorAll('.chat-messages article')].map(a => `${a.classList.contains('mine') ? '我' : '小满'}: ${a.querySelector('p').innerText}`).join(' | ')));
    await page.screenshot({ path: '/tmp/space-copy/ci-work/shots/chat-second-reply.png' });
  } finally { await b.close(); }
})().catch(e => { console.error('FAILED', e.message.split('\n')[0]); process.exit(1); });
