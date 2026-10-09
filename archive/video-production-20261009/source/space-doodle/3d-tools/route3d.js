// Judge route through the 3D room in doodle mode: enter, upload the sample crowd photo, then the 3D photo wall and overview.
// usage: node route3d.js [phone|desktop|both] [prefix]
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const OUT = '/tmp/space-doodle/shots/3d';
const VP = { phone: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desktop: { width: 1440, height: 900, deviceScaleFactor: 1 } };
const which = process.argv[2] || 'both', prefix = process.argv[3] || 'route', query = process.argv[4] || '';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function settle(page) { const t0 = Date.now(); await sleep(250); while (Date.now() - t0 < 6000) { const m = await page.evaluate(() => window.__SPACE_EVENT_QA__?.()?.camera?.moving); if (!m) break; await sleep(80); } await sleep(900); }
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  for (const vp of which === 'both' ? ['phone', 'desktop'] : [which]) {
    const v = VP[vp];
    const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: v.deviceScaleFactor, isMobile: !!v.isMobile, hasTouch: !!v.hasTouch });
    const page = await ctx.newPage(); page.setDefaultTimeout(30000); const logs = [];
    page.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.type() + ': ' + m.text().slice(0, 200)); });
    page.on('pageerror', e => logs.push('pageerror: ' + e.message.slice(0, 200)));
    await page.goto('http://127.0.0.1:5190/' + query, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 60000 });
    await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 60000 });
    await sleep(600);
    await page.locator('button', { hasText: '进入示例现场' }).first().click();
    await page.waitForSelector('form[data-form="demo-entry"]');
    await page.check('form[data-form="demo-entry"] input[name="consent"]');
    await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button[type="submit"]')?.disabled);
    await page.click('form[data-form="demo-entry"] button[type="submit"]');
    await page.waitForSelector('[data-tour-action="sample:sample-crowd"]');
    await sleep(600);
    await page.click('[data-tour-action="sample:sample-crowd"]');
    await page.waitForSelector('form[data-form="upload"] .photo-review');
    try { await page.waitForSelector('form[data-form="upload"] .moment-chip.is-ai, form[data-form="upload"] .moment-ai-tag', { timeout: 40000 }); } catch { logs.push('note: no AI answer in time'); }
    if (!await page.evaluate(() => Boolean(document.querySelector('form[data-form="upload"] .moment-chip[aria-pressed="true"]')))) await page.click('form[data-form="upload"] .moment-chip[data-moment-viewpoint="crowd"]');
    await page.click('form[data-form="upload"] button[type="submit"]');
    await page.waitForFunction(() => (window.__SPACE_EVENT_QA__?.()?.photos || []).some(p => p.ownerId === window.__SPACE_EVENT_QA__?.()?.actorId), null, { timeout: 30000 }).catch(() => logs.push('own photo not in state'));
    await sleep(1500);
    if (await page.isVisible('#panel-close')) await page.click('#panel-close').catch(() => {});
    await sleep(500);
    await page.click('nav.camera-nav button[data-view=photos]'); await settle(page);
    const wall = await page.evaluate(() => { const q = window.__SPACE_EVENT_QA__?.(); return { photos: q?.photos?.length, style: q?.camera?.scene?.renderStyle, view: q?.camera?.view }; });
    const camPhotos = await page.evaluate(() => { const c = window.__SPACE_EVENT_QA__?.()?.camera?.camera; return c && { p: c.position.map(n => +n.toFixed(2)), t: c.target.map(n => +n.toFixed(2)), aspect: +c.aspect.toFixed(3) }; });
    await page.screenshot({ path: `${OUT}/${prefix}-photos-uploaded-${vp}.png` });
    await page.click('nav.camera-nav button[data-view=overview]'); await settle(page);
    await page.screenshot({ path: `${OUT}/${prefix}-overview-uploaded-${vp}.png` });
    console.log(vp, JSON.stringify(wall), 'cam', JSON.stringify(camPhotos), JSON.stringify(logs.slice(0, 8)));
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
