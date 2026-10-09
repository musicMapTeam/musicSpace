// Usage: node shoot.js <prefix> <phone|desktop|both> [query] [--clean] [--views=overview,person,photos]
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const OUT = '/tmp/space-doodle/shots/3d';
const VP = { phone: { width: 390, height: 844, deviceScaleFactor: 2 }, desktop: { width: 1440, height: 900 } };
const [prefix = 'probe', which = 'both', query = ''] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const clean = process.argv.includes('--clean');
const viewsArg = (process.argv.find(a => a.startsWith('--views=')) || '--views=overview,person,photos').slice(8).split(',');
const base = process.env.SPACE_URL || 'http://127.0.0.1:5190/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function frameStats(page, trigger) {
  await page.evaluate(() => { window.__ft = []; let last = 0; const loop = t => { if (last) window.__ft.push(t - last); last = t; if (window.__ft.length < 400 && !window.__ftStop) requestAnimationFrame(loop); }; window.__ftStop = false; requestAnimationFrame(loop); });
  await trigger();
  const t0 = Date.now();
  await sleep(150);
  while (Date.now() - t0 < 4000) { const moving = await page.evaluate(() => window.__SPACE_EVENT_QA__?.()?.camera?.moving); if (!moving) break; await sleep(60); }
  const ft = await page.evaluate(() => { window.__ftStop = true; return window.__ft; });
  const s = ft.slice(1, -1).sort((a, b) => a - b);
  return { frames: ft.length, median: s.length ? +s[Math.floor(s.length / 2)].toFixed(1) : null, mean: s.length ? +(s.reduce((a, b) => a + b, 0) / s.length).toFixed(1) : null };
}
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: process.env.SOFT ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'] : [] });
  const report = {};
  for (const vp of which === 'both' ? ['phone', 'desktop'] : [which]) {
    const ctx = await browser.newContext({ viewport: { width: VP[vp].width, height: VP[vp].height }, deviceScaleFactor: VP[vp].deviceScaleFactor || 1 });
    const page = await ctx.newPage();
    const logs = [];
    page.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.type() + ': ' + m.text().slice(0, 300)); });
    page.on('pageerror', e => logs.push('pageerror: ' + e.message.slice(0, 300)));
    await page.goto(base + query, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 60000 });
    await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 60000 }).catch(() => logs.push('loading never hid'));
    await sleep(800);
    if (viewsArg.includes('landing')) { await sleep(1200); await page.screenshot({ path: `${OUT}/${prefix}-landing-${vp}.png` }); }
    if (viewsArg.every(v => v === 'landing')) { report[vp] = { logs }; await ctx.close(); continue; }
    // join the example room
    await page.getByRole('button', { name: '进入示例现场' }).first().click();
    await page.waitForSelector('form[data-form=demo-entry]', { timeout: 15000 });
    await page.check('form[data-form=demo-entry] input[name=consent]', { force: true });
    await page.waitForSelector('form[data-form=demo-entry] button[type=submit]:not([disabled])', { timeout: 30000 });
    await page.click('form[data-form=demo-entry] button[type=submit]');
    await page.waitForFunction(() => (window.__SPACE_EVENT_QA__?.()?.members || []).length > 1, null, { timeout: 30000 }).catch(() => logs.push('members never arrived'));
    await sleep(2500);
    const stats = {};
    for (const view of viewsArg) {
      if (view === 'landing') continue;
      if (view === 'overview') {
        stats.overview = await frameStats(page, () => page.click('nav.camera-nav button[data-view=overview]').catch(() => {}));
      } else if (view === 'person') {
        await page.click('nav.camera-nav button[data-view=person]');
        await page.waitForSelector('#panel-body [data-person]', { timeout: 10000 });
        const own = await page.evaluate(() => window.__SPACE_EVENT_QA__?.()?.actorId);
        const ids = await page.$$eval('#panel-body [data-person]', els => els.map(e => e.dataset.person));
        const target = ids.find(id => id !== own) || ids[0];
        stats.person = await frameStats(page, () => page.click(`#panel-body [data-person="${target}"]`));
        await sleep(1500);
        if (await page.isVisible('#panel-close')) await page.click('#panel-close').catch(() => {});
      } else {
        stats[view] = await frameStats(page, () => page.click(`nav.camera-nav button[data-view=${view}]`));
      }
      await sleep(1200);
      if (clean) await page.evaluate(() => { const st = document.createElement('style'); st.id = 'clean3d'; st.textContent = '#app .frame > *:not(.world-shell), .world-shell > *:not(#world), .desktop-caption, #toast, #connection-banner, #panel { visibility:hidden !important }'; document.head.append(st); });
      await page.screenshot({ path: `${OUT}/${prefix}-${view}-${vp}.png` });
      if (clean) await page.evaluate(() => document.getElementById('clean3d')?.remove());
    }
    report[vp] = { stats, cam: await page.evaluate(() => { const s = window.__SPACE_EVENT_QA__?.()?.camera?.scene; return s && (s.venueAsset?.status + '/' + s.renderStyle); }), logs: logs.slice(0, 12) };
    await ctx.close();
  }
  console.log(JSON.stringify(report, null, 1));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
