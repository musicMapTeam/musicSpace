const L = require('./lib.cjs');
L.watchdog(200);
(async () => {
  const b = await L.launch();
  const { page } = await L.open(b, 'desktop');
  try {
    const run = async label => {
      await page.click('#join'); await page.waitForSelector('form[data-form="demo-entry"]'); await L.sleep(500);
      await page.evaluate(() => { document.querySelector('#panel').scrollTop = 300; }); await L.sleep(200);
      const a = await page.evaluate(() => document.querySelector('#panel').scrollTop);
      await page.click('#panel-close'); await L.sleep(500);
      await page.click('#join'); await page.waitForSelector('form[data-form="demo-entry"]'); await L.sleep(500);
      const c = await page.evaluate(() => document.querySelector('#panel').scrollTop);
      console.log(label, 'scrolled', a, '-> reopened at', c);
      await page.click('#panel-close'); await L.sleep(500);
    };
    await run('sticky  ');
    await page.addStyleTag({ content: '.panel>#panel-close{position:absolute!important;top:10px!important;right:10px!important;margin:0!important}' });
    await run('absolute');
  } catch (e) { console.error('ERR', e.message.split('\n')[0]); }
  await b.close();
})();
