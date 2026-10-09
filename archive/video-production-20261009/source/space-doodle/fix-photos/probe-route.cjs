// Walk the judge route once and measure the five photos findings: upload sheet scroll, wall fold, presence behind the exchange sheet,
// recap venue size, taken-note line. usage: node probe-route.cjs <phone|desktop|narrow|...> [own] [label]
const L = require('./lib.cjs');
L.watchdog(270);
const kind = process.argv[2] || 'phone';
const own = process.argv[3] === 'own';
const label = process.argv[4] || 'probe';
(async () => {
  const browser = await L.launch();
  try {
    const run = await L.open(browser, kind);
    const { page } = run;
    await L.enter(run);
    await L.press(run, '[data-tour-action="sample:sample-crowd"]');
    await page.waitForSelector('form[data-form="upload"] .photo-review', { timeout: 30000 });
    if (own) {
      await page.setInputFiles('form[data-form="upload"] input[type="file"]', '/tmp/space-video-prep/photos/pack/demo-unsure-2150.jpg');
      await page.waitForFunction(() => !document.querySelector('[data-sample-flag]') && /21:50/.test(document.querySelector('[data-taken-line]')?.textContent || ''), null, { timeout: 30000 }).catch(() => console.log('own photo time not shown'));
    }
    for (const t of [80, 600, 2000]) { await L.sleep(t === 80 ? 80 : t - (t === 600 ? 80 : 600)); console.log(kind, 'upload', `t${t}`, JSON.stringify(await L.uploadState(page))); }
    const settled = await L.aiSettled(page);
    await L.sleep(800);
    console.log(kind, 'upload', 'ai-settled', settled, JSON.stringify(await L.uploadState(page)));
    await L.shot(page, `${L.OUT}/${label}-upload-${own ? 'own-' : ''}${kind}.png`);
    const note = await page.evaluate(() => { const n = document.querySelector('form.moment-upload [data-taken-note]'); if (!n) return null; const rects = [...n.getClientRects()].map(r => [Math.round(r.left), Math.round(r.top), Math.round(r.width)]); const cs = getComputedStyle(n); return { text: n.textContent, display: cs.display, rects, line: document.querySelector('[data-taken-line]').getBoundingClientRect().width | 0 }; });
    console.log(kind, 'taken-note', JSON.stringify(note));
    if (process.env.STOP === 'upload') return;
    const chosen = await page.evaluate(() => Boolean(document.querySelector('form[data-form="upload"] .moment-chip[aria-pressed="true"]')));
    if (!chosen) await L.press(run, 'form[data-form="upload"] .moment-chip[data-moment-viewpoint="crowd"]');
    await L.press(run, 'form[data-form="upload"] button[type="submit"]');
    await page.locator('#panel [data-moment-badge] [data-exchange-offer]').first().waitFor({ state: 'attached', timeout: 45000 }).catch(() => console.log('no badge'));
    await page.waitForFunction(() => [...document.querySelectorAll('#panel .moment-card img')].every(i => i.complete && i.naturalWidth), null, { timeout: 30000 }).catch(() => {});
    await L.sleep(2000);
    console.log(kind, 'wall', JSON.stringify(await L.wallState(page)));
    await L.shot(page, `${L.OUT}/${label}-wall-${own ? 'own-' : ''}${kind}.png`);
    if (process.env.STOP === 'wall') return;
    await L.press(run, '#panel [data-moment-badge] [data-exchange-offer]');
    await page.waitForSelector('.photo-exchanges:not([hidden]) .exchange-pair', { timeout: 20000 });
    await L.sleep(1200);
    const x = await page.evaluate(() => { const R = e => { if (!e) return null; const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom].map(Math.round); }; const p = document.querySelector('.presence'), s = document.querySelector('.photo-exchanges'); return { presence: R(p), presenceVis: getComputedStyle(p).visibility, sheet: R(s), sheetParent: s.parentElement.className, panelHidden: document.querySelector('#panel').hidden }; });
    console.log(kind, 'xsheet', JSON.stringify(x));
    await L.shot(page, `${L.OUT}/${label}-xsheet-${kind}.png`);
    if (process.env.STOP === 'xsheet') return;
    await page.evaluate(() => document.querySelector('.photo-exchanges [data-x-close]')?.click());
    await L.sleep(400);
    await page.evaluate(() => { const b = document.querySelector('#room-recap'); if (b && !b.hidden) b.click(); else { const o = document.createElement('button'); o.dataset.open = 'recap'; o.style.position = 'fixed'; o.style.left = '-9999px'; document.body.append(o); o.click(); o.remove(); } });
    await page.waitForSelector('.panel[data-kind="recap"] .recap-venue', { timeout: 20000 });
    await L.sleep(1200);
    const v = await page.evaluate(() => { const n = document.querySelector('.panel[data-kind="recap"] .recap-venue'); const cs = getComputedStyle(n); return { text: n.textContent, size: cs.fontSize, family: cs.fontFamily, margin: cs.marginTop, lineHeight: cs.lineHeight, rect: n.getBoundingClientRect().height | 0 }; });
    console.log(kind, 'recap-venue', JSON.stringify(v));
    await L.shot(page, `${L.OUT}/${label}-recap-${kind}.png`);
  } catch (e) {
    console.log('FAILED', e.message.split('\n')[0]);
  } finally { await browser.close(); }
})();
