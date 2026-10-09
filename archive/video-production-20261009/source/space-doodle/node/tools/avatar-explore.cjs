const { launch, open, sleep, OUT } = require('./lib.cjs');
(async () => {
  const browser = await launch(); const { page, log } = await open(browser, 'desktop', { reducedMotion: 'reduce' });
  await page.goto('http://127.0.0.1:8890/avatar/', { waitUntil: 'load' }); await sleep(5000);
  const list = await page.evaluate(() => [...document.querySelectorAll('button,a[href],input,select')].filter(b => b.getClientRects().length).map(b => `${b.tagName.toLowerCase()}${b.id ? '#' + b.id : ''}${b.dataset && Object.keys(b.dataset).length ? '[' + Object.entries(b.dataset).map(([k, v]) => k + '=' + v).join(',') + ']' : ''} «${(b.innerText || b.value || b.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 30)}»`));
  console.log(list.join('\n'));
  await browser.close();
})();
