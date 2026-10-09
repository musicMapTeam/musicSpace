import { normalizeIllustratedLook, ILLUSTRATED_VIEWS, ILLUSTRATED_SIZE } from './inventory.js';
import { renderIllustratedLayers } from './layers.js';
export * from './inventory.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const dimension = (value, fallback) => Number.isFinite(Number(value)) && Number(value) > 0 ? Math.min(4096, Math.round(Number(value))) : fallback;

/** Self-contained, transparent SVG suitable for DOM previews and THREE.CanvasTexture. */
export function renderAvatarSvg(avatar, options = {}) {
  const a = normalizeIllustratedLook(avatar);
  const view = ILLUSTRATED_VIEWS.includes(options.view) ? options.view : 'quarter';
  const label = escape(options.label || 'Music Space 的插画分身');
  const { width, height } = ILLUSTRATED_SIZE;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${dimension(options.width,width)}" height="${dimension(options.height,height)}" role="img" aria-label="${label}" data-illustrated-avatar="1" data-view="${view}"><title>${label}</title>${options.shadow ? '<ellipse cx="117" cy="477" rx="67" ry="7" fill="#292c33" opacity=".17"/>' : ''}${renderIllustratedLayers(a,view)}</svg>`;
}

export function avatarSvgDataUrl(avatar, options = {}) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderAvatarSvg(avatar,options))}`;
}
