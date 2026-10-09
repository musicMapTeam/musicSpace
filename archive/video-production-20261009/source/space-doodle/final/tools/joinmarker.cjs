const L = require('./lib.cjs');
L.watchdog(200);
(async () => {
  const browser = await L.launch();
  try {
    const run = await L.open(browser, 'phone'); const { page } = run;
    await L.press(run, '#join');
    await page.waitForSelector('form[data-form="demo-entry"]', { timeout: 30000 });
    await L.sleep(1500);
    const r = await page.evaluate(() => {
      const parse = r => r.split(',').map(s => s.trim().replace(/^U\+/i, '')).map(s => { const [a, b] = s.split('-'); return [parseInt(a, 16), parseInt(b || a, 16)]; });
      const faces = [...document.fonts].map(f => ({ family: f.family.replace(/"/g, ''), ranges: parse(f.unicodeRange), status: f.status }));
      const slice = (fam, cp) => faces.filter(f => f.family === fam).findIndex(f => f.ranges.some(([a, b]) => cp >= a && cp <= b));
      const out = [];
      for (const el of document.querySelectorAll('body *')) {
        const fam = getComputedStyle(el).fontFamily.split(',')[0].trim().replace(/"/g, '');
        if (!fam.startsWith('Doodle')) continue;
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('') + (el.placeholder || '') + (el.value && typeof el.value === 'string' ? el.value : '') + getComputedStyle(el, '::before').content.replace(/^none$/, '') + getComputedStyle(el, '::after').content.replace(/^none$/, '');
        const far = [...new Set([...own].filter(c => slice(fam, c.codePointAt(0)) === 1))];
        if (far.length && el.getClientRects().length) out.push(`${fam} ${el.tagName}.${String(el.className).slice(0, 30)} vis=${!!el.getClientRects().length} «${far.join('')}» in «${own.trim().slice(0, 40)}»`);
      }
      return { out, loaded: faces.filter(f => f.status === 'loaded' || f.status === 'loading').map(f => f.family + ' ' + f.ranges.length) };
    });
    console.log(r.out.join('\n'));
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { await browser.close(); }
})();
