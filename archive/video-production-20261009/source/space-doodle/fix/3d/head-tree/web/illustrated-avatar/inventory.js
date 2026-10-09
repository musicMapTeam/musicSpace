import { DEFAULT_AVATAR, safeAvatar, COMPONENTS, TEMPLATES, SKINS, HAIRS, GARMENT_COLORS } from '../avatar/model.js';

export const ILLUSTRATED_VIEWS = Object.freeze(['front', 'quarter', 'side', 'back']);
export const ILLUSTRATED_SIZE = Object.freeze({ width: 240, height: 500, feetY: 477 });
export const ILLUSTRATED_PALETTE = Object.freeze({ ink: '#342d2c', paper: '#f3e7cf', warm: '#bc7655', shadow: '#262b35' });
export const ILLUSTRATED_INVENTORY = Object.freeze(Object.fromEntries(
  ['hair', 'eyewear', 'top', 'bottom', 'shoes', 'accessory'].map(key => [key, Object.freeze(COMPONENTS[key].map((entry, index) => Object.freeze({
    value: key === 'accessory' ? entry[0] : index,
    label: key === 'accessory' ? entry[1] : entry[0],
    english: key === 'accessory' ? entry[2] : entry[1],
  })))])
));
export const ILLUSTRATED_PRESETS = TEMPLATES;
export const ILLUSTRATED_COLORS = Object.freeze({ skin: SKINS, hairColor: HAIRS, topColor: GARMENT_COLORS, bottomColor: GARMENT_COLORS, shoeColor: GARMENT_COLORS });

/** An adapter, not a new persisted schema. Missing input uses the existing default identity. */
export function normalizeIllustratedLook(input) {
  return safeAvatar(input && typeof input === 'object' ? input : DEFAULT_AVATAR);
}
export function illustratedLookKey(input, view = 'quarter') {
  const look = normalizeIllustratedLook(input);
  return `${ILLUSTRATED_VIEWS.includes(view) ? view : 'quarter'}:${JSON.stringify(look)}`;
}
