const { launch, open, sleep } = require('./lib.cjs');
(async () => {
  const browser = await launch(); const { page } = await open(browser, 'desktop');
  await page.goto('http://127.0.0.1:8890/event-room/', { waitUntil: 'load' });
  await page.waitForFunction(() => /已连接/.test(document.querySelector('#render-status')?.innerText || ''), null, { timeout: 30000 }); await sleep(2500);
  console.log(await page.evaluate(() => { const p = document.querySelector('#join').parentElement; const cs = getComputedStyle(p); return JSON.stringify({ display: cs.display, flexWrap: cs.flexWrap, gtc: cs.gridTemplateColumns, kids: [...p.children].map(c => ({ tag: c.tagName, id: c.id, hidden: c.hidden, disp: getComputedStyle(c).display, w: Math.round(c.getBoundingClientRect().width), flex: getComputedStyle(c).flex, text: c.innerText.slice(0, 20) })) }); }));
  console.log(await page.evaluate(() => { const p = document.querySelector('.presence'); return JSON.stringify({ w: p.getBoundingClientRect().width, gtc: getComputedStyle(p).gridTemplateColumns, disp: getComputedStyle(p).display, kids: [...p.children].map(c => ({ cls: c.className, w: Math.round(c.getBoundingClientRect().width) })) }); }));
  await browser.close();
})();
