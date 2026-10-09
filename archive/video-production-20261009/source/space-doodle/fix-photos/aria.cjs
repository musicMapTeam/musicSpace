const L = require('./lib.cjs');
L.watchdog(200);
(async () => {
  const browser = await L.launch();
  try {
    const run = await L.open(browser, 'phone');
    const { page } = run;
    await L.enter(run);
    await L.press(run, '[data-tour-action="sample:sample-crowd"]');
    await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
    await L.aiSettled(page);
    console.log('taken line:', await page.locator('form.moment-upload .moment-taken__line').ariaSnapshot());
    const cdp = await page.context().newCDPSession(page);
    const node = await page.evaluate(() => { const p = document.querySelector('form.moment-upload .moment-taken__line'); p.id = p.id || 'probe-taken'; return p.id; });
    const { nodes } = await cdp.send('Accessibility.getFullAXTree');
    const names = nodes.filter(n => n.role?.value === 'status').map(n => n.name?.value).filter(Boolean);
    console.log('status names:', JSON.stringify(names));
    await L.press(run, 'form[data-form="upload"] button[type="submit"]');
    await page.locator('#panel [data-moment-badge] [data-exchange-offer]').first().waitFor({ state: 'attached', timeout: 45000 });
    await L.sleep(800);
    console.log('best card:', (await page.locator('#panel .moment-card--best').ariaSnapshot()).split('\n').slice(0, 8).join('\n'));
    await page.evaluate(() => { const o = document.createElement('button'); o.dataset.open = 'recap'; o.style.position = 'fixed'; o.style.left = '-9999px'; document.body.append(o); o.click(); o.remove(); });
    await page.waitForSelector('.panel[data-kind="recap"] .recap-venue', { timeout: 20000 });
    await L.sleep(800);
    console.log('venue:', await page.locator('.panel[data-kind="recap"] .recap-venue').ariaSnapshot());
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { await browser.close(); }
})();
