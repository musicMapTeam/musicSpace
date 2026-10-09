// Collects every user-facing string under a root: text nodes (visible or hidden), aria-label, title, placeholder, alt, aria-description.
const S = require('/tmp/space-copy/panels-inv/sheets.cjs');
const fs = require('fs');
const OUTDIR = '/tmp/space-copy/panels-inv/dumps';
fs.mkdirSync(OUTDIR, { recursive: true });
async function dump(page, label, selector = '#panel') {
  const data = await page.evaluate(selector => {
    const roots = [...document.querySelectorAll(selector)];
    const out = [];
    for (const r of roots) {
      const walker = document.createTreeWalker(r, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const t = n.data.replace(/\s+/g, ' ').trim();
        if (!t) continue;
        const el = n.parentElement;
        if (el.closest('svg') && !/[一-鿿]/.test(t)) continue;
        if (el.closest('style,script')) continue;
        const hidden = !el.getClientRects().length || el.closest('[hidden]') ? 'H' : '';
        out.push(`${hidden}\t${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''}\t${t}`);
      }
      for (const el of [r, ...r.querySelectorAll('*')]) {
        for (const a of ['aria-label', 'title', 'placeholder', 'alt', 'aria-description', 'data-confirm']) {
          const v = el.getAttribute(a);
          if (v && /[一-鿿A-Za-z]/.test(v)) out.push(`@${a}\t${el.tagName.toLowerCase()}\t${v}`);
        }
      }
    }
    return out;
  }, selector);
  const uniq = [...new Set(data)];
  fs.appendFileSync(`${OUTDIR}/${process.env.DUMP || 'dump'}.txt`, `\n===== ${label} [${selector}]\n` + uniq.join('\n') + '\n');
  console.log(`dumped ${label}: ${uniq.length} strings`);
}
async function toasts(page) {
  return page.evaluate(() => [...document.querySelectorAll('[role="status"],[role="alert"],.toast,#toast')].map(n => n.textContent.trim()).filter(Boolean));
}
module.exports = { ...S, dump, toasts };
