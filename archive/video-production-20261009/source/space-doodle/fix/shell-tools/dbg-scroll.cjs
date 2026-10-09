const L = require('./lib.cjs');
L.watchdog(200);
const kind = process.argv[2] || 'desktop';
(async () => {
  const b = await L.launch();
  const { page } = await L.open(b, kind);
  try {
    await L.enter(page);
    for (let round = 0; round < 2; round++) {
      await page.click('#room-info');
      const log = [];
      for (let i = 0; i < 12; i++) { log.push(await page.evaluate(() => { const p = document.querySelector('#panel'); const a = document.activeElement; return `${p.scrollTop}:${a?.id || a?.textContent?.trim().slice(0, 8) || a?.tagName}`; })); await L.sleep(150); }
      console.log('round', round, log.join(' '));
      await page.keyboard.press('Escape'); await L.sleep(600);
    }
    // the same with the old absolute ×
    await page.addStyleTag({ content: '.panel>#panel-close{position:absolute!important;top:10px!important;right:10px!important;margin:0!important}' });
    await page.click('#room-info');
    const log = [];
    for (let i = 0; i < 12; i++) { log.push(await page.evaluate(() => { const p = document.querySelector('#panel'); const a = document.activeElement; return `${p.scrollTop}:${a?.id || a?.textContent?.trim().slice(0, 8) || a?.tagName}`; })); await L.sleep(150); }
    console.log('absolute ×', log.join(' '));
  } catch (e) { console.error('ERR', e.message.split('\n')[0]); }
  await b.close();
})();
