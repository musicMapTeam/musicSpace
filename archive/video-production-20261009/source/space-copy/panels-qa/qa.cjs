// QA helpers for the panels copy pass (read-only on the repo).
const S = require('/tmp/space-copy/panels-inv/dump.cjs');
const OUT = '/tmp/space-copy/panels-qa/shots';
/** Layout audit of a root: horizontal overflow, elements sticking out, buttons/labels whose text wraps to 3+ lines, and the visible text. */
async function audit(page, root) {
  return page.evaluate(root => {
    const r = document.querySelector(root);
    if (!r || !r.getClientRects().length) return { missing: root };
    const rb = r.getBoundingClientRect();
    const out = [], tall = [], tiny = [];
    for (const el of r.querySelectorAll('*')) {
      if (!el.getClientRects().length || el.closest('svg')) continue;
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden') continue;
      const b = el.getBoundingClientRect();
      if (b.width && (b.right > rb.right + 1.5 || b.left < rb.left - 1.5) && !el.closest('.conversation-actions')) out.push(`${el.tagName.toLowerCase()}.${(el.getAttribute('class')||'').split(' ')[0]}「${(el.textContent||'').trim().slice(0,16)}」 ${Math.round(b.left)}-${Math.round(b.right)} vs ${Math.round(rb.left)}-${Math.round(rb.right)}`);
      if (/^(BUTTON|SUMMARY|LABEL|SMALL|B|LEGEND|H2|H3)$/.test(el.tagName) && el.textContent.trim()) {
        const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4;
        const range = document.createRange(); range.selectNodeContents(el);
        const tops = new Set([...range.getClientRects()].filter(x => x.width > 0).map(x => Math.round(x.top)));
        if (tops.size >= 3 && el.tagName !== 'LABEL') tall.push(`${el.tagName.toLowerCase()}「${el.textContent.trim().slice(0,24)}」 ${tops.size} lines`);
      }
      if (el.tagName === 'BUTTON' && b.height > 0 && b.height < 43 && !el.disabled) tiny.push(`button「${el.textContent.trim().slice(0,14)}」 h=${Math.round(b.height)}`);
    }
    return { overflowX: r.scrollWidth > r.clientWidth + 1, sw: r.scrollWidth, cw: r.clientWidth, out: out.slice(0, 12), tall: tall.slice(0, 20), tiny: tiny.slice(0, 12) };
  }, root);
}
async function snap(page, name, kind) { const file = `${OUT}/${kind}-${name}.png`; await S.sleep(350); await page.screenshot({ path: file }); return file; }
/** Screenshot a scrolling sheet in pages: the scroller is scrolled by its client height until the end. */
async function snapScroll(page, name, kind, scroller, max = 6) {
  const files = [];
  const total = await page.evaluate(sel => { const s = document.querySelector(sel); if (!s) return 0; s.scrollTop = 0; return Math.ceil(s.scrollHeight / Math.max(1, s.clientHeight - 60)); }, scroller);
  for (let i = 0; i < Math.min(max, Math.max(1, total)); i++) {
    await page.evaluate(([sel, i]) => { const s = document.querySelector(sel); if (s) s.scrollTop = i * Math.max(1, s.clientHeight - 60); }, [scroller, i]);
    files.push(await snap(page, `${name}-${i}`, kind));
  }
  await page.evaluate(sel => { const s = document.querySelector(sel); if (s) s.scrollTop = 0; }, scroller);
  return files;
}
const text = (page, sel) => page.evaluate(sel => (document.querySelector(sel)?.innerText || '').replace(/\n+/g, ' | ').slice(0, 1600), sel);
module.exports = { ...S, OUT, audit, snap, snapScroll, text };
