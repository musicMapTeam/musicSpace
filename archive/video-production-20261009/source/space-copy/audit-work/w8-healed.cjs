// W8: a visitor of the old build (SEED_REV 2, served read-only from the repo's dist-pages) comes back to the new build on the same origin:
// the stored world is stale, the page heals once and says so. Both servers are started and stopped here (port 5493).
const L = require('./lib.cjs');
const { spawn } = require('child_process');
L.watchdog(280);
const vp = process.argv[2] || 'phone';
L.setCorpus(`w8-${vp}`);
const PORT = 5493;
const URL = `http://127.0.0.1:${PORT}/musicSpace/`;
const REPO = '/Users/alakazan/workplace/tme/musicSpace';
function serve(dir) {
  const child = spawn('node', [`${REPO}/scripts/pages/serve-prefix.mjs`, dir, '/musicSpace/', String(PORT)], { stdio: ['ignore', 'pipe', 'pipe'] });
  return new Promise((resolve, reject) => { child.stdout.on('data', d => { if (/serving/.test(String(d))) resolve(child); }); child.on('error', reject); setTimeout(() => resolve(child), 3000); });
}
const stop = child => new Promise(r => { if (!child || child.exitCode !== null) return r(); child.once('exit', r); child.kill('SIGTERM'); setTimeout(r, 2000); });
(async () => {
  let server = null;
  const browser = await L.launch();
  try {
    server = await serve(`${REPO}/dist-pages`);
    const run = await L.open(browser, vp, { url: URL });
    const { page } = run; page.__vp = vp;
    await L.ready(run);
    console.log('old build ready; title:', await page.evaluate(() => document.querySelector('#room-title')?.textContent));
    // walk into the old room so the stale world has a visitor in it
    await L.press(run, '#join');
    await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 30000 });
    await page.check('form[data-form="demo-entry"] input[name="consent"]', { force: true });
    await page.waitForFunction(() => { const b = document.querySelector('form[data-form="demo-entry"] button[type="submit"]'); return b && !b.disabled; }, null, { timeout: 90000 });
    await L.js(page, 'form[data-form="demo-entry"] button[type="submit"]');
    await L.sleep(4000);
    console.log('old room heading:', await page.evaluate(() => document.querySelector('#scene-heading')?.innerText));
    await stop(server); server = null;
    server = await serve('/tmp/space-copy/audit/dist-pages');
    await page.evaluate(() => { window.__audit = []; sessionStorage.removeItem('__audit'); });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready' || /^failed/.test(window.__SPACE_BOOT__ || ''), null, { timeout: 120000 });
    console.log('boot after update:', await page.evaluate(() => window.__SPACE_BOOT__), JSON.stringify(await page.evaluate(() => { const s = window.__SPACE_STATIC__; return s && { healed: s.healed, fresh: s.fresh, memoryOnly: s.memoryOnly, phase: s.phase }; })));
    for (let i = 0; i < 4; i++) { await L.sleep(500); await L.shot(page, `w8-00-after-reload-${i}`); }
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 120000 }).catch(() => {});
    console.log('boot later:', JSON.stringify(await page.evaluate(() => { const s = window.__SPACE_STATIC__; return s && { healed: s.healed, fresh: s.fresh, memoryOnly: s.memoryOnly, phase: s.phase }; })));
    await L.sleep(1500);
    await L.grab(page, 'healed', 'body');
    await L.shot(page, 'w8-01-healed');
    await L.sleep(3000);
    await L.shot(page, 'w8-02-healed-later');
    await L.log(page, 'healed');
    const raw = await page.evaluate(() => window.__audit || []);
    const t0 = raw.find(e => e[0] === 'load')?.[2] || 0;
    console.log('TIMED:\n' + raw.map(e => `  +${e[2] - t0}ms ${e[0]}: ${e[1]}`).join('\n'));
    // and the entry right after the heal
    await L.press(run, '#join').catch(() => {});
    await L.sleep(1200);
    await L.grab(page, 'healed-entry', '#panel');
    await L.shot(page, 'w8-03-healed-entry');
    await L.log(page, 'healed-after-entry');
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { L.flush(); await browser.close(); await stop(server); }
})();
