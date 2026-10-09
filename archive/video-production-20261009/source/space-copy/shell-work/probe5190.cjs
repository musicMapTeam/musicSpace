const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const t = setTimeout(() => { console.log('WATCHDOG'); process.exit(3); }, 150000); t.unref();
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const c = await b.newContext({ viewport: { width: 1280, height: 800 } }); const p = await c.newPage();
  const bad = []; p.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url().replace('http://127.0.0.1:5190', '')); });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  await p.goto('http://127.0.0.1:5190/', { waitUntil: 'domcontentloaded' });
  const ok = await p.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 }).then(() => true).catch(() => false);
  const deps = await p.evaluate(() => performance.getEntriesByType('resource').map(e => e.name).filter(n => n.includes('.vite/deps')).map(n => n.replace(location.origin, '')));
  console.log('boot ready:', ok, '| bad:', JSON.stringify(bad.slice(0, 10)), '| errors:', JSON.stringify(errs), '| deps:', JSON.stringify(deps.slice(0, 12)));
  await b.close();
})().catch(e => { console.error('FAILED', e); process.exit(1); });
