// Which Doodle font slices load along the judge route (unthrottled, phone 390x844@2), step by step.
//   node route-fonts.cjs <url>
const {chromium} = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const [,, url] = process.argv;
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const ctx = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 2});
  const page = await ctx.newPage(); page.setDefaultTimeout(25000);
  let step = 'load'; const got = []; const seen = new Set();
  page.on('response', async r => { const u = r.url(); if (!/\.woff2$/.test(u)) return; const name = u.split('/').pop(); if (seen.has(name)) return; seen.add(name); let bytes = 0; try { bytes = (await r.body()).length; } catch (e) {} got.push({step, name, kb: Math.round(bytes / 1024)}); });
  const mark = async (s, fn) => { step = s; try { await fn(); } catch (e) { console.log(`[${s}] ${e.message.split('\n')[0]}`); } await sleep(1500); };
  const clickText = async (sel, text) => { const l = page.locator(sel, {hasText: text}).first(); await l.waitFor({state: 'visible', timeout: 15000}); await l.click(); };
  await mark('load+lobby', async () => { await page.goto(url, {waitUntil: 'domcontentloaded'}); await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, {timeout: 60000}); await sleep(1500); });
  await mark('entry form', async () => { await clickText('button', '进入示例现场'); await page.waitForSelector('form[data-form="demo-entry"]'); });
  await mark('enter room', async () => { await page.check('form[data-form="demo-entry"] input[name="consent"]'); await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button[type="submit"]')?.disabled, null, {timeout: 30000}); await page.click('form[data-form="demo-entry"] button[type="submit"]'); await page.waitForSelector('[data-tour-action="sample:sample-crowd"]', {timeout: 30000}); });
  await mark('upload form', async () => { await page.click('[data-tour-action="sample:sample-crowd"]'); await page.waitForSelector('form[data-form="upload"] .photo-review', {timeout: 30000}); await page.waitForSelector('form[data-form="upload"] .moment-chip.is-ai, form[data-form="upload"] .moment-ai-tag', {timeout: 45000}).catch(() => {}); });
  await mark('photo wall', async () => { const has = await page.evaluate(() => !!document.querySelector('form[data-form="upload"] .moment-chip[aria-pressed="true"]')); if (!has) await page.click('form[data-form="upload"] .moment-chip[data-moment-viewpoint="crowd"]'); await page.click('form[data-form="upload"] button[type="submit"]'); await page.waitForSelector('.moment-wall, .panel .photo-grid', {timeout: 30000}); });
  await mark('exchange compose', async () => { await page.click('[data-moment-badge] [data-exchange-offer]'); await page.waitForSelector('.photo-exchanges:not([hidden]) .exchange-pair', {timeout: 20000}); });
  await mark('exchange accepted', async () => { await page.check('.photo-exchanges [data-x-consent]'); await page.waitForFunction(() => !document.querySelector('.photo-exchanges [data-x-send]')?.disabled, null, {timeout: 20000}); await page.click('.photo-exchanges [data-x-send]'); await page.waitForFunction(() => /交换已接受/.test(document.querySelector('.photo-exchanges .exchange-status')?.textContent || ''), null, {timeout: 60000}); await page.click('.photo-exchanges [data-x-close]').catch(() => {}); });
  for (const [label, sel] of [['nav 同场的人', 'nav.camera-nav button[data-view=person]'], ['nav 照片墙', 'nav.camera-nav button[data-view=photos]'], ['nav 我的空间', '#my-space'], ['top 音乐探索', '#music-map-entry'], ['top ♡', '#social-inbox'], ['top 我的小人', '#my-look'], ['top ···', '#room-info']]) {
    await mark(label, async () => { if (await page.isVisible('#panel-close').catch(() => false)) await page.click('#panel-close').catch(() => {}); await page.keyboard.press('Escape').catch(() => {}); await sleep(300); await page.click(sel, {timeout: 8000}); await sleep(1500); });
  }
  await browser.close();
  let total = 0; for (const g of got) { total += g.kb; console.log(g.step.padEnd(20), g.name.padEnd(18), String(g.kb).padStart(5) + ' KB', ' cumulative', total + ' KB'); }
})().catch(e => { console.error(e); process.exit(1); });
