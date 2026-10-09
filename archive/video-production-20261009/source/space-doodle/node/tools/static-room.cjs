// Static example site (5190): enter the example world, open the room panel; screenshot + list .row .primary buttons.
const { launch, open, sleep, OUT } = require('./lib.cjs');
const vp = process.argv[2] || 'phone';
(async () => {
  const browser = await launch(); const { page, log } = await open(browser, vp);
  await page.goto('http://127.0.0.1:5190/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 60000 }); await sleep(2500);
  const btns = async () => page.evaluate(() => [...document.querySelectorAll('button')].filter(b => b.getClientRects().length && getComputedStyle(b).visibility !== 'hidden').map(b => (b.innerText || b.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 24)));
  console.log('buttons0', JSON.stringify(await btns()));
  await page.getByRole('button', { name: /进入示例现场/ }).first().click(); await sleep(1200);
  const consent = page.locator('#panel input[type=checkbox]').first(); if (await consent.isVisible().catch(() => false)) await consent.check();
  await page.getByRole('button', { name: /进入示例现场/ }).last().click(); await sleep(4000);
  console.log('buttons1', JSON.stringify(await btns()));
  const room = page.locator('[data-open=room]').first();
  if (await room.isVisible().catch(() => false)) { await room.click(); await sleep(1500); }
  else console.log('no visible [data-open=room]');
  const rows = await page.evaluate(() => [...document.querySelectorAll('#panel .row')].map(r => [...r.querySelectorAll('button')].map(b => `${b.className}|${b.innerText.replace(/\s+/g, ' ')}|${Math.round(b.getBoundingClientRect().height)}px`)));
  console.log('rows', JSON.stringify(rows));
  await page.screenshot({ path: `${OUT}/static-room-panel-${vp}.png` });
  const p = page.locator('#panel'); await p.evaluate(el => { const s = el.querySelector('.panel-body,#panel-body') || el; s.scrollTop = s.scrollHeight; });
  await sleep(400); await page.screenshot({ path: `${OUT}/static-room-panel-${vp}-end.png` });
  console.log(JSON.stringify(log.console.slice(0, 5)), JSON.stringify(log.pageerror));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
