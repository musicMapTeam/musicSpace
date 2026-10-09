// The procedural fallback room (venue GLB fails to load) in doodle and classic modes.
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const OUT = '/tmp/space-doodle/3d-tools/fallback';
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  for (const [vp, size] of [['phone', { width: 390, height: 844, deviceScaleFactor: 2 }], ['desktop', { width: 1440, height: 900, deviceScaleFactor: 1 }]]) for (const query of ['', '?doodle=0']) {
    const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: size.deviceScaleFactor });
    await ctx.route(/venue\.glb/, route => route.request().resourceType() === 'fetch' ? route.abort() : route.continue());
    const page = await ctx.newPage(); const logs = [];
    page.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.type() + ': ' + m.text().slice(0, 120)); });
    page.on('pageerror', e => logs.push('pageerror: ' + e.message));
    await page.goto('http://127.0.0.1:5190/' + query);
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 60000 });
    await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 60000 }).catch(() => logs.push('loading never hid'));
    await page.getByRole('button', { name: '进入示例现场' }).first().click();
    await page.waitForSelector('form[data-form=demo-entry]', { timeout: 15000 });
    await page.check('form[data-form=demo-entry] input[name=consent]');
    await page.waitForSelector('form[data-form=demo-entry] button[type=submit]:not([disabled])', { timeout: 30000 });
    await page.click('form[data-form=demo-entry] button[type=submit]');
    await page.waitForFunction(() => (window.__SPACE_EVENT_QA__?.()?.members || []).length > 1, null, { timeout: 30000 }).catch(() => logs.push('members never arrived'));
    await new Promise(r => setTimeout(r, 2500));
    const info = await page.evaluate(() => { const s = window.__SPACE_EVENT_QA__?.()?.camera?.scene; return { style: s?.renderStyle, venue: s?.venueAsset?.status }; });
    const name = `novenue-${vp}${query ? '-classic' : ''}`;
    await page.screenshot({ path: `${OUT}/${name}.png` });
    for (const view of ['photos']) { await page.click(`nav.camera-nav button[data-view=${view}]`); await new Promise(r => setTimeout(r, 2500)); await page.screenshot({ path: `${OUT}/${name}-${view}.png` }); }
    console.log(name, JSON.stringify(info), JSON.stringify(logs.slice(0, 4)));
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
