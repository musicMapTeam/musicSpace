// /event-room without trailing slash on the Node server: which requests fail, are fonts loaded, does the 3D come up?
const { launch, open, sleep, OUT } = require('./lib.cjs');
const port = process.argv[2] || '8890';
(async () => {
  const browser = await launch(); const { page, log } = await open(browser, 'phone');
  await page.goto(`http://127.0.0.1:${port}/event-room?room=ABCDEFGHJKLM`, { waitUntil: 'load' });
  await page.waitForFunction(() => /已连接|同场|无法/.test(document.querySelector('#render-status')?.innerText || ''), null, { timeout: 30000 }).catch(() => {});
  await sleep(4000);
  const info = await page.evaluate(async () => { await document.fonts.ready; return { url: location.href, status: document.querySelector('#render-status')?.innerText, display: document.fonts.check('16px "Doodle Display"', '现场'), marker: document.fonts.check('16px "Doodle Marker"', '现场'), style: window.__SPACE_EVENT_QA__?.()?.camera?.scene?.renderStyle, venue: window.__SPACE_EVENT_QA__?.()?.camera?.scene?.venueAsset?.status }; });
  console.log(JSON.stringify(info)); console.log(JSON.stringify({ bad: log.bad, fonts: log.fonts, console: log.console.slice(0, 6) }, null, 1));
  await page.screenshot({ path: `${OUT}/${port}-noslash-phone.png` });
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
