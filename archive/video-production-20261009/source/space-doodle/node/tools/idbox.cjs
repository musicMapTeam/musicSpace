const { launch, open, sleep } = require('./lib.cjs');
(async () => {
  const browser = await launch(); const { page } = await open(browser, 'desktop');
  await page.goto(`http://127.0.0.1:${process.argv[2] || 8890}/event-room/`, { waitUntil: 'load' });
  await page.waitForFunction(() => /已连接/.test(document.querySelector('#render-status')?.innerText || ''), null, { timeout: 30000 }); await sleep(1500);
  await page.getByRole('button', { name: '带上小人，进入现场' }).click(); await sleep(800);
  await page.getByRole('button', { name: '备份或恢复我的小人身份' }).click(); await sleep(1500);
  const r = await page.evaluate(() => {
    const host = document.querySelector('#panel:not([hidden])') || document.body;
    return [...host.querySelectorAll('*')].filter(e => { const s = getComputedStyle(e); return s.borderTopStyle === 'dashed' && e.getBoundingClientRect().height > 0; }).map(e => ({ tag: e.tagName, cls: e.className, id: e.id, role: e.getAttribute('role'), text: e.innerText.slice(0, 40), h: Math.round(e.getBoundingClientRect().height), y: Math.round(e.getBoundingClientRect().y) }));
  });
  console.log(JSON.stringify(r, null, 1));
  const f = await page.evaluate(() => { const i = document.querySelector('#panel input[type=file]'); return i ? { cls: i.className, name: i.name, accept: i.accept, visible: !!i.getClientRects().length, w: i.getBoundingClientRect().width } : null; });
  console.log('file input', JSON.stringify(f));
  await browser.close();
})();
