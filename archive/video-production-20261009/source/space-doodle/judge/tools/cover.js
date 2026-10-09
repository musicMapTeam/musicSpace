// Desktop room: which 3D hotspots / name tags does the presence card cover (expanded tour and collapsed)?
const L = require('./lib.js');
const vp = process.argv[2] || 'desktop';
(async () => {
  const browser = await L.launch();
  const run = await L.open(browser, vp, { label: `cover-${vp}` });
  const { page } = run;
  const say = (k, v) => console.log(k, '=>', typeof v === 'string' ? v : JSON.stringify(v));
  await L.boot(page, L.baseUrl('root'));
  await page.click('#join');
  await page.waitForFunction(() => !document.querySelector('form[data-form="demo-entry"] button[type="submit"]')?.disabled, null, { timeout: 60000 });
  await page.check('form[data-form="demo-entry"] input[name="consent"]');
  await page.click('form[data-form="demo-entry"] button[type="submit"]');
  await page.waitForFunction(() => document.querySelector('.frame')?.dataset.stage === 'room', null, { timeout: 30000 });
  await L.sleep(5000);
  const measure = () => page.evaluate(() => {
    const card = document.querySelector('.presence').getBoundingClientRect();
    const out = { card: [Math.round(card.left), Math.round(card.top), Math.round(card.right), Math.round(card.bottom)], hotspots: [] };
    for (const h of document.querySelectorAll('#hotspots .hotspot, #hotspots button')) {
      const r = h.getBoundingClientRect(); if (!r.width) continue;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const top = document.elementFromPoint(cx, cy);
      const overlap = Math.max(0, Math.min(r.right, card.right) - Math.max(r.left, card.left)) * Math.max(0, Math.min(r.bottom, card.bottom) - Math.max(r.top, card.top));
      out.hotspots.push({ label: h.textContent.trim().slice(0, 20), kind: h.dataset.kind, rect: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)], coveredPct: Math.round(100 * overlap / (r.width * r.height)), centerHit: top ? (h.contains(top) ? 'self' : `${top.tagName.toLowerCase()}.${String(top.className).split(' ')[0]}`) : null });
    }
    return out;
  });
  say('expanded', await measure());
  await page.click('[data-tour-toggle]');
  await L.sleep(1200);
  say('collapsed', await measure());
  await L.shot(run, 'collapsed');
  await browser.close();
})();
