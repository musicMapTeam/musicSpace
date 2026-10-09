const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'zh-CN' });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await page.goto('http://127.0.0.1:5471/musicSpace/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 120000 });
    await page.evaluate(() => window.__SPACE_RESCUE__.show('测试原因'));
    await new Promise(r => setTimeout(r, 600));
    console.log('rescue:', await page.evaluate(() => document.querySelector('#space-rescue')?.innerText.replace(/\n+/g, ' | ')));
    await page.screenshot({ path: '/tmp/space-copy/ci-work/shots/rescue-phone.png' });
    const html = await (await page.request.get('http://127.0.0.1:5471/musicSpace/')).text();
    console.log('noscript:', /<noscript>([\s\S]*?)<\/noscript>/.exec(html)?.[1].replace(/<[^>]+>/g, '').trim().slice(0, 200));
    console.log('nomodule:', /var m=([^;]*?Music Space[^;]*?);/.exec(html)?.[1]?.slice(0, 200) || (html.match(/这个浏览器版本太旧[^<'"]*/) || [''])[0]);
    console.log('title:', /<title>([^<]*)<\/title>/.exec(html)?.[1], '| description:', /<meta name="description" content="([^"]*)"/.exec(html)?.[1]);
    const classic = await page.request.get('http://127.0.0.1:5471/musicSpace/classic/'); console.log('classic status', classic.status());
    console.log('errors', JSON.stringify(errs));
  } finally { await b.close(); }
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
