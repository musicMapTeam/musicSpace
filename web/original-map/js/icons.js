/**
 * Hand-drawn line icons for the Doodle look (first-party, drawn for Music Space 0.22: 24 px grid, round 2.2 px ink strokes, the
 * page's #ds-wobble filter adds the marker tremor in CSS). They keep the names of the Phosphor subset they replace, so callers did
 * not change; no Phosphor path data is left, so the builds no longer append the Phosphor notice (assets/licenses/phosphor-*
 * stay only as the record of the replaced icons).
 */
/** A hand-drawn ring: four quarter arcs, slightly uneven, that overshoot where they meet like a pen stroke. */
const ring = (cx, cy, r) => {
  const k = .552 * r; const n = value => Number(value.toFixed(2));
  const a = r * 1.02; const b = r * .98;
  return `M${n(cx - .4)} ${n(cy - r)}c${n(k)} ${n(-.1)} ${n(a)} ${n(r - k)} ${n(a)} ${n(r)}`
    + `c${n(.1)} ${n(k)} ${n(-(b - k))} ${n(b)} ${n(-b)} ${n(b)}`
    + `c${n(-k)} 0 ${n(-a)} ${n(-(a - k))} ${n(-a)} ${n(-a)}`
    + `c0 ${n(-k)} ${n(r - k + .3)} ${n(-r - .2)} ${n(r + .9)} ${n(-r + .2)}`;
};
const paths = {
  'arrow-right': 'M4.5 12.4c4.6-.3 9.6-.2 14.8-.5M13.6 6.6c1.9 2 3.7 3.6 5.6 5.3-1.8 1.7-3.6 3.5-5.4 5.6',
  'arrow-left': 'M19.5 12.2c-4.7.2-9.7.3-14.9.4M10.4 6.5C8.5 8.4 6.7 10.1 4.6 11.9c1.9 1.8 3.8 3.6 5.6 5.7',
  'arrow-up-right': 'M6.2 17.9c3.8-4 7.6-7.7 11.6-11.6M8.8 6.4c3 .1 6 0 9.1-.1.1 3 .1 6.1-.1 9.2',
  'plus': 'M12.2 4.6c-.3 5-.1 9.9-.4 14.9M4.7 12.3c5-.3 9.9-.1 14.7-.4',
  'x': 'M6.2 6.1c3.9 4.1 7.8 7.9 11.7 11.9M17.9 6.3c-4.1 3.9-7.8 7.8-11.8 11.7',
  'check': 'M4.8 12.9c2 1.3 3.6 3.2 5 5.4 2.5-5.1 5.6-9 9.4-12.3',
  'swap': 'M5 8.6c4.6-.2 9.3-.1 13.9-.3M15.6 5.1l3.4 3.3-3.3 3.1M19 15.7c-4.7.1-9.3.2-14 .2M8.3 12.4 5 15.8l3.4 3.2',
  'camera': 'M4.2 8.3c5.2-.3 10.4-.2 15.6-.2.3 3.6.2 7.3.1 10.9-5.2.2-10.4.2-15.6 0-.2-3.6-.2-7.1-.1-10.7ZM8.6 8.1l1.6-2.5c1.3-.1 2.6-.1 3.8 0l1.5 2.4' + ring(12, 13.2, 3.1),
  'image': 'M4.3 5.4c5.2-.2 10.3-.2 15.5 0 .2 4.4.2 8.8 0 13.2-5.2.2-10.3.2-15.5 0-.2-4.4-.2-8.8 0-13.2ZM4.6 16.1c2.3-2.3 4.2-4.1 6.1-5.6 1.9 1.6 3.6 3.5 5.3 5.4M14.3 13.6c1-1 1.8-1.8 2.7-2.4.9.8 1.8 1.7 2.6 2.6M15.6 8.4v.2',
  'heart': 'M12 19.6c-3.9-2.6-7.9-5.6-7.6-9.6.2-2.7 2.4-4.5 4.8-4.3 1.4.1 2.3.9 2.9 2.1.7-1.3 1.8-2 3.2-2.1 2.6-.1 4.6 1.9 4.4 4.6-.3 3.8-3.9 6.7-7.7 9.3Z',
  'bookmark': 'M6.6 4.2c3.6-.2 7.2-.1 10.8-.1.2 5.4.1 10.7.2 16.1-1.9-1.5-3.6-2.9-5.5-4.3-2 1.4-3.8 2.9-5.6 4.4-.1-5.4-.1-10.8.1-16.1Z',
  'compass': ring(12, 12, 8.1) + 'M15.3 8.7c-.9 2.6-1.8 4.6-3 6.2-1.8.4-3.9.6-6.4.6.9-2.6 1.9-4.6 3.1-6.2 1.8-.4 3.9-.6 6.3-.6Z',
  'record': ring(12, 12, 8.1) + ring(12, 12, 2.6) + 'M12 11.9v.2',
  'users': ring(9.2, 9, 3.2) + 'M3.6 18.8c.8-3.2 2.9-4.8 5.6-4.8 2.6 0 4.6 1.6 5.5 4.7M15.4 6c2 .2 3.2 1.7 3.1 3.4-.1 1.6-1.3 2.8-3 3M17 14.2c1.8.5 3 2 3.5 4.3',
  'trash': 'M5 7.2c4.7-.2 9.3-.1 14-.2M9.6 7V5.1c1.6-.2 3.2-.2 4.8 0V7M6.8 7.4c.4 4.2.6 8.3 1 12.5 2.8.2 5.6.2 8.4 0 .4-4.2.6-8.3 1-12.5M10.3 10.6l.3 6.3M13.7 10.6l-.3 6.3',
  'rotate': 'M5.3 12.4c.1-4 3.3-7.1 7.2-7 3.9.1 6.8 3.3 6.7 7.1-.1 3.9-3.2 6.8-7 6.8-2 0-3.8-.9-5-2.3M5.1 6.2l.1 4.6 4.6-.3',
  'info': ring(12, 12, 8.1) + 'M12.1 10.9c0 2.2-.1 4.1 0 6.1M12 7.6v.2',
  'chevron-right': 'M9.4 5.6c2.1 2.2 4.2 4.3 6.4 6.4-2.1 2.1-4.2 4.3-6.3 6.5',
  'magnifying-glass': ring(10.6, 10.5, 5.7) + 'M14.7 14.8c1.6 1.5 3.1 3 4.6 4.7',
};

/** Decorative SVG markup; the enclosing control supplies its accessible label. */
export function icon(name) {
  const d = paths[name];
  return d ? `<svg class="icon" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${d}"/></svg>` : '';
}
