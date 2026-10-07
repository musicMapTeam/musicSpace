import { createDoodlePass, patchDoodleCel, doodleWanted } from '../../avatar/doodle-pass.js';
import { DOODLE_COLORS, DOODLE_KRAFT } from '../../event-room/venue-art.js';

/* The courtyard and record shop in the hand-drawn Doodle look (docs/design/doodle.md §6): the event
 * room's render pass (web/avatar/doodle-pass.js) reused unchanged, plus the map's paper palette.
 *
 *   paper + doodle   the page carries the Doodle tokens: paper palette, ink-and-hatching pass
 *   paper + classic  the same paper set through the vendored Sakura cel pipeline: ?doodle=0, a
 *                    browser without the pass's WebGL2 features, or a pass shader that fails
 *   night            no tokens on the page: the original night venue, unchanged
 *
 * Colours come from tokens.css (DOODLE_COLORS) and the room's kraft board only. */

export const D = DOODLE_COLORS;
export const KRAFT = DOODLE_KRAFT;

/** 'paper' when the page carries the Doodle tokens (--ds-paper on :root, the same signal the event
 *  room's renderer reads) or html[data-look="doodle"]; otherwise 'night'. Decided once per mount. */
export function pageLook(doc = globalThis.document) {
  try {
    const root = doc?.documentElement;
    if (!root) return 'night';
    if (root.dataset?.look === 'doodle') return 'paper';
    const styles = (doc.defaultView || globalThis).getComputedStyle?.(root);
    return styles?.getPropertyValue('--ds-paper').trim() ? 'paper' : 'night';
  } catch { return 'night'; }
}

/** ?doodle=0 (off, false, classic) keeps the classic renderer. The map reads the address only and
 *  writes no storage: the room's tab memory of that choice stays the room's. */
export const doodleRequested = (search = globalThis.location?.search ?? '') => doodleWanted(search, null);

/** Roles of the shared cel palette (sakura-scene.js), on paper. */
export const PAPER_TOON = Object.freeze({
  cream: D.card, plaster: D.paper, sand: D.paperDeep, green: D.mint, leaf: D.mint, mint: D.mintSoft,
  rose: D.pinkSoft, blush: D.pinkSoft, petal: D.pink, coral: D.pink, wood: KRAFT, ink: D.ink,
  glass: D.sky, black: D.ink, gold: D.yellow, road: D.ink3,
  // The paved yard is a yellow card; the shop's roof is drawn in ink, like the room's stage.
  yard: D.yellowSoft, roof: D.ink2,
});

/** Roles of the courtyard's own parts (sakura-world.js), on paper. */
export const PAPER_SET = Object.freeze({
  strings: D.card, eyes: D.ink, bulb: D.yellow, label: D.card, window: D.yellow, wood: KRAFT,
  meadow: Object.freeze([D.mint, D.mintSoft]), blossom: Object.freeze([D.pinkSoft, D.pinkSoft, D.pink]),
  fallenPetal: D.pink, driftingPetal: D.pink, board: KRAFT,
});

/** Roles of the record table (sakura-music.js), on paper. */
export const PAPER_TABLE = Object.freeze({
  wood: KRAFT, skirt: D.ink2, sheet: D.card, brass: D.yellow, card: D.card, back: D.paperDeep,
  vinyl: D.ink, groove: D.ink3, label: D.yellow, selected: D.mint, target: D.pink, path: D.orange,
  edges: Object.freeze({ quiet: D.ink3, active: D.ink, visited: D.orange, highlighted: D.pink, style: D.sky, answer: D.sky, stub: D.ink }),
  // CSS --record-tone for a face-down record and for an artist without a colour.
  unknownTone: D.paperDeep, fallbackTone: D.ink3,
});

/** One white key light decides the two bands. Each camera stop gets the direction that keeps its
 *  subject in the lit band: overhead for the record table, from the camera side for the cabinet. */
export const KEY_LIGHT = Object.freeze({ home: [7.5, 12, 2], explore: [1.2, 12, 2.5], records: [-4, 8, 9] });
export const keyLightFor = key => KEY_LIGHT[key] || KEY_LIGHT.home;
/** Ink width in CSS px: the pass's 2.5, thinner where the phone shows the whole yard small. */
export const lineWidthFor = (key, width) => (width <= 760 && key === 'home' ? 1.8 : 2.5);
/** The classic fallback's shade band on paper: warm paper instead of the night's violet. */
export const PAPER_SHADE = D.paperDeep;

/**
 * Wraps the vendored createCelMaterials(): while state.active, every toon material it hands out
 * compiles as a doodle cel program (flat paper colour plus a lit/shade code for the pass);
 * otherwise as the vendor's tinted ramp. The vendor file stays untouched.
 */
export function mapCelMaterials(vendor, state, { paper = false } = {}) {
  const wrapped = new Set();
  function wrap(material) {
    if (!material?.isMeshToonMaterial || wrapped.has(material)) return material;
    wrapped.add(material);
    const tint = material.onBeforeCompile; const key = material.customProgramCacheKey;
    material.onBeforeCompile = (shader, renderer) => {
      if (state.active && patchDoodleCel(shader, { ...state.uniforms, terminator: material.userData.doodleTerminator || state.uniforms.terminator })) return;
      tint.call(material, shader, renderer);
    };
    material.customProgramCacheKey = () => (state.active ? 'map-doodle-cel' : key.call(material));
    if (paper) material.userData.shadowTint?.value.set(PAPER_SHADE);
    return material;
  }
  return {
    cel: options => wrap(vendor.cel(options)),
    flat: options => vendor.flat(options),
    /** After the pass is dropped: every wrapped material compiles again as the vendor's. */
    recompile() { wrapped.forEach(material => { material.needsUpdate = true; }); },
    dispose() { wrapped.clear(); vendor.dispose(); },
  };
}

/** Scene-image pixels per frame. The courtyard redraws at 30 fps while it is on screen (petals, the
 *  spinning record), so it keeps closer to the night renderer's 2 MP than the event room's 5.3 MP: phones
 *  keep their full 2x image; a 2x laptop draws about 1.6x instead of 2x. */
export const PIXEL_BUDGET = 3.2e6;

/** The event room's pass for this scene, or null (no WebGL2 feature set, or it threw). */
export function createMapDoodle(renderer, scene, getCamera, options = {}) {
  try { return createDoodlePass(renderer, scene, getCamera, { ink: D.ink, paper: D.paper, pixelBudget: PIXEL_BUDGET, ...options }); }
  catch (error) { console.warn('Music Space: the doodle renderer is unavailable here; drawing the courtyard with the classic renderer.', error); return null; }
}
