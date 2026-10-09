import * as THREE from 'three';
import { createDoodlePass, patchDoodleCel, doodleWanted } from '../../avatar/doodle-pass.js';
import { DOODLE_COLORS, DOODLE_KRAFT } from '../../event-room/venue-art.js';

/* PROTOTYPE (throw-away, /tmp/space-map/proto): the courtyard and record shop drawn with
 * the event room's Doodle pass (web/avatar/doodle-pass.js), unchanged. Everything here is
 * map-side glue: which colours the procedural set takes, and how the vendored Sakura cel
 * materials are switched to doodle cel programs while the pass is on. */

export const D = DOODLE_COLORS;
export const KRAFT = DOODLE_KRAFT;

/** ?doodle=0 (off/false/classic) keeps the night renderer; the map honours the address only
 *  (no session key of its own; the room's key stays the room's). */
export const doodleRequested = () => doodleWanted(globalThis.location?.search || '', null);

/** Night value -> Doodle token. One table is the whole palette swap for the procedural set;
 *  values that are not listed keep their night colour (none should remain, see unmapped()). */
const SWAP = {
  // sakura-scene palette
  '#f2e7d3': D.card, '#faf6ef': D.paper, '#e3ddd8': D.paperDeep, '#42696a': D.mint, '#6b9694': D.mint,
  '#b0c5ab': D.mintSoft, '#fbc6d8': D.pinkSoft, '#fedde2': D.pinkSoft, '#fff0f4': D.pink, '#d28091': D.pink,
  '#ac8480': KRAFT, '#39324f': D.ink, '#94baca': D.sky, '#3c394c': D.ink, '#e8c576': D.yellow, '#a4a2b8': D.ink3,
  // sakura-world
  '#eee2bf': D.card, '#3e514c': D.ink, '#ffe3a6': D.yellow, '#f9f0df': D.card, '#f7d59a': D.yellow, '#b49179': KRAFT,
  '#938da6': KRAFT, '#aabd9d': D.mint, '#c1cdb0': D.mintSoft, '#8e6f93': D.pink, '#e7b4c8': D.pink,
  '#3d4166': D.paper, '#2c3052': D.ink2, '#ffc978': D.yellow, '#2a2f52': D.ink2, '#4b4f75': D.ink2, '#353a5f': D.ink2, '#6a4a66': D.pink,
  '#2f2b55': D.paperDeep, '#27264b': D.paperDeep,
  // sakura-music (record table)
  '#b4967b': KRAFT, '#688278': D.ink2, '#ecebe4': D.card, '#c8a774': D.yellow, '#eeeee5': D.card, '#e2d7c0': D.paperDeep,
  '#39484b': D.ink, '#70877c': D.ink3, '#3f6d5f': D.mint, '#c0606f': D.pink, '#b98642': D.orange,
  '#8d8f7d': D.ink3, '#2f5e4e': D.ink, '#a57f5a': D.orange, '#b0525f': D.pink, '#95768f': D.sky, '#3a4a63': D.sky, '#3f3b33': D.ink,
};
export const swap = hex => SWAP[String(hex).toLowerCase()] || hex;

/** Wraps a vendored createCelMaterials() result: every toon material it hands out compiles as a
 *  doodle cel program while state.active (flat paper colour + lit/shade code); otherwise the
 *  vendor's own tinted ramp. The vendor file stays untouched. */
export function doodleCelMaterials(cel, state) {
  const wrapped = new WeakSet();
  function wrap(material) {
    if (!material?.isMeshToonMaterial || wrapped.has(material)) return material;
    wrapped.add(material);
    const tint = material.onBeforeCompile; const key = material.customProgramCacheKey;
    material.onBeforeCompile = (shader, renderer) => {
      if (state.active && patchDoodleCel(shader, { ...state.uniforms, terminator: material.userData.doodleTerminator || state.uniforms.terminator })) return;
      tint.call(material, shader, renderer);
    };
    material.customProgramCacheKey = () => (state.active ? 'map-doodle-cel' : key.call(material));
    if (state.paper) {
      material.color.set(swap('#' + material.color.getHexString()));
      // Lamp-lit night colours (self-lit blossom, glowing windows) are flat marker paper here.
      material.emissive?.set(0x000000);
      // Classic fallback on paper: a warm grey shade band instead of the night's violet.
      material.userData.shadowTint?.value.set('#d9cfbd');
    }
    return material;
  }
  return { ...cel, cel: options => wrap(cel.cel(options)), flat: options => cel.flat(options), wrap };
}

/** Recolour the plain (unlit) materials of a built subtree: bulbs, labels, distant houses, petals. */
export function swapBasicColours(root) {
  root.traverse(object => {
    const list = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of list) {
      if (!material || material.userData.doodleSwapped || material.isMeshToonMaterial) continue;
      material.userData.doodleSwapped = true;
      if (material.color && !material.map) material.color.set(swap('#' + material.color.getHexString()));
    }
  });
}

export function createCourtyardDoodle(renderer, scene, getCamera) {
  let pass = null;
  try { pass = createDoodlePass(renderer, scene, getCamera, { ink: D.ink, paper: D.paper }); }
  catch (error) { console.warn('Music Map: the doodle renderer is unavailable; using the night renderer.', error); pass = null; }
  return pass;
}
