// walk2: judge photo route — upload (sure/unsure), save toast, wall, route card steps 2-4 + complete, compose, pending, accepted, recap, memory card + PNG.
// usage: node walk2.cjs <phone|desktop>
const L = require('./lib.cjs');
const path = require('path');
L.watchdog(290);
const kind = process.argv[2] || 'phone';
const sleep = L.sleep;
async function reveal(page, selector, block = 'start', index = 0) {
  await page.evaluate(([selector, block, index]) => {
    const el = document.querySelectorAll(selector)[index]; if (!el) return;
    let box = el.parentElement;
    while (box && !(box.scrollHeight > box.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
    if (!box) return;
    const r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
    if (block === 'end') box.scrollTop += r.bottom - b.bottom + 16; else box.scrollTop += r.top - b.top - 12;
  }, [selector, block, index]);
}
async function toastShot(page, name, ms = 4000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const t = await page.evaluate(() => { const n = document.querySelector('#toast'); return n && n.classList.contains('visible') ? n.textContent : ''; }); if (t) { console.log('toast:', t); await L.shot(page, name, kind, { settle: 300, audit: false }); return true; } await sleep(150); }
  return false;
}
async function tourShot(page, name) {
  const vis = await page.evaluate(() => { const t = document.querySelector('.demo-tour'); return t && !t.hidden && t.getClientRects().length ? t.textContent.slice(0, 40) : ''; });
  console.log('tour:', vis);
  if (vis) await L.shot(page, name, kind);
}
(async () => {
  const b = await L.launch();
  const { page } = await L.open(b, kind);
  try {
    await L.enter(page);
    await page.click('[data-tour-action="sample:sample-crowd"]');
    await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
    try { await page.waitForSelector('form[data-form="upload"] .moment-chip.is-ai, form[data-form="upload"] .moment-ai-tag', { timeout: 45000 }); } catch { console.log('no AI answer in time'); }
    await sleep(800);
    await L.shot(page, 'b01-upload-top', kind, { scope: '#panel' });
    await reveal(page, 'form[data-form="upload"] .moment-taken', 'start');
    await L.shot(page, 'b02-upload-sure', kind, { scope: '#panel' });
    // unsure state (as moment-upload.js draws it)
    const saved = await page.evaluate(() => { const form = document.querySelector('form[data-form="upload"]'); const line = form.querySelector('[data-ai-line]'); return { line: line.innerHTML, chips: [...form.querySelectorAll('.moment-chip')].map(c => [c.className, c.getAttribute('aria-pressed')]) }; });
    await page.evaluate(() => { const form = document.querySelector('form[data-form="upload"]'); const line = form.querySelector('[data-ai-line]'); line.innerHTML = '<span class="moment-ai-tag moment-ai-tag--unsure">不确定，请选择</span><span class="sr-only">，AI 认为更可能是人海或身边</span>'; for (const c of form.querySelectorAll('.moment-chip')) { c.classList.remove('is-selected', 'is-ai'); c.setAttribute('aria-pressed', 'false'); if (['crowd', 'friends'].includes(c.dataset.momentViewpoint)) c.classList.add('is-suggested'); } });
    await L.shot(page, 'b03-upload-unsure', kind, { scope: '#panel' });
    await page.evaluate(s => { const form = document.querySelector('form[data-form="upload"]'); form.querySelector('[data-ai-line]').innerHTML = s.line; [...form.querySelectorAll('.moment-chip')].forEach((c, i) => { c.className = s.chips[i][0]; c.setAttribute('aria-pressed', s.chips[i][1]); }); }, saved);
    await reveal(page, 'form[data-form="upload"] button[type="submit"]', 'end');
    await L.shot(page, 'b04-upload-bottom', kind, { scope: '#panel' });
    const hasView = await page.evaluate(() => Boolean(document.querySelector('form[data-form="upload"] .moment-chip[aria-pressed="true"]')));
    if (!hasView) await page.click('form[data-form="upload"] .moment-chip[data-moment-viewpoint="crowd"]');
    await page.click('form[data-form="upload"] button[type="submit"]');
    await toastShot(page, 'b05-toast-saved', 5000);
    await page.waitForSelector('.moment-wall, .panel .photo-grid', { timeout: 30000 });
    await page.waitForFunction(() => [...document.querySelectorAll('.panel .moment-card img, .panel .photo-item img')].length >= 2, null, { timeout: 30000 }).catch(() => {});
    await sleep(1500);
    await page.evaluate(() => { document.querySelector('#panel-body')?.scrollTo?.(0, 0); document.querySelector('#panel')?.scrollTo?.(0, 0); });
    await L.shot(page, 'b06-wall-top', kind, { scope: '#panel' });
    await reveal(page, '.moment-card--best', 'start');
    await L.shot(page, 'b07-wall-badge', kind, { scope: '#panel' });
    const n = await page.evaluate(() => document.querySelectorAll('.moment-group').length);
    if (n > 1) { await reveal(page, '.moment-group', 'start', n - 1); await L.shot(page, 'b08-wall-more', kind, { scope: '#panel' }); }
    // close the wall: route card step 3 should show
    await L.closeEverything(page);
    await sleep(1200);
    await tourShot(page, 'b09-tour-step3');
    // open wall again via the tour, then compose
    await page.evaluate(() => document.querySelector('[data-tour-action="open:wall"]')?.click());
    await sleep(1800);
    await page.waitForSelector('[data-moment-badge] [data-exchange-offer]', { timeout: 20000 });
    await reveal(page, '[data-moment-badge]', 'start');
    await page.click('[data-moment-badge] [data-exchange-offer]');
    await page.waitForSelector('.photo-exchanges:not([hidden]) .exchange-pair', { timeout: 20000 });
    await page.waitForFunction(() => document.querySelectorAll('.photo-exchanges .exchange-photo img').length >= 2, null, { timeout: 30000 }).catch(() => console.log('compose images not both loaded'));
    await sleep(900);
    await L.shot(page, 'b10-compose', kind, { scope: '.photo-exchanges' });
    await reveal(page, '.photo-exchanges [data-x-send]', 'end');
    await L.shot(page, 'b11-compose-consent', kind, { scope: '.photo-exchanges' });
    await page.check('.photo-exchanges [data-x-consent]');
    await page.waitForFunction(() => !document.querySelector('.photo-exchanges [data-x-send]')?.disabled, null, { timeout: 20000 });
    await sleep(300);
    await L.shot(page, 'b12-compose-ready', kind, { scope: '.photo-exchanges' });
    await page.click('.photo-exchanges [data-x-send]');
    await page.waitForSelector('.photo-exchanges .exchange-status', { timeout: 20000 });
    await toastShot(page, 'b13-toast-sent', 2500);
    await page.evaluate(() => { const b = document.querySelector('.photo-exchanges .exchange-body'); if (b) b.scrollTop = 0; });
    await L.shot(page, 'b14-pending', kind, { settle: 200, scope: '.photo-exchanges' });
    await page.waitForFunction(() => /交换已接受/.test(document.querySelector('.photo-exchanges .exchange-status')?.textContent || ''), null, { timeout: 60000 });
    await page.waitForFunction(() => document.querySelectorAll('.photo-exchanges .exchange-photo img').length >= 2, null, { timeout: 30000 }).catch(() => console.log('accepted images not both loaded'));
    await sleep(1300);
    await page.evaluate(() => { const b = document.querySelector('.photo-exchanges .exchange-body'); if (b) b.scrollTop = 0; });
    await L.shot(page, 'b15-accepted', kind, { scope: '.photo-exchanges' });
    await page.evaluate(() => { const b = document.querySelector('.photo-exchanges .exchange-body'); if (b) b.scrollTop = b.scrollHeight; });
    await L.shot(page, 'b16-accepted-end', kind, { scope: '.photo-exchanges' });
    await page.click('.photo-exchanges [data-x-close]');
    await sleep(1500);
    await tourShot(page, 'b17-tour-step4');
    // recap
    await page.evaluate(() => { const x = document.querySelector('[data-tour-action="open:recap"]') || document.querySelector('#room-recap'); x?.click(); });
    await page.waitForSelector('.panel[data-kind="recap"]:not([hidden])', { timeout: 10000 }).catch(async () => { await L.openKind(page, 'recap'); });
    await page.waitForFunction(() => document.querySelector('.panel[data-kind="recap"] .recap-keepsake'), null, { timeout: 20000 }).catch(() => {});
    await sleep(1600);
    await L.shot(page, 'b18-recap', kind, { scope: '#panel' });
    await reveal(page, '.panel[data-kind="recap"] .recap-keepsake', 'start');
    await L.shot(page, 'b19-recap-keepsake', kind, { scope: '#panel' });
    await reveal(page, '.panel[data-kind="recap"] .recap-section', 'start', 1);
    await L.shot(page, 'b20-recap-photos', kind, { scope: '#panel' });
    await page.evaluate(() => { const p = document.querySelector('#panel-body'); if (p) p.scrollTop = p.scrollHeight; });
    await L.shot(page, 'b21-recap-end', kind, { scope: '#panel' });
    await page.click('.panel[data-kind="recap"] [data-open="memory-card"]');
    await page.waitForSelector('form[data-form="memory-card"]', { timeout: 20000 });
    await page.waitForFunction(() => document.querySelectorAll('form[data-form="memory-card"] .memory-photo-options img').length >= 1, null, { timeout: 20000 }).catch(() => {});
    await sleep(900);
    await L.shot(page, 'b22-memory-empty', kind, { scope: '#panel' });
    await page.locator('form[data-form="memory-card"] input[name="memory-photo"]').first().check({ timeout: 8000 }).catch(e => console.log('photo check', e.message.split('\n')[0]));
    await sleep(400);
    await page.locator('form[data-form="memory-card"] input[name="memory-avatar"]').check({ timeout: 8000 }).catch(e => console.log('avatar check', e.message.split('\n')[0]));
    await sleep(400);
    await page.locator('form[data-form="memory-card"] input[name="memory-confirm"]').check({ timeout: 8000 }).catch(e => console.log('confirm check', e.message.split('\n')[0]));
    await sleep(500);
    await L.shot(page, 'b23-memory-filled', kind, { scope: '#panel' });
    await reveal(page, 'form[data-form="memory-card"] button[type="submit"]', 'end');
    await L.shot(page, 'b24-memory-bottom', kind, { scope: '#panel' });
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }).catch(() => null), page.click('form[data-form="memory-card"] button[type="submit"]')]);
    if (download) { const file = path.join(L.OUT, `b25-memory-png-${kind}.png`); await download.saveAs(file); console.log('saved', file); }
    await page.waitForSelector('.memory-result img', { timeout: 20000 }).catch(() => {});
    await sleep(900);
    await reveal(page, '.memory-result', 'start');
    await L.shot(page, 'b26-memory-result', kind, { scope: '#panel' });
    await L.closeEverything(page);
    await sleep(1200);
    await tourShot(page, 'b27-tour-complete');
    await L.shot(page, 'b28-room-after-route', kind);
    console.log('logs', JSON.stringify(page.__logs.slice(0, 10)));
  } catch (e) { console.error('ERR', e.message.split('\n')[0]); await page.screenshot({ path: `${L.OUT}/ERR-walk2-${kind}.png` }).catch(() => {}); }
  await b.close();
})();
