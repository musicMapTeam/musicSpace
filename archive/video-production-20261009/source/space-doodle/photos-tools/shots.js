// Judge-route screenshots for the "photos" owner: upload (sure / unsure / loading), wall, wall badge, compose, pending, accepted, recap, memory card, PNG.
// usage: node shots.js <before|after> [phone|desktop|both] [screens comma list]
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const path = require('path');
const URL = process.env.SPACE_URL || 'http://127.0.0.1:5190/';
const OUT = process.env.SHOTS_OUT || '/tmp/space-doodle/shots/photos';
const tag = process.argv[2] || 'after';
const which = process.argv[3] || 'both';
const only = (process.argv[4] || '').split(',').filter(Boolean);
const want = name => !only.length || only.includes(name);
const VIEWPORTS = { phone: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desktop: { width: 1440, height: 900, deviceScaleFactor: 1 }, narrow: { width: 320, height: 640, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function overflow(page, name) {
  const found = await page.evaluate(() => {
    const out = [];
    for (const root of document.querySelectorAll('#panel:not([hidden]), .photo-exchanges:not([hidden])')) {
      const box = root.getBoundingClientRect();
      for (const el of root.querySelectorAll('*')) {
        if (!el.getClientRects().length) continue;
        const r = el.getBoundingClientRect();
        if (r.width && (r.right > box.right + 1 || r.left < box.left - 1)) out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').join('.')} ${Math.round(r.left)}-${Math.round(r.right)} in ${Math.round(box.left)}-${Math.round(box.right)} «${(el.textContent || '').trim().slice(0, 24)}»`);
        const cs = getComputedStyle(el);
        if (cs.clipPath === 'inset(50%)' || el.classList.contains('sr-only')) continue;
        if (el.scrollWidth > el.clientWidth + 1 && cs.overflowX !== 'visible' && !['SELECT', 'INPUT'].includes(el.tagName)) out.push(`scroll-x ${el.tagName.toLowerCase()}.${String(el.className)} ${el.scrollWidth}>${el.clientWidth}`);
      }
    }
    return out.slice(0, 12);
  });
  if (found.length) console.log(`[overflow ${name}]`, found.join('\n  '));
}

async function shot(page, name, vp, opts = {}) {
  const file = path.join(OUT, `${tag}-${name}-${vp}.png`);
  await sleep(opts.settle ?? 450);
  await overflow(page, `${name}-${vp}`);
  await page.screenshot({ path: file, ...opts.clip ? { clip: opts.clip } : {} });
  console.log('saved', file);
}

// scroll the nearest scrollable ancestor so that `selector` sits near the top (block 'start') or bottom ('end'); never scrolls the document
async function reveal(page, selector, block = 'start', index = 0) {
  await page.evaluate(([selector, block, index]) => {
    const el = document.querySelectorAll(selector)[index];
    if (!el) return;
    let box = el.parentElement;
    while (box && !(box.scrollHeight > box.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
    if (!box) return;
    const r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
    if (block === 'end') box.scrollTop += r.bottom - b.bottom + 16; else if (block === 'center') box.scrollTop += (r.top + r.height / 2) - (b.top + b.height / 2); else box.scrollTop += r.top - b.top - 12;
    window.scrollTo(0, 0); document.scrollingElement.scrollTop = 0;
  }, [selector, block, index]);
}

async function clickText(page, selector, text, timeout = 15000) {
  const loc = page.locator(selector, { hasText: text }).first();
  await loc.waitFor({ state: 'visible', timeout });
  await loc.click();
}

async function run(vp) {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const context = await browser.newContext({ viewport: { width: VIEWPORTS[vp].width, height: VIEWPORTS[vp].height }, deviceScaleFactor: VIEWPORTS[vp].deviceScaleFactor, isMobile: VIEWPORTS[vp].isMobile || false, hasTouch: VIEWPORTS[vp].hasTouch || false, acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(25000);
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 60000 });
  await sleep(800);
  // enter the example room
  await clickText(page, 'button', '进入示例现场');
  await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 15000 });
  await page.check('form[data-form="demo-entry"] input[name="consent"]');
  await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button[type="submit"]')?.disabled, null, { timeout: 30000 });
  await page.click('form[data-form="demo-entry"] button[type="submit"]');
  await page.waitForSelector('[data-tour-action="sample:sample-crowd"]', { timeout: 30000 });
  await sleep(600);
  await page.click('[data-tour-action="sample:sample-crowd"]');
  await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
  // wait for the AI answer (sure) or give up after a while
  try { await page.waitForSelector('form[data-form="upload"] .moment-chip.is-ai, form[data-form="upload"] .moment-ai-tag', { timeout: 45000 }); } catch { console.log('no AI answer in time'); }
  await reveal(page, 'form[data-form="upload"] .moment-taken', 'start');
  if (want('upload-sure')) await shot(page, 'upload-sure', vp);
  if (want('upload-top')) { await page.evaluate(() => { const b = document.querySelector('#panel-body'); if (b) b.scrollTop = 0; document.querySelector('#panel')?.scrollTo?.(0, 0); }); await shot(page, 'upload-top', vp); }
  // the unsure state, as moment-upload.js draws it (two dashed chips, nothing selected, the unsure tag)
  if (want('upload-unsure') || want('upload-loading')) {
    const saved = await page.evaluate(() => {
      const form = document.querySelector('form[data-form="upload"]');
      const line = form.querySelector('[data-ai-line]');
      const chips = [...form.querySelectorAll('.moment-chip')];
      return { line: line.innerHTML, key: line.getAttribute('data-ai-key'), chips: chips.map(c => [c.className, c.getAttribute('aria-pressed')]) };
    });
    if (want('upload-unsure')) {
      await page.evaluate(() => {
        const form = document.querySelector('form[data-form="upload"]');
        const line = form.querySelector('[data-ai-line]');
        line.innerHTML = '<span class="moment-ai-tag moment-ai-tag--unsure">不确定，请选择</span><span class="sr-only">，AI 认为更可能是人海或身边</span>';
        for (const c of form.querySelectorAll('.moment-chip')) { c.classList.remove('is-selected', 'is-ai'); c.setAttribute('aria-pressed', 'false'); if (['crowd', 'friends'].includes(c.dataset.momentViewpoint)) c.classList.add('is-suggested'); }
      });
      await reveal(page, 'form[data-form="upload"] .moment-taken', 'start');
      await shot(page, 'upload-unsure', vp);
    }
    if (want('upload-loading')) {
      await page.evaluate(() => {
        const form = document.querySelector('form[data-form="upload"]');
        const line = form.querySelector('[data-ai-line]');
        line.innerHTML = '<span>AI 在本机判断视角 · 首次需下载模型<span class="nowrap">（约 10–23 MB）</span><span class="nowrap" data-ai-percent aria-hidden="true"> 42%</span></span><span class="moment-ai-line__bar" aria-hidden="true"><i data-ai-fill style="width:42%"></i></span>';
        for (const c of form.querySelectorAll('.moment-chip')) { c.classList.remove('is-selected', 'is-ai', 'is-suggested'); c.setAttribute('aria-pressed', 'false'); }
      });
      await reveal(page, 'form[data-form="upload"] .moment-taken', 'start');
      await shot(page, 'upload-loading', vp);
    }
    // put the real state back
    await page.evaluate(s => {
      const form = document.querySelector('form[data-form="upload"]');
      const line = form.querySelector('[data-ai-line]');
      line.innerHTML = s.line;
      [...form.querySelectorAll('.moment-chip')].forEach((c, i) => { c.className = s.chips[i][0]; c.setAttribute('aria-pressed', s.chips[i][1]); });
    }, saved);
  }
  if (process.env.STOP_AFTER === 'upload') { await browser.close(); return; }
  // make sure a viewpoint is chosen (the AI may not have answered)
  const hasView = await page.evaluate(() => Boolean(document.querySelector('form[data-form="upload"] .moment-chip[aria-pressed="true"]')));
  if (!hasView) await page.click('form[data-form="upload"] .moment-chip[data-moment-viewpoint="crowd"]');
  await page.click('form[data-form="upload"] button[type="submit"]');
  await page.waitForSelector('.moment-wall, .panel .photo-grid', { timeout: 30000 });
  await page.waitForFunction(() => [...document.querySelectorAll('.panel .photo-item img')].length >= 2, null, { timeout: 30000 }).catch(() => {});
  await sleep(1200);
  if (want('wall')) { await page.evaluate(() => { document.querySelector('#panel-body')?.scrollTo?.(0, 0); document.querySelector('#panel')?.scrollTo?.(0, 0); }); await shot(page, 'wall', vp); }
  if (want('wall-badge')) {
    await reveal(page, '.moment-card--best', 'start');
    await shot(page, 'wall-badge', vp);
  }
  if (want('wall-more')) {
    const n = await page.evaluate(() => document.querySelectorAll('.moment-group').length);
    await reveal(page, '.moment-group', 'start', n - 1);
    await shot(page, 'wall-more', vp);
  }
  if (want('wall-mine')) {
    const index = await page.evaluate(() => [...document.querySelectorAll('.moment-card')].findIndex(card => card.querySelector('.moment-meta__by--ai')));
    if (index >= 0) { await reveal(page, '.moment-card', 'center', index); await shot(page, 'wall-mine', vp); } else console.log('no AI byline on the wall');
  }
  if (process.env.STOP_AFTER === 'wall') { await browser.close(); return; }
  // exchange compose
  await page.click('[data-moment-badge] [data-exchange-offer]');
  await page.waitForSelector('.photo-exchanges:not([hidden]) .exchange-pair', { timeout: 20000 });
  await page.waitForFunction(() => document.querySelectorAll('.photo-exchanges .exchange-photo img').length >= 2, null, { timeout: 30000 }).catch(() => console.log('compose images not both loaded'));
  await sleep(700);
  if (want('compose')) await shot(page, 'compose', vp);
  if (want('compose-consent')) {
    await reveal(page, '.photo-exchanges [data-x-send]', 'end');
    await shot(page, 'compose-consent', vp);
  }
  await page.check('.photo-exchanges [data-x-consent]');
  await page.waitForFunction(() => !document.querySelector('.photo-exchanges [data-x-send]')?.disabled, null, { timeout: 20000 });
  if (want('compose-ready')) { await reveal(page, '.photo-exchanges [data-x-send]', 'end'); await shot(page, 'compose-ready', vp); }
  await page.click('.photo-exchanges [data-x-send]');
  await page.waitForSelector('.photo-exchanges .exchange-status', { timeout: 20000 });
  await sleep(500);
  if (want('pending')) { await page.evaluate(() => { const b = document.querySelector('.photo-exchanges .exchange-body'); if (b) b.scrollTop = 0; }); await shot(page, 'pending', vp, { settle: 200 }); }
  await page.waitForFunction(() => /交换已接受/.test(document.querySelector('.photo-exchanges .exchange-status')?.textContent || ''), null, { timeout: 60000 });
  await page.waitForFunction(() => document.querySelectorAll('.photo-exchanges .exchange-photo img').length >= 2, null, { timeout: 30000 }).catch(() => console.log('accepted images not both loaded'));
  await sleep(1200);
  if (want('accepted')) { await page.evaluate(() => { const b = document.querySelector('.photo-exchanges .exchange-body'); if (b) b.scrollTop = 0; }); await shot(page, 'accepted', vp); }
  if (want('accepted-more')) { await page.evaluate(() => { const b = document.querySelector('.photo-exchanges .exchange-body'); if (b) b.scrollTop = b.scrollHeight; }); await shot(page, 'accepted-more', vp); }
  if (want('exchange-list')) {
    await page.click('.photo-exchanges [data-x-back]');
    await page.waitForSelector('.photo-exchanges .exchange-list button', { timeout: 20000 }).catch(() => {});
    await shot(page, 'exchange-list', vp);
  }
  if (process.env.STOP_AFTER === 'exchange') { await browser.close(); return; }
  await page.click('.photo-exchanges [data-x-close]');
  await sleep(400);
  // recap
  await page.evaluate(() => { const b = document.querySelector('#room-recap'); if (b && !b.hidden) b.click(); });
  let recapOpen = await page.waitForSelector('.panel[data-kind="recap"]:not([hidden])', { timeout: 8000 }).then(() => true).catch(() => false);
  if (!recapOpen) {
    // open the room info menu → recap
    await page.evaluate(() => document.querySelector('[data-open="recap"]')?.click());
    recapOpen = await page.waitForSelector('.panel[data-kind="recap"]:not([hidden])', { timeout: 8000 }).then(() => true).catch(() => false);
  }
  if (recapOpen) {
    await page.waitForFunction(() => document.querySelector('.panel[data-kind="recap"] .recap-keepsake'), null, { timeout: 20000 }).catch(() => {});
    await sleep(1500);
    if (want('recap')) await shot(page, 'recap', vp);
    if (want('recap-more')) { await reveal(page, '.panel[data-kind="recap"] .recap-keepsake', 'start'); await shot(page, 'recap-more', vp); }
    if (want('recap-photos')) { await reveal(page, '.panel[data-kind="recap"] .recap-section', 'start', 1); await shot(page, 'recap-photos', vp); }
    await page.click('.panel[data-kind="recap"] [data-open="memory-card"]');
    await page.waitForSelector('form[data-form="memory-card"]', { timeout: 20000 });
    await page.waitForFunction(() => document.querySelectorAll('form[data-form="memory-card"] .memory-photo-options img').length >= 1, null, { timeout: 20000 }).catch(() => {});
    await sleep(800);
    if (want('memory-empty')) await shot(page, 'memory-empty', vp);
    await page.locator('form[data-form="memory-card"] input[name="memory-photo"]').first().check({ timeout: 8000 }).catch(e => console.log('photo check', e.message.split('\n')[0]));
    await sleep(500);
    await page.locator('form[data-form="memory-card"] input[name="memory-avatar"]').check({ timeout: 8000 }).catch(e => console.log('avatar check', e.message.split('\n')[0]));
    await sleep(500);
    await page.locator('form[data-form="memory-card"] input[name="memory-confirm"]').check({ timeout: 8000 }).catch(e => console.log('confirm check', e.message.split('\n')[0]));
    await sleep(500);
    if (want('memory')) await shot(page, 'memory', vp);
    if (want('memory-bottom')) { await reveal(page, 'form[data-form="memory-card"] button[type="submit"]', 'end'); await shot(page, 'memory-bottom', vp); }
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }).catch(() => null),
      page.click('form[data-form="memory-card"] button[type="submit"]'),
    ]);
    if (download) { const file = path.join(OUT, `${tag}-memory-png-${vp}.png`); await download.saveAs(file); console.log('saved', file); }
    await page.waitForSelector('.memory-result img', { timeout: 20000 }).catch(() => {});
    await sleep(800);
    if (want('memory-result')) { await reveal(page, '.memory-result', 'start'); await shot(page, 'memory-result', vp); }
  } else console.log('recap did not open');
  await browser.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const list = which === 'both' ? ['phone', 'desktop'] : [which];
  for (const vp of list) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try { await run(vp); break; } catch (error) { console.log(`[${vp}] attempt ${attempt} failed:`, error.message.split('\n').slice(0, 8).join(' | ')); if (attempt === 2) process.exitCode = 1; }
    }
  }
})();
