import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { DOODLE_COLORS, DOODLE_KRAFT } from '../web/event-room/venue-art.js';
import { createCelMaterials } from '../web/original-map/js/vendor/sakura/toon.js';
import {
  pageLook, doodleRequested, PAPER_TOON, PAPER_SET, PAPER_TABLE, PAPER_SHADE, KEY_LIGHT, keyLightFor, lineWidthFor, mapCelMaterials,
} from '../web/original-map/js/sakura-doodle.js';
import {
  paintMarquee, paintSleeve, paintBadge, paintPoster, paintSign, paintCover, paintBack, watchPrintFonts, withAlpha,
} from '../web/original-map/js/sakura-doodle-prints.js';
import { createSakuraPrintwork } from '../web/original-map/js/sakura-printwork.js';
import { buildSakuraWorld } from '../web/original-map/js/sakura-world.js';
import { createSakuraMusic } from '../web/original-map/js/sakura-music.js';

// The Music Map's courtyard and record shop in the Doodle look (web/original-map/js/sakura-doodle*.js): the paper set is
// built in Node with the real three.js (no GPU), and the canvas prints are painted on a recording 2D context.

after(() => { gsap.globalTimeline.clear(); gsap.ticker.sleep(); });

const sRGB = hex => new THREE.Color(hex).getHexString();
// The night palette as sakura-scene.js writes it.
const NIGHT_TOON = Object.fromEntries([...readFileSync(new URL('../web/original-map/js/sakura-scene.js', import.meta.url), 'utf8')
  .match(/const NIGHT_TOON = \{([\s\S]*?)\};/)[1].matchAll(/(\w+): '(#[0-9a-f]{6})'/g)].map(([, role, color]) => [role, color]));
const TOKENS = new Set([...Object.values(DOODLE_COLORS), DOODLE_KRAFT].map(sRGB));

/** A 2D context that accepts every call and records it (no pixels). */
function recordingContext(log) {
  const state = {};
  return new Proxy(state, {
    get(target, key) {
      if (key in target) return target[key];
      return (...args) => { log.push([key, ...args]); return { addColorStop() {} }; };
    },
    set(target, key, value) { target[key] = value; log.push(['set', key, value]); return true; },
  });
}
/** Just enough DOM for the set and the record table: canvases with recording contexts, buttons with named parts. */
function installDocument(log = []) {
  const element = tag => {
    const parts = new Map(); const classes = new Set(); const attributes = new Map();
    const el = {
      tagName: tag.toUpperCase(), width: 300, height: 150, hidden: false, disabled: false, tabIndex: 0, textContent: '', innerHTML: '', className: '', title: '',
      style: { setProperty(name, value) { this[name] = value; } }, dataset: {},
      classList: { toggle(name, on) { if (on) classes.add(name); else classes.delete(name); }, contains: name => classes.has(name), add: name => classes.add(name), remove: name => classes.delete(name) },
      setAttribute: (name, value) => attributes.set(name, String(value)), getAttribute: name => attributes.get(name) ?? null, removeAttribute: name => attributes.delete(name),
      querySelector(selector) { if (!parts.has(selector)) parts.set(selector, element(selector)); return parts.get(selector); },
      addEventListener() {}, removeEventListener() {}, append() {}, remove() {},
      getContext: () => recordingContext(log),
    };
    return el;
  };
  globalThis.document = { createElement: element, activeElement: null };
  return element;
}
const restoreDocument = (() => { const had = Object.getOwnPropertyDescriptor(globalThis, 'document'); return () => { if (had) Object.defineProperty(globalThis, 'document', had); else delete globalThis.document; }; })();

/** The scene's builders (sakura-scene.js), for a set built without a renderer. */
function builders(look) {
  const state = { active: look === 'paper', uniforms: { terminator: { value: .12 }, key: { value: 1 } } };
  const cel = mapCelMaterials(createCelMaterials(), state, { paper: look === 'paper' });
  const palette = look === 'paper' ? PAPER_TOON : NIGHT_TOON;
  const world = new THREE.Group(); const materials = new Set(); const textures = new Set();
  const geometry = item => item;
  const unit = { box: new THREE.BoxGeometry(1, 1, 1), cylinder: new THREE.CylinderGeometry(1, 1, 1, 20), sphere: new THREE.SphereGeometry(1, 20, 14) };
  const mesh = (shape, material, position, scale = [1, 1, 1], parent = world) => {
    const item = new THREE.Mesh(shape, material); item.position.set(...position); item.scale.set(...scale);
    item.castShadow = true; item.receiveShadow = true; parent.add(item); return item;
  };
  const toon = Object.fromEntries(Object.entries(palette).map(([name, color]) => [name, cel.cel({ color, bands: ['rose', 'blush', 'petal'].includes(name) ? 'soft' : 3, flat: false })]));
  const box = (position, scale, material = toon.cream, parent = world) => mesh(unit.box, material, position, scale, parent);
  const cylinder = (position, scale, material = toon.green, parent = world) => mesh(unit.cylinder, material, position, scale, parent);
  const ball = (position, scale, material = toon.rose, parent = world) => mesh(unit.sphere, material, position, scale, parent);
  const rod = (a, b, radius, material = toon.wood, parent = world) => {
    const from = new THREE.Vector3(...a); const to = new THREE.Vector3(...b);
    const item = cylinder(from.clone().add(to).multiplyScalar(.5).toArray(), [radius, from.distanceTo(to), radius], material, parent);
    item.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.sub(from).normalize()); return item;
  };
  const label = (text, width, height) => mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(document.createElement('canvas')) }), [0, 0, 0]);
  return { THREE, world, mesh, box, cylinder, ball, rod, label, geometry, toon, cel: cel.cel, materials, textures, look, celMaterials: cel };
}
function materialsOf(root) {
  const list = [];
  root.traverse(object => { for (const material of [object.material].flat()) if (material && !list.includes(material)) list.push(material); });
  return list;
}

test('the scene goes paper only where the page carries the Doodle tokens, and ?doodle= is read from the address alone', () => {
  const doc = (paper, look) => ({ documentElement: { dataset: look ? { look } : {} }, defaultView: { getComputedStyle: () => ({ getPropertyValue: name => (name === '--ds-paper' ? paper : '') }) } });
  assert.equal(pageLook(doc(' #f7efdf')), 'paper');
  assert.equal(pageLook(doc('')), 'night');
  assert.equal(pageLook(doc('', 'doodle')), 'paper');
  assert.equal(pageLook({ documentElement: {}, defaultView: { getComputedStyle() { throw new Error('no styles'); } } }), 'night');
  assert.equal(pageLook(null), 'night');
  const had = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, get() { throw new Error('the map must not touch the room\'s tab storage'); } });
  try {
    for (const off of ['?doodle=0', '?doodle=off', '?doodle=false', '?doodle=classic', '?room=AB12&doodle=0']) assert.equal(doodleRequested(off), false, off);
    for (const on of ['', '?doodle=1', '?from=a&to=b']) assert.equal(doodleRequested(on), true, on || '(none)');
  } finally { if (had) Object.defineProperty(globalThis, 'sessionStorage', had); else delete globalThis.sessionStorage; }
  for (const key of ['home', 'explore', 'records']) assert.equal(keyLightFor(key), KEY_LIGHT[key]);
  assert.equal(keyLightFor('retired'), KEY_LIGHT.home);
  assert.equal(lineWidthFor('home', 390), 1.8);
  assert.equal(lineWidthFor('home', 1440), 2.5);
  assert.equal(lineWidthFor('explore', 390), 2.5);
});

test('every paper colour is a Doodle token or the room\'s kraft board', () => {
  const flat = value => (Array.isArray(value) ? value : typeof value === 'object' ? Object.values(value).flatMap(flat) : [value]);
  for (const [name, palette] of Object.entries({ PAPER_TOON, PAPER_SET, PAPER_TABLE })) {
    for (const color of flat(palette)) assert.ok(TOKENS.has(sRGB(color)), `${name}: ${color} is not a token`);
  }
  assert.ok(TOKENS.has(sRGB(PAPER_SHADE)));
  // Every role of the night palette has a paper value, and the other way round.
  assert.ok(Object.keys(NIGHT_TOON).length >= 18);
  assert.deepEqual(Object.keys(PAPER_TOON).sort(), Object.keys(NIGHT_TOON).sort());
});

test('the doodle cel wrapper compiles real MeshToonMaterial programs as doodle cel, and as the vendor tint when off', () => {
  const state = { active: true, uniforms: { terminator: { value: .12 }, key: { value: 1 } } };
  const cel = mapCelMaterials(createCelMaterials(), state, { paper: true });
  const material = cel.cel({ color: DOODLE_COLORS.mint, bands: 3, flat: false });
  assert.equal(cel.cel({ color: DOODLE_COLORS.mint, bands: 3, flat: false }), material, 'the vendor cache still shares materials');
  const shader = () => ({ uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.toon.uniforms), vertexShader: THREE.ShaderLib.toon.vertexShader, fragmentShader: THREE.ShaderLib.toon.fragmentShader });
  const on = shader(); material.onBeforeCompile(on, null);
  assert.match(on.fragmentShader, /uniform float uDoodleTerminator/);
  assert.match(on.fragmentShader, /gl_FragColor\.a = doodleKey >= 0\.5 \* uDoodleKey/);
  assert.equal(on.uniforms.uDoodleTerminator, state.uniforms.terminator);
  assert.equal(material.customProgramCacheKey(), 'map-doodle-cel');
  // The classic fallback on paper shades toward warm paper, not the night's violet.
  assert.equal(material.userData.shadowTint.value.getHexString(), sRGB(PAPER_SHADE));
  state.active = false;
  const version = material.version; cel.recompile(); assert.ok(material.version > version, 'leaving the pass recompiles the wrapped materials');
  const off = shader(); material.onBeforeCompile(off, null);
  assert.doesNotMatch(off.fragmentShader, /uDoodle/);
  assert.match(off.fragmentShader, /uniform vec3 uShadowTint/);
  assert.match(material.customProgramCacheKey(), /^celTint_/);
  assert.equal(cel.cel({ color: '#ffffff', bands: 'soft', flat: false }).isMeshToonMaterial, true);
  cel.dispose();
});

test('paper set: a pop-up yard of token colours, no night glow, neighbourhood or self-lit blossom', () => {
  const log = []; installDocument(log);
  try {
    const paper = builders('paper');
    const model = buildSakuraWorld(paper);
    assert.equal(model.night, null);
    assert.equal(typeof model.prints.repaint, 'function');
    const names = new Set(); paper.world.traverse(object => names.add(object.name));
    for (const gone of ['stage-beam', 'quiet-neighbour-0', 'quiet-neighbour-4']) assert.ok(!names.has(gone), `${gone} is night only`);
    for (const kept of ['open-record-shop', 'removable-shop-roof', 'record-counter', 'memory-record-cabinet', 'stage-par-can', 'sleeping-shop-cat']) assert.ok(names.has(kept), kept);
    let sprites = 0; paper.world.traverse(object => { if (object.isSprite) sprites++; });
    assert.equal(sprites, 0, 'no additive halos on paper');
    for (const material of materialsOf(paper.world)) {
      assert.notEqual(material.blending, THREE.AdditiveBlending, 'additive light would corrupt the pass\'s shading code');
      if (material.emissive) assert.equal(material.emissive.getHex(), 0, 'the pass adds emissive to the paper colour');
      const tinted = material.map ? material.color.getHexString() === 'ffffff' : TOKENS.has(material.color.getHexString());
      assert.ok(tinted || (material.map && TOKENS.has(material.color.getHexString())), `${material.type} ${material.color.getHexString()} is not a token`);
    }
    // The prints on paper never letter the night venue's names.
    const lettered = log.filter(([call]) => call === 'fillText' || call === 'strokeText').map(([, text]) => String(text)).join(' ');
    assert.doesNotMatch(lettered, /樱下|NIGHT BLOOM|LITTLE MOMENTS/);
    assert.match(lettered, /唱片店/);
    paper.celMaterials.dispose();

    const night = builders('night');
    const nightModel = buildSakuraWorld(night);
    assert.ok(nightModel.night?.haloMaterial && nightModel.night?.beamMaterial, 'the night venue keeps its glow');
    const nightNames = new Set(); night.world.traverse(object => nightNames.add(object.name));
    assert.ok(nightNames.has('stage-beam') && nightNames.has('quiet-neighbour-0'));
    night.celMaterials.dispose();
  } finally { restoreDocument(); }
});

test('marker prints: invented lettering only, token colours, no names on the record faces', () => {
  const allowed = color => TOKENS.has(sRGB(color));
  const paints = { marquee: paintMarquee, sleeve0: ctx => paintSleeve(ctx, 0), sleeve1: ctx => paintSleeve(ctx, 1), sleeve2: ctx => paintSleeve(ctx, 2), badge: paintBadge, poster: paintPoster, sign: ctx => paintSign(ctx, '33 / 45'), back: paintBack };
  const texts = {};
  for (const [name, paint] of Object.entries(paints)) {
    const log = []; paint(recordingContext(log));
    texts[name] = log.filter(([call]) => call === 'fillText').map(([, text]) => text);
    for (const [call, key, value] of log) {
      if (call !== 'set' || !['fillStyle', 'strokeStyle'].includes(key)) continue;
      const rgba = /^rgba\((\d+),(\d+),(\d+),[\d.]+\)$/.exec(value);
      const color = rgba ? '#' + rgba.slice(1, 4).map(n => Number(n).toString(16).padStart(2, '0')).join('') : value;
      assert.ok(allowed(color), `${name}: ${value} is not a token colour`);
    }
  }
  assert.deepEqual([...new Set(texts.marquee)], ['唱片店', 'RECORDS']);
  assert.deepEqual([...new Set(texts.back)], ['?']);
  assert.deepEqual([...new Set(texts.sign)], ['33 / 45']);
  assert.doesNotMatch(Object.values(texts).flat().join(' '), /樱下|NIGHT/);
  const coverLog = []; paintCover(recordingContext(coverLog), { id: 'real-jay', name: '周杰伦', color: '#e46a4b' });
  assert.equal(coverLog.some(([call]) => call === 'fillText' || call === 'strokeText'), false, 'a face carries colour and pattern, never a name');
  assert.ok(coverLog.some(([call, key, value]) => call === 'set' && key === 'fillStyle' && value === '#e46a4b'), 'the artist\'s catalogue colour');
  assert.equal(withAlpha(DOODLE_COLORS.ink, .08), 'rgba(28,27,26,0.08)');
  installDocument();
  try {
    const textures = new Set(); const materials = new Set();
    const paper = createSakuraPrintwork({ THREE, textures, materials, look: 'paper' });
    assert.equal(paper.sleeves.length, 3);
    for (const print of [...paper.sleeves, paper.marquee, paper.badge, paper.poster]) assert.equal(print.isMeshBasicMaterial, true, 'prints are unlit');
    const versions = [...textures].map(texture => texture.version); paper.repaint();
    assert.ok([...textures].some((texture, index) => texture.version > versions[index]), 'a repaint refreshes the print textures');
  } finally { restoreDocument(); }
});

test('the prints are painted again once the Doodle faces arrive, and only then', async () => {
  const listeners = new Set(); let faces = [];
  const fonts = { load: async () => faces, addEventListener: (type, fn) => listeners.add(fn), removeEventListener: (type, fn) => listeners.delete(fn) };
  let repaints = 0;
  const stop = watchPrintFonts(() => repaints++, { fonts });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(repaints, 0, 'no faces yet (the stylesheet may come later)');
  faces = [{ family: 'Doodle Logo' }];
  for (const fn of [...listeners]) fn();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(repaints, 1);
  assert.equal(listeners.size, 0, 'it stops watching once every face is in');
  stop();
  assert.doesNotThrow(() => watchPrintFonts(() => {}, {})());
});

test('paper record table: sleeve faces and ink are unlit marker prints, quiet records fade, the sheet takes no shadows', () => {
  installDocument();
  try {
    const { cel, celMaterials } = builders('paper');
    const world = new THREE.Group();
    const host = { clientWidth: 1200, dataset: {}, append() {}, addEventListener() {}, removeEventListener() {} };
    const canvas = { style: {}, addEventListener() {}, removeEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: 800 }), hasPointerCapture: () => false };
    const framing = { watchLabel: () => () => {}, labelSize: () => ({ width: 60, height: 30 }), placeLabel: () => true, labelMark: () => 0, rewindLabels() {}, layout: { width: 1200, obstacles: [], blocked: false } };
    const music = createSakuraMusic({ world, cel, host, canvas, camera: new THREE.PerspectiveCamera(), reduced: { matches: true }, onAction() {}, onChange() {}, isActive: () => true, framing, look: 'paper' });
    const sheet = world.getObjectByName('record-connection-table').children.find(child => child.isMesh && child.material.color?.getHexString() === sRGB(PAPER_TABLE.sheet));
    assert.ok(sheet, 'the card sheet'); assert.equal(sheet.receiveShadow, false);
    music.setMusic({
      key: 'real:co', selectedId: 'a', pathIds: ['a'], round: null,
      nodes: [
        { id: 'a', name: 'A', color: '#e46a4b', count: 2, x: -.8, z: 0, selected: true, current: true },
        { id: 'b', name: 'B', color: '#7da7d9', count: 1, x: .2, z: .3, adjacent: true },
        { id: 'c', name: 'C', color: '#9cc27f', count: 1, x: .9, z: -.4 },
      ],
      edges: [{ id: 'ab', a: 'a', b: 'b', title: '歌', kind: 'co', active: true }, { id: 'bc', a: 'b', b: 'c', title: '歌', kind: 'co' }],
    });
    const records = world.getObjectByName('music-relationship-network').children.filter(child => child.name === 'music-record');
    assert.equal(records.length, 3);
    const faces = records.map(group => group.children.find(child => child.material?.userData?.fade));
    for (const face of faces) assert.equal(face.material.isMeshBasicMaterial, true, 'a face is a print');
    assert.deepEqual(faces.map(face => face.material.userData.fade.value), [0, 0, .42], 'only the quiet record fades');
    for (const group of records) group.traverse(part => { if (part.isMesh) assert.equal(part.receiveShadow, false); });
    const ring = records[0].children.find(child => child.visible && child.geometry?.type === 'BufferGeometry' && child.material.isMeshBasicMaterial);
    assert.ok(ring, 'the current record is circled by a marker ring');
    assert.equal(ring.material.color.getHexString(), sRGB(PAPER_TABLE.selected));
    const strokes = world.getObjectByName('music-relationship-network').children.filter(child => child.name === 'music-connection').flatMap(group => group.children);
    assert.ok(strokes.length > 0);
    for (const stroke of strokes) assert.equal(stroke.material.isMeshBasicMaterial, true, 'ink on the table is a marker stroke');
    assert.deepEqual(new Set(strokes.map(stroke => stroke.material.color.getHexString())), new Set([sRGB(PAPER_TABLE.edges.active), sRGB(PAPER_TABLE.edges.quiet)]));
    music.dispose(); celMaterials.dispose();
  } finally { restoreDocument(); }
});

test('the overlay DOM the UI styles keeps its names, and the 3D files keep no storage of their own', () => {
  const read = name => readFileSync(new URL(`../web/original-map/js/${name}`, import.meta.url), 'utf8');
  const scene = read('sakura-scene.js'); const music = read('sakura-music.js');
  for (const name of ["'world-compass'", 'data-world-view="home"', 'data-world-view="explore"', 'data-world-view="records"', "'world-hotspots'", "'world-pin'", "'world-caption'", "'sakura-scene__canvas'", 'host.dataset.renderStyle', 'host.dataset.shot', 'host.dataset.travelling']) assert.ok(scene.includes(name), `sakura-scene.js: ${name}`);
  for (const name of ["'world-music-label world-music-label--node'", "'world-music-link'", 'world-music-hit', 'host.dataset.musicZoom', "'--record-tone'", '--leader-', '--touch-', 'dataset.touch']) assert.ok(music.includes(name), `sakura-music.js: ${name}`);
  // #sakura-world[data-render-style] tells QA and the UI which renderer drew the page.
  assert.ok(scene.includes("host.dataset.renderStyle = doodle ? 'doodle' : paper ? 'classic' : 'night';"));
  assert.ok(scene.includes("host.dataset.renderStyle = 'classic';"), 'a failed doodle shader switches the style to classic');
  for (const name of ['sakura-scene.js', 'sakura-world.js', 'sakura-music.js', 'sakura-printwork.js', 'sakura-doodle.js', 'sakura-doodle-prints.js']) {
    assert.doesNotMatch(read(name), /localStorage|sessionStorage|indexedDB|caches\./, `${name} keeps no storage`);
  }
});

test('inside the shop the roof lifts, sign and awning with it, and the record table leaves the festoon strand out', () => {
  installDocument();
  try {
    const paper = builders('paper');
    const model = buildSakuraWorld(paper);
    let marquee = false; model.roof.traverse(part => { if (part.material === model.prints.marquee) marquee = true; });
    assert.ok(marquee, 'the 唱片店 RECORDS sign hangs on the roof that lifts');
    assert.equal(model.festoon.name, 'festoon-strand');
    assert.equal(model.festoon.parent, paper.world);
    const parts = []; model.festoon.traverse(part => { if (part.isMesh) parts.push(part); });
    assert.equal(parts.length, 2 + 3 * 14, 'two wires, and a hanger, a socket and a bulb for each of the 14 lamps (the poles stay in the yard)');
    paper.celMaterials.dispose();
  } finally { restoreDocument(); }
  const scene = readFileSync(new URL('../web/original-map/js/sakura-scene.js', import.meta.url), 'utf8');
  assert.ok(scene.includes("model.roof.visible = key === 'home';"), 'the roof only stands over the courtyard view');
  assert.ok(scene.includes("model.festoon.visible = key !== 'explore';"), 'the record table leaves the strand out');
  assert.ok(scene.includes('exclude: [model.roof, model.record, model.shelf, model.festoon,'), 'the strand is not merged into the yard batches');
  assert.ok(scene.includes('batchStaticMeshes(THREE, model.festoon);'), 'it is batched on its own, so it can hide');
});
