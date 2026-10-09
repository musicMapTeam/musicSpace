// Die-cut element stills with a real alpha channel, taken from the product's own rendering.
// Technique (capture-only, removed right after the shot; the product state is not changed):
//   1. a temporary <style> hides every box except the target subtree (visibility, so layout does not move) and clears the page
//      backgrounds; Playwright's omitBackground makes the browser's default background transparent;
//   2. the shot is clipped to the element box grown by `pad` CSS px (the doodle hard shadows sit outside the border box);
//   3. an opaque twin (same clip, page untouched) is taken first, so the alpha cut can be verified against it.
// The checker (tools/alpha_check.py) composites the cut over the twin and reports the max difference inside the element.
import fs from 'node:fs';
import path from 'node:path';

const HIDE_ID = '__cut_style';
/** CSS that keeps only `sels` (and their descendants) visible.  :not() with complex selectors needs Chrome >= 88. */
function hideCss(sels) {
  const keep = sels.map(s => `:not(${s}):not(${s} *)`).join('');
  return `html,body{background:transparent!important;background-image:none!important}
body{visibility:hidden!important}
body *${keep}{visibility:hidden!important}
${sels.join(',')}{visibility:visible!important}
${sels.map(s => `${s}{transition:none!important}`).join('\n')}`;
}

/** union bounding box (CSS px) of the selectors, grown by pad = {l,t,r,b} or a number */
export async function unionBox(page, sels, pad = 14) {
  const p = typeof pad === 'number' ? { l: pad, t: pad, r: pad, b: pad } : pad;
  const b = await page.evaluate(sels => {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, n = 0;
    for (const s of sels) for (const e of document.querySelectorAll(s)) {
      const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue; n++;
      x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
    }
    return n ? { x0, y0, x1, y1, n } : null;
  }, sels);
  if (!b) return null;
  const vw = page.viewportSize();
  const x = Math.max(0, b.x0 - p.l), y = Math.max(0, b.y0 - p.t);
  return { x, y, width: Math.min(vw.width, b.x1 + p.r) - x, height: Math.min(vw.height, b.y1 + p.b) - y, n: b.n };
}

/** Opaque region still (what the screen shows) + alpha die-cut of the same region.  Returns file paths and the clip. */
export async function cutout(page, sels, outBase, { pad = 14, opaque = true, scrollIntoView = true } = {}) {
  sels = [].concat(sels);
  fs.mkdirSync(path.dirname(outBase), { recursive: true });
  if (scrollIntoView) await page.locator(sels[0]).first().evaluate(e => e.scrollIntoView({ block: 'center' })).catch(() => {});
  await page.waitForTimeout(250);
  const clip = await unionBox(page, sels, pad);
  if (!clip) throw new Error('cutout: nothing visible for ' + sels.join(' | '));
  const res = { clip, sels };
  if (opaque) { res.opaque = outBase + '.opaque.png'; await page.screenshot({ path: res.opaque, clip, caret: 'hide' }); }
  await page.evaluate(([id, css]) => { const st = document.createElement('style'); st.id = id; st.textContent = css; document.head.appendChild(st); }, [HIDE_ID, hideCss(sels)]);
  try {
    await page.waitForTimeout(120);
    res.alpha = outBase + '.png';
    await page.screenshot({ path: res.alpha, clip, omitBackground: true, caret: 'hide' });
  } finally {
    await page.evaluate(id => document.getElementById(id)?.remove(), HIDE_ID);
  }
  return res;
}

/** full-viewport still at device resolution */
export async function fullStill(page, file) { fs.mkdirSync(path.dirname(file), { recursive: true }); await page.screenshot({ path: file, caret: 'hide' }); return file; }
