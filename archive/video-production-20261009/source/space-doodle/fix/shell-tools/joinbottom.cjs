const L = require('./lib.cjs');
L.watchdog(120);
const kind = process.argv[2] || 'phone';
(async () => {
  const b = await L.launch();
  const { page } = await L.open(b, kind);
  try {
    await page.click('#join');
    await page.waitForSelector('form[data-form="demo-entry"]');
    await L.sleep(900);
    await page.evaluate(() => { const p = document.querySelector('#panel'); p.scrollTop = p.scrollHeight; });
    await L.shot(page, `after-join-bottom-${kind}`, { dir: '/tmp/space-doodle/shots/shell' });
  } catch (e) { console.error('ERR', e.message.split('\n')[0]); }
  await b.close();
})();
