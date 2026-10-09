import { launch, Session, sleep } from '../rec.mjs';
export const BASE = process.env.SPACE_BASE || 'http://127.0.0.1:47961/musicSpace/';
export const OUT = '/tmp/space-video-prep/stills/planA';
export const PHOTOS = { stage: '/tmp/space-video-prep/photos/pack/demo-stage-2147.jpg', crowd: '/tmp/space-video-prep/photos/pack/demo-crowd-2148.jpg', unsure: '/tmp/space-video-prep/photos/pack/demo-unsure-2150.jpg' };
export async function dump(p, label, { shot = true } = {}) {
  if (shot) await p.screenshot({ path: `${OUT}/${label}.png` });
  const items = await p.evaluate(() => [...document.querySelectorAll('button, a[href], [role=button], input, select, textarea, summary')]
    .filter(e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; })
    .map(e => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${e.name ? '[name=' + e.name + ']' : ''}${e.type ? '(' + e.type + ')' : ''}${e.dataset && Object.keys(e.dataset).length ? '[' + Object.entries(e.dataset).map(([k, v]) => `data-${k}=${v}`).join(',') + ']' : ''} "${(e.innerText || e.value || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 50)}"`));
  console.log(`--- ${label}\n` + items.join('\n'));
}
export { launch, Session, sleep };
