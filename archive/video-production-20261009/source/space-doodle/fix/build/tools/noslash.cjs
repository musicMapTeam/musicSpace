// /event-room without its trailing slash on the Node server: where does the browser end up, which requests fail, do the Doodle fonts load?
const { launch, open, sleep, OUT } = require('./lib.cjs');
const port = process.argv[2] || '8892';
const label = process.argv[3] || port;
const vp = process.argv[4] || 'phone';
(async () => {
  const browser = await launch(); const { page, log } = await open(browser, vp);
  const hops = [];
  page.on('response', r => { if (r.status() >= 300 && r.status() < 400) hops.push(`${r.status()} ${r.url().replace(/^https?:\/\/[^/]+/, '')} -> ${r.headers()['location']}`); });
  await page.goto(`http://127.0.0.1:${port}/event-room?room=ABCDEFGHJKLM`, { waitUntil: 'load' });
  await page.waitForFunction(() => /已连接|同场|无法|不存在/.test(document.querySelector('#render-status')?.innerText || '') || /不存在/.test(document.querySelector('#toast')?.innerText || ''), null, { timeout: 30000 }).catch(() => {});
  await sleep(4500);
  const info = await page.evaluate(async () => { await document.fonts.ready; return { url: location.href, status: document.querySelector('#render-status')?.innerText, display: document.fonts.check('16px "Doodle Display"', '现场'), marker: document.fonts.check('16px "Doodle Marker"', '现场'), logo: document.fonts.check('16px "Doodle Logo"', 'Music'), loaded: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family).filter((v, i, a) => a.indexOf(v) === i) }; });
  console.log(JSON.stringify(info)); console.log(JSON.stringify({ hops, bad: log.bad, fonts: log.fonts, console: log.console.slice(0, 8), pageerror: log.pageerror.slice(0, 3) }, null, 1));
  await page.screenshot({ path: `${OUT}/${label}-noslash-${vp}.png` });
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
