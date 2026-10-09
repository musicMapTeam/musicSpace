// For the current screen: characters of each Doodle family that fall outside slice 0, and the elements they come from.
const L = require('./lib.cjs');
L.watchdog(200);
const kind = process.argv[2] || 'desktop';
const FIND = () => {
  const parse = r => r.split(',').map(s => s.trim().replace(/^U\+/i, '')).map(s => { const [a, b] = s.split('-'); return [parseInt(a, 16), parseInt(b || a, 16)]; });
  const faces = [...document.fonts].map(f => ({ family: f.family.replace(/"/g, ''), ranges: parse(f.unicodeRange) }));
  const slice = (fam, cp) => faces.filter(f => f.family === fam).findIndex(f => f.ranges.some(([a, b]) => cp >= a && cp <= b));
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = walker.nextNode());) {
    const text = n.textContent.trim(); if (!text) continue;
    const el = n.parentElement; if (!el.getClientRects().length) continue;
    let hidden = false; for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden') { hidden = true; break; } if (e.hidden) { hidden = true; break; } }
    if (hidden) continue;
    const fams = getComputedStyle(el).fontFamily.split(',').map(s => s.trim().replace(/"/g, '')).filter(f => f.startsWith('Doodle'));
    const fam = fams[0]; if (!fam) continue;
    const far = [...new Set([...text].filter(c => slice(fam, c.codePointAt(0)) > 0))];
    if (far.length) out.push(`${fam} ${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${String(el.className).slice(0, 30)} «${far.join('')}» in «${text.slice(0, 40)}»`);
  }
  return out;
};
(async () => {
  const browser = await L.launch();
  try {
    const run = await L.open(browser, kind); const { page } = run;
    await L.sleep(2500);
    console.log('== lobby\n' + (await page.evaluate(FIND)).join('\n'));
    await L.press(run, '#join');
    await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 30000 });
    await L.sleep(1500);
    console.log('== join\n' + (await page.evaluate(FIND)).join('\n'));
    for (const y of [400, 800, 1600]) { await page.evaluate(y => { document.querySelector('#panel').scrollTop = y; }, y); await L.sleep(400); console.log('== join scrolled ' + y + '\n' + (await page.evaluate(FIND)).join('\n')); }
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { await browser.close(); }
})();
