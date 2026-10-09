// verify-11: independent repro of "desktop route card stacked on the full presence card". Read-only.
const { chromium } = require('/tmp/space-video-prep/tools/node_modules/playwright-core');
const fs = require('fs');
const OUT = '/tmp/space-doodle/verify-11/shots';
const URL = process.env.SPACE_URL || 'http://127.0.0.1:5190/';
const kind = process.argv[2] || 'desktop';
const walk = process.argv[3] !== 'step1';
const VP = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  d1280: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  d1920: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
setTimeout(() => { console.error('watchdog'); process.exit(2); }, 285000).unref();
async function measure(page, label) {
  const m = await page.evaluate(() => {
    const vis = el => { if (!el || !el.getClientRects().length) return false; for (let n = el; n; n = n.parentElement) { const s = getComputedStyle(n); if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false; } const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < innerHeight; };
    const R = el => { const r = el.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; };
    const pres = document.querySelector('.frame .presence');
    const tour = document.querySelector('.demo-tour');
    const world = document.querySelector('.world-shell');
    const own = el => [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
    const display = [...document.querySelectorAll('body *')].filter(el => vis(el) && /Doodle Display|Doodle Logo/.test(getComputedStyle(el).fontFamily.split(',')[0]) && (own(el) || el.id === 'room-title'))
      .map(el => { const cs = getComputedStyle(el); return { el: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''), text: el.textContent.trim().slice(0, 24), font: cs.fontFamily.split(',')[0], size: cs.fontSize, shadow: cs.textShadow, bg: cs.backgroundColor, stroke: cs.webkitTextStrokeWidth, rect: R(el) }; });
    const buttons = pres ? [...pres.querySelectorAll('button')].filter(vis).map(b => { const cs = getComputedStyle(b); return { id: b.id || b.dataset.tourAction || (b.className || ''), text: b.textContent.trim(), bg: cs.backgroundColor, shadow: cs.boxShadow, rect: R(b) }; }) : [];
    const ink = buttons.filter(b => b.bg === 'rgb(28, 27, 26)');
    const counts = {}; for (const b of buttons) counts[b.text] = (counts[b.text] || 0) + 1;
    const dups = Object.entries(counts).filter(([, n]) => n > 1);
    const pr = pres && vis(pres) ? pres.getBoundingClientRect() : null;
    const tags = [...document.querySelectorAll('#hotspots [data-kind]')].filter(vis).map(t => { const r = t.getBoundingClientRect(); const cover = pr ? Math.max(0, Math.min(r.right, pr.right) - Math.max(r.left, pr.left)) * Math.max(0, Math.min(r.bottom, pr.bottom) - Math.max(r.top, pr.top)) / (r.width * r.height) : 0; return { kind: t.dataset.kind, text: t.textContent.trim().slice(0, 16), rect: R(t), covered: Math.round(cover * 100) }; });
    const caption = document.querySelector('.desktop-caption');
    return {
      vw: innerWidth, vh: innerHeight,
      presenceClass: pres?.className, presenceRect: pres && vis(pres) ? R(pres) : null, tourRect: tour && vis(tour) ? R(tour) : null, worldRect: world ? R(world) : null,
      tourHidden: tour?.hidden, tourText: tour && vis(tour) ? tour.textContent.replace(/\s+/g, ' ').trim().slice(0, 80) : '',
      presenceShown: pres ? [...pres.children].filter(vis).map(c => (c.id || c.className || c.tagName) + ':' + c.textContent.replace(/\s+/g, ' ').trim().slice(0, 40)) : [],
      captionVisible: vis(caption),
      display, buttons: buttons.map(b => `${b.text} [${b.bg === 'rgb(28, 27, 26)' ? 'INK' : b.bg}] ${b.rect.join(',')}`), inkButtons: ink.map(b => b.text), dupButtons: dups, tags,
    };
  });
  fs.writeFileSync(`${OUT}/${label}-${kind}.json`, JSON.stringify(m, null, 1));
  await page.evaluate(() => document.activeElement?.blur?.());
  await sleep(500);
  await page.screenshot({ path: `${OUT}/${label}-${kind}.png` });
  if (m.presenceRect) { const [x, y, w, h] = m.presenceRect; const pad = 24; await page.screenshot({ path: `${OUT}/${label}-${kind}-crop.png`, clip: { x: Math.max(0, x - pad), y: Math.max(0, y - pad), width: Math.min(m.vw - Math.max(0, x - pad), w + 2 * pad), height: Math.min(m.vh - Math.max(0, y - pad), h + 2 * pad) } }); }
  console.log(`== ${label} (${kind})`);
  console.log(' presence', m.presenceClass, m.presenceRect, 'tour', m.tourRect, 'world', m.worldRect, 'caption', m.captionVisible);
  console.log(' tour:', m.tourText);
  console.log(' presence children shown:', JSON.stringify(m.presenceShown));
  console.log(' display-face text:'); for (const d of m.display) console.log('   ', d.el, JSON.stringify(d.text), d.size, 'shadow=' + d.shadow, 'bg=' + d.bg, d.rect.join(','));
  console.log(' buttons in presence:'); for (const b of m.buttons) console.log('   ', b);
  console.log(' INK buttons:', JSON.stringify(m.inkButtons), ' duplicates:', JSON.stringify(m.dupButtons));
  console.log(' tags covered by presence (>0%):', JSON.stringify(m.tags.filter(t => t.covered > 0)));
  return m;
}
(async () => {
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const ctx = await b.newContext({ ...VP[kind] });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 160)));
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 90000 });
    await page.waitForFunction(() => document.querySelector('#loading')?.hidden === true, null, { timeout: 60000 }).catch(() => console.log('loading never hid'));
    await page.evaluate(() => document.fonts.ready);
    await sleep(800);
    if (!(await page.locator('form[data-form="demo-entry"]').count())) await page.locator('button:visible', { hasText: '进入示例现场' }).first().click();
    await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 20000 });
    await page.locator('form[data-form="demo-entry"] input[name=consent]').check();
    await page.waitForSelector('form[data-form="demo-entry"] button[type=submit]:not([disabled])', { timeout: 60000 });
    await page.locator('form[data-form="demo-entry"] button[type=submit]').click();
    await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"]'), null, { timeout: 60000 });
    await page.waitForFunction(() => (window.__SPACE_EVENT_QA__?.()?.members || []).length > 1, null, { timeout: 30000 }).catch(() => console.log('members never arrived'));
    await sleep(2500);
    await measure(page, 'v11-step1');
    if (!walk) { await b.close(); return; }
    await page.click('[data-tour-action="sample:sample-crowd"]');
    await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
    try { await page.waitForSelector('form[data-form="upload"] .moment-chip.is-ai, form[data-form="upload"] .moment-ai-tag', { timeout: 40000 }); } catch { console.log('no AI answer in time'); }
    await sleep(600);
    const hasView = await page.evaluate(() => Boolean(document.querySelector('form[data-form="upload"] .moment-chip[aria-pressed="true"]')));
    if (!hasView) await page.click('form[data-form="upload"] .moment-chip[data-moment-viewpoint="crowd"]');
    await page.click('form[data-form="upload"] button[type="submit"]');
    await page.waitForSelector('.moment-wall, .panel .photo-grid', { timeout: 30000 });
    await sleep(2500);
    await page.keyboard.press('Escape').catch(() => {}); await sleep(300);
    await page.evaluate(() => { const c = document.querySelector('#panel-close'); if (c && !document.querySelector('#panel').hidden) c.click(); });
    await sleep(1500);
    await measure(page, 'v11-step3');
    await page.evaluate(() => document.querySelector('[data-tour-action="open:wall"]')?.click());
    await sleep(1800);
    await page.waitForSelector('[data-moment-badge] [data-exchange-offer]', { timeout: 20000 });
    await page.click('[data-moment-badge] [data-exchange-offer]');
    await page.waitForSelector('.photo-exchanges:not([hidden]) .exchange-pair', { timeout: 20000 });
    await page.check('.photo-exchanges [data-x-consent]');
    await page.waitForFunction(() => !document.querySelector('.photo-exchanges [data-x-send]')?.disabled, null, { timeout: 20000 });
    await page.click('.photo-exchanges [data-x-send]');
    await page.waitForFunction(() => /交换已接受/.test(document.querySelector('.photo-exchanges .exchange-status')?.textContent || ''), null, { timeout: 60000 });
    await sleep(1000);
    await page.click('.photo-exchanges [data-x-close]');
    await sleep(1800);
    await measure(page, 'v11-step4');
    // collapsed state for comparison
    await page.click('.demo-tour [data-tour-toggle]'); await sleep(900);
    await measure(page, 'v11-step4-collapsed');
    await page.click('.demo-tour [data-tour-toggle]'); await sleep(600);
  } catch (e) { console.error('ERR', e.message.split('\n')[0]); await page.screenshot({ path: `${OUT}/ERR-${kind}.png` }).catch(() => {}); }
  await b.close();
})();
