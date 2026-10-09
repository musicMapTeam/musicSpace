// Walk the judge route at 1440x900 with an optional injected CSS fix; measure the room card at every tour step.
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const OUT = '/tmp/space-doodle/critique/verify-3';
const [, , name, cssFile] = process.argv;
const CSS = cssFile ? JSON.parse(fs.readFileSync(cssFile, 'utf8'))[name]?.css || '' : '';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
  const page = await ctx.newPage(); page.setDefaultTimeout(60000);
  await page.goto('http://127.0.0.1:5190/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 120000 });
  if (CSS) await page.addStyleTag({ content: CSS });
  await page.click('#join');
  await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button[type="submit"]')?.disabled);
  await page.check('form[data-form="demo-entry"] input[name="consent"]');
  await page.click('form[data-form="demo-entry"] button[type="submit"]');
  await page.waitForFunction(() => document.querySelector('.frame')?.dataset.stage === 'room');
  await sleep(5000);
  const measure = async label => {
    await sleep(1500);
    const m = await page.evaluate(() => {
      const R = r => [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)];
      const pres = document.querySelector('.presence'), card = pres.getBoundingClientRect();
      const ovl = (r, c) => Math.max(0, Math.min(r.right, c.right) - Math.max(r.left, c.left)) * Math.max(0, Math.min(r.bottom, c.bottom) - Math.max(r.top, c.top)) / (r.width * r.height);
      const tags = [];
      for (const h of document.querySelectorAll('#hotspots .hotspot')) { if (h.hidden) continue; const r = h.querySelector('.label').getBoundingClientRect(); if (!r.width) continue; const t = h.querySelector('.label').textContent.trim(); if (/照片墙|我$/.test(t)) tags.push(`${t}=${Math.round(100 * ovl(r, card))}%`); }
      const step = document.querySelector('#demo-tour .demo-tour-step')?.textContent.trim();
      const btns = [...pres.querySelectorAll('button')].filter(b => b.offsetParent && getComputedStyle(b).visibility !== 'hidden').map(b => `${b.textContent.trim().slice(0, 12)}:${Math.round(b.getBoundingClientRect().height)}`);
      return { cls: pres.className, vis: getComputedStyle(pres).visibility, card: R(card), size: `${Math.round(card.width)}x${Math.round(card.height)}`, step, tags, btns };
    });
    console.log(label, JSON.stringify(m));
    await page.screenshot({ path: `${OUT}/steps-${name}-${label}.png` });
  };
  await measure('s1');
  await page.click('[data-tour-action="sample:sample-crowd"]');
  const upload = page.locator('form[data-form="upload"]');
  await upload.waitFor({ state: 'visible' });
  const ai = await page.waitForFunction(() => { const l = document.querySelector('form[data-form="upload"] [data-ai-line]'); const k = l?.getAttribute('data-ai-key') || ''; return /^(sure|unsure|off)/.test(k) ? k : false; }, null, { timeout: 120000 }).then(h => h.jsonValue()).catch(() => 'timeout');
  console.log('ai', ai);
  await upload.locator('button[type="submit"]').click();
  const offer = page.locator('[data-moment-badge] [data-exchange-offer]').first();
  await offer.waitFor({ state: 'visible', timeout: 45000 });
  await page.click('#panel-close'); await sleep(800);
  await measure('s2-after-save');
  // exchange
  await page.click('[data-tour-action="open:wall"]').catch(() => page.click('.camera-nav [data-view="photos"]'));
  await offer.waitFor({ state: 'visible', timeout: 45000 });
  await offer.click();
  await page.waitForSelector('.photo-exchanges [data-x-consent]', { state: 'attached', timeout: 20000 });
  await page.locator('.photo-exchanges [data-x-consent]').check({ force: true }).catch(async () => page.click('.photo-exchanges .exchange-agreement label'));
  await page.waitForFunction(() => !document.querySelector('.photo-exchanges [data-x-send]')?.disabled, null, { timeout: 20000 });
  await page.click('.photo-exchanges [data-x-send]');
  await page.waitForFunction(() => /交换已接受/.test(document.querySelector('.photo-exchanges .exchange-status')?.textContent || ''), null, { timeout: 90000 });
  await page.click('.photo-exchanges [data-x-close]').catch(() => {});
  await sleep(800);
  if (await page.evaluate(() => !document.querySelector('#panel').hidden)) { await page.click('#panel-close').catch(() => {}); }
  await page.click('.camera-nav [data-view="overview"]').catch(() => {});
  await sleep(2500);
  await measure('s4-after-exchange');
  await page.evaluate(() => document.querySelector('[data-tour-toggle]')?.click());
  await measure('s4-collapsed');
  await browser.close();
})().catch(e => { console.error('FAIL', String(e).slice(0, 600)); process.exit(1); });
