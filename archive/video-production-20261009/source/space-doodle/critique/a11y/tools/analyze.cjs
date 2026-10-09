// Aggregate scan JSON (data/<vp>/*.json) into findings per check; prints a report and writes data/summary.json
// usage: node analyze.cjs [filter-substring-on-label]
const fs = require('fs');
const path = require('path');
const ROOT = '/tmp/space-doodle/critique/a11y';
const filt = process.argv[2] || '';
const VPS = ['w320', 'w390', 'w768', 'w1440'];
const rows = [];
for (const vp of VPS) {
  const dir = path.join(ROOT, 'data', process.env.RUN || 'r1', vp);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
    if (filt && !f.includes(filt)) continue;
    try { rows.push(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))); } catch {}
  }
}
const groups = { cut: new Map(), overflow: new Map(), clip: new Map(), ellipsis: new Map(), beyond: new Map(), page: new Map(), hscroll: new Map(), target: new Map(), contrast: new Map(), font: new Map(), deco: new Map(), occl: new Map() };
const add = (g, key, rec) => { if (!groups[g].has(key)) groups[g].set(key, []); groups[g].get(key).push(rec); };
const where = d => `${d.vp}:${d.label}${d.step ? '#' + d.step : ''}`;
for (const d of rows) {
  if (d.overflow.page) add('page', 'document', { at: where(d), v: `${d.overflow.page.scrollWidth}>${d.overflow.page.vw}` });
  for (const b of d.overflow.beyond) if (!b.inScroller && !b.deco) add('beyond', b.sel, { at: where(d), v: `${b.l}..${b.r} w${b.w} ${b.pos} «${b.text}»` });
  for (const h of d.overflow.hscroll) add('hscroll', h.sel, { at: where(d), v: `${h.scrollW}>${h.clientW} «${h.text}»` });
  for (const c of d.overflow.cut || []) add('cut', c.sel, { at: where(d), v: `rect ${c.rect.join(',')} cut t${c.cutTop} b${c.cutBottom} l${c.cutLeft} r${c.cutRight} by ${c.by}${c.scroller ? ' (scroller)' : ''}` });
  for (const t of d.text) {
    const key = `${t.sel} «${t.text.slice(0, 24)}»`;
    if (t.clipped && t.clipped.length && t.visibleFrac > 0) add('clip', key, { at: where(d), v: t.clipped.map(c => `${c.axis} by ${c.by} text[${c.text.l},${c.text.r}]x[${c.text.t},${c.text.b}] box[${c.box.l},${c.box.r}]x[${c.box.t},${c.box.b}]`).join('; ') });
    if (t.ellipsis && t.visibleFrac > 0) add('ellipsis', key, { at: where(d), v: `ellipsis ws=${t.ws}` });
    if (t.lineClamp && t.visibleFrac > 0) add('ellipsis', key, { at: where(d), v: `line-clamp ${t.lineClamp}` });
    if (t.offX && t.visibleFrac > 0) add('beyond', key, { at: where(d), v: `text beyond viewport rects=${JSON.stringify(t.rects.slice(0, 2))}` });
    if (t.decoOver && t.decoOver.length) add('deco', key, { at: where(d), v: t.decoOver.join(' | ') });
    const famLow = ['Doodle Hand', 'Doodle Note', 'Doodle Display'].includes(t.family);
    if (famLow && t.effSize < 13 && t.visibleFrac > 0) add('font', key, { at: where(d), v: `${t.family} ${t.fontSize}px eff ${t.effSize}px` });
    if (t.px && t.visibleFrac >= 0.5 && !t.disabled) {
      const need = t.effSize >= 24 ? 3 : 4.5;
      const val = t.px.p10;
      if (val < need) add('contrast', key, { at: where(d), v: `p10 ${val} p50 ${t.px.p50} need ${need} size ${t.effSize} text ${t.px.textHex}${t.alpha < 0.99 ? ' a' + t.alpha.toFixed(2) : ''} bg~${t.px.bgMedian} worst ${t.px.bgWorst}${t.stroke ? ' stroke' : ''}${t.shadow ? ' shadow' : ''}${t.decorative ? ' DECORATIVE' : ''}${t.placeholder ? ' PLACEHOLDER' : ''} fam ${t.family}` });
    }
  }
  for (const p of d.pseudo || []) if (['Doodle Hand', 'Doodle Note', 'Doodle Display'].includes(p.family) && p.fontSize < 13) add('font', `${p.sel} «${p.text}»`, { at: where(d), v: `pseudo ${p.family} ${p.fontSize}px` });
  for (const t of d.targets) {
    const effW = t.centreHit && !t.cut ? Math.max(t.hitW, Math.min(t.labelW, 81)) : t.labelW;
    const effH = t.centreHit && !t.cut ? Math.max(t.hitH, Math.min(t.labelH, 81)) : t.labelH;
    if (!t.centreHit && t.covering && t.covering !== 'outside') add('occl', `${t.sel} «${t.text.slice(0, 20)}»`, { at: where(d), v: `covered by ${t.covering} rect ${t.w}x${t.h} @${t.x},${t.y}` });
    if (effW < 44 || effH < 44) add('target', `${t.sel} «${t.text.slice(0, 20)}»`, { at: where(d), v: `${t.w}x${t.h} hit ${t.hitW}x${t.hitH}${t.labelW !== t.w || t.labelH !== t.h ? ` label ${t.labelW}x${t.labelH}` : ''}${t.inline ? ' inline' : ''}${t.cut ? ' (edge)' : ''}` });
  }
}
const out = {};
for (const [g, m] of Object.entries(groups)) {
  out[g] = [...m.entries()].map(([k, list]) => ({ key: k, n: list.length, vps: [...new Set(list.map(r => r.at.split(':')[0]))].join(','), list })).sort((a, b) => b.n - a.n);
}
fs.writeFileSync(path.join(ROOT, 'data', process.env.RUN || 'r1', `summary${filt ? '-' + filt : ''}.json`), JSON.stringify(out, null, 1));
const show = process.env.SHOW ? process.env.SHOW.split(',') : Object.keys(out);
for (const g of show) {
  if (!out[g] || !out[g].length) continue;
  console.log(`\n===== ${g} (${out[g].length})`);
  for (const e of out[g].slice(0, +(process.env.LIMIT || 60))) {
    console.log(`- ${e.key}  [${e.vps}] x${e.n}`);
    for (const r of e.list.slice(0, +(process.env.PER || 3))) console.log(`     ${r.at}: ${r.v}`);
  }
}
console.log(`\nrows ${rows.length}`);
