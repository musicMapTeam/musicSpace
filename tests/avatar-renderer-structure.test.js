/**
 * Renderer structure/lifecycle checks. Run:
 *   node --test tests/avatar-renderer-structure.test.js
 *
 * Three.js geometry, scene graph, camera, materials and the licensed postprocess
 * classes are real. Only WebGLRenderer and the browser's DOM/image/RAF surfaces
 * are mocked. This DOES NOT compile GPU shaders, render image pixels, establish
 * frame rate, or replace visual checks in a WebGL-capable browser. Returned
 * image data is a dimension marker, deliberately not an actual PNG.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { DEFAULT_AVATAR, GARMENT_COLORS, TEMPLATES } from '../web/avatar/model.js';
import * as THREE from 'three';
import {memberFloorPositions} from '../web/event-room/scene-layout.js';

const rendererURL = new URL('../web/avatar/three-scene.js', import.meta.url);
const POSES = ['sway', 'wave', 'sing', 'listen'];
const SETS = ['rooftop-night', 'sakura-night', 'fan-stage'];
const PHOTO_A = 'data:image/jpeg;base64,c3RydWN0dXJlLXRlc3QtYQ==';
const PHOTO_B = 'data:image/png;base64,c3RydWN0dXJlLXRlc3QtYg==';
const HOST_TRANSFORM = { x: 35, y: 82, scale: 1, rotation: 0 };
const GUEST_TRANSFORM = { x: 68, y: 78, scale: .8, rotation: 14 };

function eventSurface(target = {}) {
  const listeners = new Map();
  target.addEventListener = (name, callback) => {
    if (!listeners.has(name)) listeners.set(name, new Set());
    listeners.get(name).add(callback);
  };
  target.removeEventListener = (name, callback) => listeners.get(name)?.delete(callback);
  target.dispatchEvent = event => {
    listeners.get(event.type)?.forEach(callback => callback(event));
    return true;
  };
  target.listenerCount = () => [...listeners.values()].reduce((n, callbacks) => n + callbacks.size, 0);
  return target;
}

function makeHarness() {
  const stats = { renderCalls: 0, verticesChecked: 0, geometries: new Map(), renderTargets: new Map(), composites: [], knownVendorWarnings: 0 };
  const images = [], observers = [], renderers = [], raf = new Map();
  let nextFrame = 0, nextSurface = 0;
  const canvas = () => {
    const output = eventSurface({ width: 600, height: 800, style: {}, id: ++nextSurface, removed: false });
    output.setAttribute = () => {};
    output.remove = () => { output.removed = true; };
    const gradient = () => ({ addColorStop() {} });
    const context = {
      createRadialGradient: gradient, createLinearGradient: gradient,
      fillRect() {}, beginPath() {}, arc() {}, fill() {}, fillText() {}, save() {}, restore() {}, translate() {}, rotate() {}, moveTo() {}, lineTo() {}, bezierCurveTo() {}, stroke() {}, closePath() {},
      drawImage(...args) { stats.composites.push({ canvas: output, args }); },
    };
    output.getContext = () => context;
    output.toDataURL = type => {
      assert.equal(type, 'image/png');
      return 'data:image/png;base64,' + Buffer.from(JSON.stringify({ mock: true, width: output.width, height: output.height, surface: output.id })).toString('base64');
    };
    return output;
  };
  const document = eventSurface({ hidden: false, createElement: tag => {
    assert.equal(tag, 'canvas');
    return canvas();
  } });
  const container = eventSurface({
    children: [], width: 600, height: 800,
    append(child) { this.children.push(child); },
    getBoundingClientRect() { return { left:0,top:0,width:this.width,height:this.height }; },
  });
  class MockImage {
    constructor() { this.naturalWidth = 1920; this.naturalHeight = 1080; images.push(this); }
    set src(value) { this.source = value; }
    removeAttribute(name) { if(name==='src')this.source=null; }
    load() { this.onload?.(); }
    fail() { this.onerror?.(); }
  }
  class MockResizeObserver {
    constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
    observe(target) { this.target = target; }
    disconnect() { this.disconnected = true; }
  }
  class MockRenderer {
    constructor(options) {
      this.options = options; this.domElement = canvas(); this.shadowMap = {};
      this.alpha = 1; this.color = new THREE.Color(); this.disposed = false;
      this.contextLost = false; this.lastWorld = null; renderers.push(this);
    }
    setClearColor(value, alpha = 1) { this.color.set(value); this.alpha = alpha; }
    getClearColor(output) { return output.copy(this.color); }
    getClearAlpha() { return this.alpha; }
    setPixelRatio() {}
    setSize(width, height) { this.domElement.width = width; this.domElement.height = height; }
    getContext() { return { isContextLost: () => this.contextLost }; }
    setRenderTarget(target) {
      if (!target || stats.renderTargets.has(target)) return;
      const record = { disposed: 0 };
      stats.renderTargets.set(target, record);
      target.addEventListener('dispose', () => { record.disposed++; });
    }
    clear() {}
    dispose() { this.disposed = true; }
    forceContextLoss() { this.contextLost = true; }
    render(scene, camera) {
      stats.renderCalls++;
      assert.ok(camera.projectionMatrix.elements.every(Number.isFinite), 'finite camera projection');
      scene.updateMatrixWorld(true);
      scene.traverse(object => {
        if (!object.isMesh || stats.geometries.has(object.geometry)) return;
        const geometry = object.geometry;
        const record = { disposed: 0 };
        stats.geometries.set(geometry, record);
        geometry.addEventListener('dispose', () => { record.disposed++; });
        for (const name of ['position', 'normal', 'uv']) {
          const attribute = geometry.attributes[name];
          if (attribute) assert.ok(attribute.array.every(Number.isFinite), `finite ${name} attribute`);
        }
        stats.verticesChecked += geometry.attributes.position.count;
      });
      if(scene.isScene){this.lastScene=scene;this.lastCamera=camera;}
      if (scene.isScene && scene.getObjectByName('host-feet')) {
        this.lastWorld = { scene, camera, people: {} };
        for (const slot of ['host', 'guest']) {
          const person = scene.getObjectByName(`${slot}-feet`);
          if (!person) continue;
          const projected = new THREE.Vector3().setFromMatrixPosition(person.matrixWorld).project(camera);
          this.lastWorld.people[slot] = {
            x: (projected.x + 1) * 50,
            y: (1 - projected.y) * 50,
            sway: person.getObjectByName(`${slot}-pose`).rotation.z,
          };
        }
      }
    }
  }
  const globals = {
    document, window: { devicePixelRatio: 2 }, Image: MockImage, ResizeObserver: MockResizeObserver,
    requestAnimationFrame: callback => { const id = ++nextFrame; raf.set(id, callback); return id; },
    cancelAnimationFrame: id => raf.delete(id),
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    __MusicSpaceStructureRenderer: MockRenderer,
  };
  const descriptors = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.entries(globals).forEach(([key, value]) => Object.defineProperty(globalThis, key, { value, configurable: true, writable: true }));
  const originalWarn = console.warn;
  console.warn = (...args) => {
    // Existing vendor helper passes this removed, nonfatal r186 property. Keep
    // other warnings visible and report the count instead of flooding TAP.
    if (args.map(String).join(' ').includes("'flatShading' is not a property of THREE.MeshToonMaterial")) stats.knownVendorWarnings++;
    else originalWarn(...args);
  };
  return {
    stats, container, document, images, observers, renderers, raf,
    runFrame(time) {
      const entry = raf.entries().next().value;
      assert.ok(entry, 'a frame was scheduled');
      raf.delete(entry[0]); entry[1](time);
    },
    restore() {
      console.warn = originalWarn;
      descriptors.forEach((descriptor, key) => descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key]);
    },
  };
}

async function instrumentedModule() {
  let source = await readFile(rendererURL, 'utf8');
  const imports = [
    ["from '../character-lab/character.js';", `from '${new URL('../web/character-lab/character.js', import.meta.url)}';`],
    ["from '../event-room/illustrated-person.js';", `from '${new URL('../web/event-room/illustrated-person.js', import.meta.url)}';`],
    ["from '../event-room/venue-asset.js';", `from '${new URL('../web/event-room/venue-asset.js', import.meta.url)}';`],
    ["from '../event-room/venue-art.js';", `from '${new URL('../web/event-room/venue-art.js', import.meta.url)}';`],
    ["from '../event-room/scene-layout.js';", `from '${new URL('../web/event-room/scene-layout.js', import.meta.url)}';`],
    ["from 'three';", `from '${import.meta.resolve('three')}';`],
    ["from 'three/addons/geometries/RoundedBoxGeometry.js';", `from '${import.meta.resolve('three/addons/geometries/RoundedBoxGeometry.js')}';`],
    ["from '../js/vendor/sakura/toon.js';", `from '${new URL('../web/js/vendor/sakura/toon.js', import.meta.url)}';`],
    ["from '../js/vendor/sakura/post.js';", `from '${new URL('../web/js/vendor/sakura/post.js', import.meta.url)}';`],
    ["from './model.js';", `from '${new URL('../web/avatar/model.js', import.meta.url)}';`],
    ['new THREE.WebGLRenderer({', 'new globalThis.__MusicSpaceStructureRenderer({'],
  ];
  for (const [before, after] of imports) {
    assert.equal(source.split(before).length - 1, 1, `one explicit instrumentation seam: ${before}`);
    source = source.replace(before, after);
  }
  return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
}

function marker(dataURL) {
  assert.match(dataURL, /^data:image\/png;base64,/);
  const result = JSON.parse(Buffer.from(dataURL.split(',')[1], 'base64').toString());
  assert.equal(result.mock, true, 'this harness never claims to produce actual pixels');
  return result;
}
function avatarFingerprint(root) {
  // Fingerprints cover actual local mesh vertices, world transforms, and
  // colours. They prove that choices change the assembled model, not pixels.
  const hash = createHash('sha256');
  root.updateMatrixWorld(true);
  root.traverse(object => {
    if (!object.isMesh) return;
    const positions = object.geometry.attributes.position.array;
    hash.update(Buffer.from(positions.buffer, positions.byteOffset, positions.byteLength));
    hash.update(JSON.stringify(object.matrixWorld.elements));
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    hash.update(materials.map(material => material.color?.getHexString() || material.type).join('|'));
  });
  return hash.digest('hex');
}
function avatarColors(root) {
  const colors = new Set();
  root.traverse(object => {
    if (!object.isMesh) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material.color) colors.add('#' + material.color.getHexString());
    }
  });
  return colors;
}
function closeTo(actual, expected) { assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} ≈ ${expected}`); }
function state(avatar = {}, extra = {}) {
  return {
    scene: { kind: 'builtin', id: 'rooftop-night' },
    host: { avatar, transform: HOST_TRANSFORM },
    guest: { avatar: { ...avatar, hair: 3 }, transform: GUEST_TRANSFORM },
    playing: false, bpm: 96, reducedMotion: true, ...extra,
  };
}

test('toon renderer: geometry and lifecycle only, with a mocked GPU surface', async t => {
  const harness = makeHarness();
  let scene;
  try {
    const { mountToonScene } = await instrumentedModule();
    scene = mountToonScene(harness.container, state());
    const renderer = harness.renderers[0];
    assert.equal(renderer.options.preserveDrawingBuffer, true);
    assert.equal(harness.container.children.length, 1);

    for (let outfit = 0; outfit < 6; outfit++) {
      for (const pose of POSES) {
        await t.test(`outfit ${outfit}, pose ${pose}: finite geometry, projected feet, portraits, export`, () => {
          const avatar = { ...TEMPLATES[outfit].avatar, skin: outfit % 5, pose };
          scene.update(state(avatar, { scene: { kind: 'builtin', id: SETS[outfit % SETS.length] } }));
          for (const [slot, transform] of [['host', HOST_TRANSFORM], ['guest', GUEST_TRANSFORM]]) {
            closeTo(renderer.lastWorld.people[slot].x, transform.x);
            closeTo(renderer.lastWorld.people[slot].y, transform.y);
            assert.equal(scene.getBounds()[slot].x, transform.x);
            assert.equal(scene.getBounds()[slot].y, transform.y);
          }
          const portrait = marker(scene.portrait(avatar, { size: 256 }));
          assert.deepEqual([portrait.width, portrait.height], [256, 256]);
          const fullBody = marker(scene.portrait(avatar, { size: 256, fullBody: true }));
          assert.deepEqual([fullBody.width, fullBody.height], [256, 384]);
          const renderedBeforeCacheHit = harness.stats.renderCalls;
          scene.portrait(avatar, { size: 256 });
          assert.equal(harness.stats.renderCalls, renderedBeforeCacheHit, 'portrait cache avoids rendering again');
          const exported = marker(scene.capture({ width: 1440, height: 1920 }));
          assert.deepEqual([exported.width, exported.height], [1440, 1920]);
          assert.deepEqual([renderer.domElement.width, renderer.domElement.height], [600, 800], 'live viewport restored');
          closeTo(renderer.lastWorld.people.host.x, HOST_TRANSFORM.x);
          closeTo(renderer.lastWorld.people.host.y, HOST_TRANSFORM.y);
        });
      }
    }

    await t.test('headphones and accessory-free variants keep every hair geometry finite', () => {
      for (let hair = 0; hair < 8; hair++) for (const accessory of ['headphones', 'none']) {
        const avatar = { ...DEFAULT_AVATAR, hair, accessory, pose: 'listen' };
        scene.update(state(avatar));
        assert.equal(marker(scene.portrait(avatar)).width, 256);
      }
    });
    await t.test('36 independent top × bottom combinations create distinct finite models', () => {
      const fingerprints = new Set();
      for (let top = 0; top < 6; top++) for (let bottom = 0; bottom < 6; bottom++) {
        const avatar = { ...DEFAULT_AVATAR, top, bottom, shoes: (top + bottom) % 4, eyewear: 1, accessory: 'none' };
        scene.update(state(avatar, { guest: null }));
        fingerprints.add(avatarFingerprint(renderer.lastWorld.scene.getObjectByName('host-feet')));
      }
      assert.equal(fingerprints.size, 36, 'every selected top/bottom pair has a distinct assembled model');
    });
    await t.test('48 independent hair × eyewear combinations, including eyewear with headphones', () => {
      const fingerprints = new Set();
      for (let hair = 0; hair < 8; hair++) for (let eyewear = 0; eyewear < 6; eyewear++) {
        const avatar = { ...DEFAULT_AVATAR, hair, eyewear, accessory: 'headphones', skin: hair % 5 };
        scene.update(state(avatar, { guest: null }));
        fingerprints.add(avatarFingerprint(renderer.lastWorld.scene.getObjectByName('host-feet')));
      }
      assert.equal(fingerprints.size, 48, 'each hair/eyewear pair remains distinct with independent headphones');
    });
    await t.test('all six accessories and four expressions change actual geometry independently', () => {
      const accessories = ['none', 'headphones', 'earbuds', 'chain', 'crossbody', 'cap'];
      const expressions = ['neutral', 'smile', 'wink', 'focused'];
      const fingerprints = new Set();
      for (const accessory of accessories) for (const expression of expressions) {
        const avatar = { ...DEFAULT_AVATAR, top: 5, bottom: 2, hair: 6, eyewear: 4, accessory, expression, pose: 'sway', skin: 3 };
        scene.update(state(avatar, { guest: null }));
        fingerprints.add(avatarFingerprint(renderer.lastWorld.scene.getObjectByName('host-feet')));
      }
      assert.equal(fingerprints.size, 24, 'accessory/expression options are real model changes');
      // Cap fitting over each independently selected hair mesh is exercised,
      // but actual overlap/fit still requires a rendered visual inspection.
      for (let hair = 0; hair < 8; hair++) scene.update(state({ ...DEFAULT_AVATAR, hair, accessory: 'cap', eyewear: 5 }, { guest: null }));
    });
    await t.test('top, bottom and shoe palettes are independent for all eight colours', () => {
      for (const field of ['topColor', 'bottomColor', 'shoeColor']) for (let color = 0; color < 8; color++) {
        const avatar = { ...DEFAULT_AVATAR, top: 1, bottom: 2, shoes: 1, topColor: 3, bottomColor: 6, shoeColor: 5, [field]: color };
        scene.update(state(avatar, { guest: null }));
        const actual = avatarColors(renderer.lastWorld.scene.getObjectByName('host-feet'));
        for (const key of ['topColor', 'bottomColor', 'shoeColor']) {
          assert.ok(actual.has(GARMENT_COLORS[avatar[key]]), `${field}=${color} preserves ${key}=${avatar[key]} in the model`);
        }
      }
    });
    await t.test('covered garments have coherent shells and overlapping sleeve roots in every pose', () => {
      const named = (root, name) => { const nodes=[]; root.traverse(node=>{if(node.name===name)nodes.push(node);}); return nodes; };
      for(let top=0;top<6;top++)for(const pose of POSES){
        scene.update(state({...DEFAULT_AVATAR,top,pose},{guest:null}));
        const root=renderer.lastWorld.scene.getObjectByName('host-feet');
        const body=root.getObjectByName('host-pose'), inverse=body.matrixWorld.clone().invert();
        assert.equal(named(root,'avatar-layered-undershirt').length,[1,2].includes(top)?1:0,`top ${top} has only its intended undershirt`);
        assert.equal(named(root,'avatar-crop-torso').length,top===5?1:0,`top ${top} does not expose an anatomical backing plate`);
        const shells=named(root,'avatar-garment-shell'), sleeves=named(root,'avatar-garment-sleeve');
        assert.ok(shells.length>0);
        assert.equal(sleeves.length,top===5?0:2);
        const torso=new THREE.Box3();
        for(const shell of shells){
          shell.geometry.computeBoundingBox();
          torso.union(shell.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(shell.matrixWorld)));
        }
        for(const sleeve of sleeves){
          const transform=inverse.clone().multiply(sleeve.matrixWorld), points=sleeve.geometry.attributes.position;
          const start=new THREE.Vector3();
          // Twelve unique vertices on the first ring give its true centre.
          for(let i=0;i<12;i++)start.add(new THREE.Vector3().fromBufferAttribute(points,i).applyMatrix4(transform));
          start.multiplyScalar(1/12);
          assert.ok(torso.clone().expandByScalar(.006).containsPoint(start),`top ${top}/${pose} sleeve starts inside torso bounds`);
          sleeve.geometry.computeBoundingBox();
          const box=sleeve.geometry.boundingBox.clone().applyMatrix4(transform);
          assert.ok(box.max.z>=torso.max.z-.035,`top ${top}/${pose} sleeve meets torso front depth`);
        }
      }
    });
    await t.test('shoe uppers are slim, outward-facing rounded lasts with tapered toes', () => {
      for(let shoes=0;shoes<4;shoes++){
        scene.update(state({...DEFAULT_AVATAR,shoes},{guest:null}));
        const root=renderer.lastWorld.scene.getObjectByName('host-feet'), feet=[];
        root.traverse(node=>{if(node.name==='avatar-foot')feet.push(node);});
        assert.equal(feet.length,2);
        assert.ok(Math.abs(feet[0].position.z-feet[1].position.z)>.08,'foot placement is gently staggered');
        assert.ok(Math.abs(feet[0].rotation.y+feet[1].rotation.y)>.04,'toe angles are intentionally not mirrored');
        for(const foot of feet){
          const upper=foot.getObjectByName('avatar-shoe-upper'), sole=foot.getObjectByName('avatar-shoe-sole');
          upper.geometry.computeBoundingBox();sole.geometry.computeBoundingBox();
          const size=upper.geometry.boundingBox.getSize(new THREE.Vector3());
          assert.ok(size.x<.23&&size.y<.2&&size.z<.42,'upper avoids the old oversized box dimensions');
          assert.ok(sole.geometry.boundingBox.min.y>=0,'sole stays on or above ground');
          const points=upper.geometry.attributes.position,normals=upper.geometry.attributes.normal;
          let toeWidth=0,midWidth=0,normalSum=0,normalCount=0;
          for(let i=0;i<points.count;i++){
            if(points.getZ(i)>.18)toeWidth=Math.max(toeWidth,Math.abs(points.getX(i)));
            if(Math.abs(points.getZ(i))<.08)midWidth=Math.max(midWidth,Math.abs(points.getX(i)));
            if(points.getX(i)>.07){normalSum+=normals.getX(i);normalCount++;}
          }
          assert.ok(toeWidth<midWidth*.75,'toe narrows continuously rather than ending as a rectangular block');
          assert.ok(normalCount>0&&normalSum/normalCount>.25,'outward normals keep the upper front-facing');
        }
      }
    });
    await t.test('deep-skin mouth contrast improves without replacing the chosen skin colour', () => {
      for(const skin of [3,4])for(const expression of ['neutral','smile','wink','focused']){
        scene.update(state({...DEFAULT_AVATAR,skin,expression,pose:'sway'},{guest:null}));
        const root=renderer.lastWorld.scene.getObjectByName('host-feet');
        const face=root.getObjectByName('avatar-face'),mouth=root.getObjectByName('avatar-expression-mouth');
        assert.equal(face.material.color.getHexString(),skin===3?'9e624b':'68473b');
        assert.equal(mouth.material.color.getHexString(),'ebc3ad');
        const luminance=color=>.2126*color.r+.7152*color.g+.0722*color.b;
        assert.ok((luminance(mouth.material.color)+.05)/(luminance(face.material.color)+.05)>2.5,'material contrast is raised; rendered contrast still needs GPU review');
      }
    });
    await t.test('capture preserves aspect ratio and rejects a recrop', () => {
      assert.throws(() => scene.capture({ width: 1600, height: 900 }), /aspect ratio/);
      assert.deepEqual([renderer.domElement.width, renderer.domElement.height], [600, 800]);
    });
    await t.test('resize and transform changes preserve exact projected feet', () => {
      harness.container.width = 300; harness.container.height = 400;
      harness.observers[0].callback();
      const transform = { x: 14, y: 94, scale: 1.35, rotation: -20 };
      scene.update(state({}, { host: { avatar: {}, transform }, guest: null }));
      closeTo(renderer.lastWorld.people.host.x, 14);
      closeTo(renderer.lastWorld.people.host.y, 94);
      assert.equal(renderer.lastWorld.scene.getObjectByName('guest-feet'), undefined);
      assert.deepEqual([renderer.domElement.width, renderer.domElement.height], [300, 400]);
      harness.container.width = 600; harness.container.height = 800;
      harness.observers[0].callback();
    });
    await t.test('paused and reduced-motion states settle; playing schedules movement', () => {
      scene.update(state({}, { playing: false, reducedMotion: false }));
      harness.runFrame(1000);
      assert.equal(harness.raf.size, 0);
      assert.equal(renderer.lastWorld.people.host.sway, 0);
      scene.update(state({}, { playing: true, reducedMotion: true }));
      harness.runFrame(1100);
      assert.equal(harness.raf.size, 0);
      assert.equal(renderer.lastWorld.people.host.sway, 0);
      scene.update(state({}, { playing: true, reducedMotion: false }));
      harness.runFrame(1200); harness.runFrame(1240);
      assert.ok(harness.raf.size > 0);
      assert.notEqual(renderer.lastWorld.people.host.sway, 0);
      scene.update(state()); harness.runFrame(1300);
      assert.equal(harness.raf.size, 0);
    });
    await t.test('photo waits for decoding, ignores a stale image, and composites the current cover crop', async () => {
      scene.update(state({}, { scene: { kind: 'photo', dataUrl: PHOTO_A } }));
      const pendingA = scene.ready, imageA = harness.images.at(-1);
      assert.throws(() => scene.capture(), /still loading/);
      scene.update(state({}, { scene: { kind: 'photo', dataUrl: PHOTO_B } }));
      const pendingB = scene.ready, imageB = harness.images.at(-1);
      imageA.load(); await pendingA;
      assert.throws(() => scene.capture(), /still loading/, 'stale decode must not finish the new photograph');
      imageB.load(); await pendingB;
      harness.stats.composites.length = 0;
      const captured = marker(scene.capture());
      assert.deepEqual([captured.width, captured.height], [600, 800]);
      const [photoDraw, rendererDraw] = harness.stats.composites;
      assert.equal(photoDraw.args[0], imageB);
      assert.equal(rendererDraw.args[0], renderer.domElement);
      const [, x, y, width, height] = photoDraw.args;
      closeTo(width / height, 1920 / 1080);
      closeTo(x, (600 - width) / 2); closeTo(y, 0); closeTo(height, 800);
    });
    await t.test('photo failures and unsupported URLs do not export an incomplete image', async () => {
      scene.update(state({}, { scene: { kind: 'photo', dataUrl: 'blob:structure-test-broken-photo' } }));
      const brokenReady = scene.ready; harness.images.at(-1).fail(); await brokenReady;
      assert.throws(() => scene.capture(), /could not be decoded/);
      const imageCount = harness.images.length;
      scene.update(state({}, { scene: { kind: 'photo', background: 'https://example.invalid/not-authorized.jpg' } }));
      await scene.ready;
      assert.equal(harness.images.length, imageCount, 'no image/network load for unsupported URL');
      assert.throws(() => scene.capture(), /already-authorized local photo/);
      scene.update(state({}, { scene: { kind: 'photo' } }));
      assert.throws(() => scene.capture(), /resolved local photograph/);
    });
    await t.test('dispose is idempotent, releases observed geometry/listeners, and ignores a late image', async () => {
      scene.update(state({}, { scene: { kind: 'photo', dataUrl: PHOTO_A } }));
      const pending = scene.ready, lateImage = harness.images.at(-1);
      scene.dispose(); scene.dispose();
      const calls = harness.stats.renderCalls;
      lateImage.load(); await pending;
      scene.update(state());
      assert.equal(harness.stats.renderCalls, calls);
      assert.throws(() => scene.capture(), /disposed/);
      assert.throws(() => scene.portrait({}), /disposed/);
      assert.equal(renderer.disposed, true);
      assert.equal(renderer.contextLost, true);
      assert.equal(renderer.domElement.removed, true);
      assert.equal(renderer.domElement.listenerCount(), 0);
      assert.equal(harness.document.listenerCount(), 0);
      assert.ok(harness.observers.every(observer => observer.disconnected));
      assert.equal(harness.raf.size, 0);
      assert.ok([...harness.stats.geometries.values()].every(record => record.disposed > 0), 'all observed geometry is disposed');
    });
    t.diagnostic('v2 coverage: 36 top/bottom pairs, 48 hair/eyewear pairs, 24 accessory/expression pairs, 24 independent colour choices, and all cap/hair combinations');
    t.diagnostic(`Structure only: ${harness.stats.geometries.size} finite geometries, ${harness.stats.verticesChecked} vertices, ${harness.stats.renderCalls} mock render calls; no GPU or pixel validation`);
    t.diagnostic(`Existing vendor r186 flatShading warnings observed: ${harness.stats.knownVendorWarnings}`);
  } finally {
    scene?.dispose();
    harness.restore();
  }
});

test('Blender venue replaces only static scenery, retains dynamic people/photos and restores cutaway',async()=>{
 const harness=makeHarness();let engine;
 try{
  harness.container.width=390;harness.container.height=844;
  const {mountLivehouseScene}=await instrumentedModule();
  const data=await readFile(new URL('../web/event-room/assets/venue-r1/venue.glb',import.meta.url));
  engine=mountLivehouseScene(harness.container,{venueAssetUrl:'data:model/gltf-binary;base64,'+data.toString('base64'),people:[{id:'independent-person',name:'Synthetic',character:'illustrated',avatar:DEFAULT_AVATAR,position:[-.8,0,1.8]}],photos:[],reducedMotion:true});
  await engine.ready;
  const renderer=harness.renderers[0],scene=renderer.lastScene,info=engine.getState();
  assert.equal(info.scene.venueAsset.status,'ready');assert.equal(info.scene.venueAsset.id,'blender-venue-r2');assert.equal(info.scene.venueAsset.triangles,19728);
  assert.equal(info.scene.peopleCount,1);assert.equal(info.scene.photoFrameCount,6);assert.ok(scene.getObjectByName('directional-illustrated-person'));
  assert.equal(scene.getObjectByName('livehouse-floor').visible,false);assert.ok(scene.getObjectByName('MS_VENUE_ROOT').visible);
  const gallery=scene.getObjectByName('livehouse-gallery');assert.ok(gallery.visible);assert.ok(gallery.position.distanceTo(new THREE.Vector3(6.795,2.64,-1.8))<.001);
  engine.update({photos:[{id:'authorized-1',url:PHOTO_A}]});harness.images.at(-1).load();assert.equal(engine.getPhotoPreviews()[0].id,'authorized-1');
  await engine.goTo('photos');assert.equal(scene.getObjectByName('MS_FOREGROUND_CUTAWAY').visible,false);assert.ok(gallery.visible);const point=new THREE.Vector3(0,.045,.079).applyMatrix4(gallery.children[0].matrixWorld).project(renderer.lastCamera);assert.deepEqual(engine.pick((point.x+1)*195,(1-point.y)*422),{id:'authorized-1',kind:'photo',label:'查看现场照片'});
  await engine.goTo('overview');assert.equal(scene.getObjectByName('MS_FOREGROUND_CUTAWAY').visible,true);assert.equal(scene.getObjectByName('livehouse-foreground-truss').visible,false,'old truss must not reappear after model replacement');
  engine.update({photos:[]});assert.deepEqual(engine.getPhotoPreviews(),[]);
  harness.container.width=1365;harness.container.height=900;
  const positions=memberFloorPositions(8,false);engine.update({people:positions.map((position,i)=>({id:'member-'+i,name:'Synthetic '+i,character:'illustrated',avatar:DEFAULT_AVATAR,position}))});engine.resize();
  const projected=engine.getHotspots().filter(p=>p.kind==='person').sort((a,b)=>a.x-b.x);assert.equal(projected.length,8);assert.ok(projected.every(p=>p.visible&&p.x>.04&&p.x<.96));for(let i=1;i<8;i++)assert.ok(projected[i].x-projected[i-1].x>.045);
  const people=[];scene.traverse(n=>{if(n.userData.hotspot?.kind==='person')people.push(n);});assert.equal(people.length,8);
  await engine.goTo('person','member-5');assert.deepEqual(people.filter(p=>p.visible).map(p=>p.userData.hotspot.id),['member-5']);assert.equal(engine.getState().scene.peopleCount,8,'portrait selection never removes real members');
  await engine.goTo('overview');assert.equal(people.filter(p=>p.visible).length,8);
  engine.update({photos:[0,1,2,3].map(i=>({id:'desktop-photo-'+i,url:PHOTO_A}))});harness.images.slice(-4).forEach(image=>image.load());await engine.goTo('photos');
  assert.equal(new Set(gallery.children.slice(0,4).map(f=>f.position.x)).size,2,'four prints share two balanced columns');
  assert.equal(new Set(gallery.children.slice(0,4).map(f=>f.position.y)).size,2);
  assert.ok(scene.getObjectByName('livehouse-hanging-stage-print').visible,'a local physical hanging print is added in front of the curtain');
  const cutaway=scene.getObjectByName('MS_FOREGROUND_CUTAWAY');assert.equal(cutaway.children.length,3,'right PA and two trims are now real independent semantic meshes');
  for(const [w,h] of [[320,568],[390,844],[1365,900]])for(const count of[2,4,6]){
   harness.container.width=w;harness.container.height=h;engine.resize();
   engine.update({photos:Array.from({length:count},(_,i)=>({id:`wall-${w}-${count}-${i}`,url:PHOTO_A}))});harness.images.slice(-count).forEach(image=>image.load());await engine.goTo('photos');
   assert.equal(cutaway.visible,false);
   for(let i=0;i<count;i++){
    const point=new THREE.Vector3(0,.045,.079).applyMatrix4(gallery.children[i].matrixWorld).project(renderer.lastCamera);assert.equal(engine.pick((point.x+1)*w/2,(1-point.y)*h/2)?.id,`wall-${w}-${count}-${i}`,'the visible photo ray must not be blocked by hidden PA or trim geometry');
    for(const x of[-.483,.483])for(const y of[-.643,.643]){const edge=new THREE.Vector3(x,y,.04).applyMatrix4(gallery.children[i].matrixWorld).project(renderer.lastCamera);const px=(edge.x+1)*w/2,py=(1-edge.y)*h/2;assert.ok(px>10&&px<w-10&&py>75&&py<h-154,`frame stays inside reading area: ${w}x${h}/${count}: ${px},${py}`);}
   }
   await engine.goTo('overview');assert.equal(cutaway.visible,true);
  }
 }finally{engine?.dispose();harness.restore();}
});

test('livehouse people-only updates reuse wall textures until an explicit photo clear',async()=>{
 const harness=makeHarness();let engine;
 try{
  const {mountLivehouseScene}=await instrumentedModule(),photos=[{id:'authorized-1',url:PHOTO_A},{id:'authorized-2',url:PHOTO_B}];
  engine=mountLivehouseScene(harness.container,{people:[],photos,reducedMotion:true});
  harness.images.forEach(image=>image.load());
  const gallery=harness.renderers[0].lastScene.getObjectByName('livehouse-gallery');
  const surfaces=gallery.children.slice(0,2).map(frame=>frame.children.find(node=>node.geometry?.type==='PlaneGeometry').material),textures=surfaces.map(material=>material.map);
  let disposals=0;textures.forEach(texture=>texture.addEventListener('dispose',()=>disposals++));
  const photoDecodeCount=()=>harness.images.filter(image=>[PHOTO_A,PHOTO_B].includes(image.source)).length;
  assert.equal(photoDecodeCount(),2);
  engine.update({people:[{id:'viewer',avatar:DEFAULT_AVATAR,character:'illustrated',position:[0,0,1]}]});
  engine.update({photos});engine.resize();
  assert.equal(photoDecodeCount(),2,'unchanged photos never start another decode');
  assert.ok(surfaces.every((material,i)=>material.map===textures[i]),'the exact texture objects remain attached');
  assert.equal(disposals,0);
  engine.update({photos:[]});
  assert.equal(disposals,2,'explicit permission or room clearing still disposes both textures');
  assert.ok(surfaces.every(material=>material.map===null));assert.deepEqual(engine.getPhotoPreviews(),[]);
 }finally{engine?.dispose();harness.restore();}
});

test('livehouse resize preserves working targets at the same size and reallocates once at the final size',async()=>{
 const harness=makeHarness();let engine;
 try{
  harness.container.width=390;harness.container.height=844;
  const {mountLivehouseScene}=await instrumentedModule();
  engine=mountLivehouseScene(harness.container,{people:[],photos:[],reducedMotion:true});
  const targets=[...harness.stats.renderTargets],disposals=()=>targets.reduce((sum,[,record])=>sum+record.disposed,0);
  assert.equal(targets.length,3);
  assert.ok(targets.every(([target])=>target.width===780&&target.height===1688),'phone sampling remains 2×');
  const before=disposals();
  engine.resize();harness.observers[0].callback();
  assert.equal(disposals(),before,'same-size resize and observer notification retain all targets');
  harness.container.width=1440;harness.container.height=900;engine.resize();
  assert.equal(disposals()-before,3,'one disposal per target when final working dimensions change');
  assert.ok(targets.every(([target])=>target.width===2000&&target.height===1250),'desktop retains the 2.5 million pixel budget');
  const after=disposals();engine.resize();assert.equal(disposals(),after);
 }finally{engine?.dispose();harness.restore();}
});

test('rejected venue leaves the existing real room usable and reports a fallback',async()=>{
 const harness=makeHarness();let engine;
 try{
  const {mountLivehouseScene}=await instrumentedModule(),errors=[];
  engine=mountLivehouseScene(harness.container,{venueAssetUrl:'data:model/gltf-binary;base64,AA==',people:[],photos:[],onVenueError:e=>errors.push(e),reducedMotion:true});
  await engine.ready;assert.equal(engine.getState().scene.venueAsset.status,'fallback');assert.equal(errors.length,1);
  assert.ok(harness.renderers[0].lastScene.getObjectByName('livehouse-floor').visible);assert.equal(engine.getState().scene.peopleCount,0);
  assert.equal(await engine.goTo('photos'),true);assert.equal(await engine.goTo('overview'),true);
 }finally{engine?.dispose();harness.restore();}
});


test('livehouse: real world-space geometry and perspective-camera mechanics, mocked pixels only',async t=>{
  const harness=makeHarness();let engine;
  try{
    harness.container.width=390;harness.container.height=565;
    const {mountLivehouseScene}=await instrumentedModule();
    const changes=[],projections=[];
    engine=mountLivehouseScene(harness.container,{reducedMotion:false,onViewChange:value=>changes.push(value),onHotspots:value=>projections.push(value)});
    await engine.ready;
    const renderer=harness.renderers[0];let time=1000;
    const step=(frames=22)=>{for(let i=0;i<frames&&harness.raf.size;i++)harness.runFrame(time+=60);};
    step();
    await t.test('modeled room has real depth, three independent people and six physical frames',()=>{
      const state=engine.getState();
      assert.equal(state.camera.type,'PerspectiveCamera');assert.equal(state.camera.projection,'perspective');
      assert.equal(harness.stats.knownVendorWarnings,0,'live r186 adapter does not pass unsupported material constructor properties');
      assert.equal(renderer.shadowMap.type,THREE.PCFShadowMap,'live scene uses the supported shadow-map type');
      assert.equal(renderer.domElement.style.pointerEvents,'auto','real model raycast clicks can reach the live canvas');
      assert.equal(state.scene.peopleCount,3);assert.equal(state.scene.photoFrameCount,6);
      assert.ok(state.scene.roomMeshCount>150);assert.ok(state.scene.depthSpan>10);
      assert.equal(state.scene.usesRoomImage,false);assert.ok(renderer.lastScene.background.isColor);
      assert.equal(harness.images.length,0,'the room never loads the generated reference image or any image URL');
      for(const name of['livehouse-floor','livehouse-stage','livehouse-back-wall','livehouse-photo-wall','livehouse-gallery'])assert.ok(renderer.lastScene.getObjectByName(name),name);
      const worldPositions=['azhe','xiaoyu','linjian'].map(id=>renderer.lastScene.getObjectByName(`live-${id}-feet`).position.toArray());
      assert.equal(new Set(worldPositions.map(JSON.stringify)).size,3);
      assert.ok(worldPositions[2][1]>.6,'one figure stands on the modeled stage');
      const hotspots=engine.getHotspots();
      assert.deepEqual(hotspots.map(item=>item.id),['azhe','xiaoyu','linjian','photos']);
      for(const point of hotspots){assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.y));assert.equal(typeof point.visible,'boolean');}
      t.diagnostic(`390×565 overview hotspot projection: ${JSON.stringify(hotspots.map(({id,x,y,visible})=>({id,x:+x.toFixed(3),y:+y.toFixed(3),visible})))}`);
    });
    await t.test('person transition moves the perspective camera while all world meshes stay in place',async()=>{
      const before=engine.getState();
      const person=renderer.lastScene.getObjectByName('live-xiaoyu-feet');
      const matrix=person.matrixWorld.elements.slice();
      const completed=engine.goTo('person','xiaoyu');assert.equal(engine.getState().moving,true);
      step(6);const intermediate=engine.getState();
      assert.equal(intermediate.view,'person');assert.equal(intermediate.id,'xiaoyu');
      assert.notDeepEqual(intermediate.camera.position,before.camera.position);
      assert.equal(intermediate.moving,true);
      assert.deepEqual(person.matrixWorld.elements,matrix,'camera travel does not translate/scale the model');
      step(24);assert.equal(await completed,true);
      const after=engine.getState();assert.equal(after.moving,false);assert.equal(after.camera.fov,43);
      assert.notDeepEqual(after.camera.target,before.camera.target);assert.deepEqual(person.matrixWorld.elements,matrix);
      const point=engine.getHotspots().find(point=>point.id==='xiaoyu');
      assert.ok(point.x>.2&&point.x<.8&&point.y>.1&&point.y<.45,'person anchor leaves room below for the reading panel');
      assert.ok(changes.some(change=>change.id==='xiaoyu'&&change.moving));
      assert.ok(changes.some(change=>change.id==='xiaoyu'&&!change.moving));
    });
    await t.test('photo view changes camera position/orientation and exposes the exact wall-print textures',async()=>{
      const before=engine.getState();const complete=engine.goTo('photos');step(24);assert.equal(await complete,true);
      const after=engine.getState();assert.equal(after.view,'photos');assert.equal(after.id,null);
      assert.notDeepEqual(after.camera.position,before.camera.position);assert.notDeepEqual(after.camera.target,before.camera.target);
      const anchor=engine.getHotspots().find(point=>point.kind==='photos');
      assert.ok(anchor.visible);assert.ok(anchor.y>.15&&anchor.y<.5);
      const previews=engine.getPhotoPreviews();assert.equal(previews.length,6);
      for(const photo of previews){const image=marker(photo.url);assert.deepEqual([image.width,image.height],[512,640]);assert.ok(photo.id&&photo.label);}
      assert.equal(new Set(previews.map(photo=>photo.url)).size,6,'each preview references its actual individual texture canvas');
      assert.deepEqual([marker(engine.capture()).width,marker(engine.capture()).height],[390,565]);
    });
    await t.test('camera transitions interrupt smoothly and reduced motion settles the current destination',async()=>{
      const interrupted=engine.goTo('person','azhe');step(5);
      const atInterrupt=engine.getState().camera.position;
      const latest=engine.goTo('overview');assert.deepEqual(engine.getState().camera.position,atInterrupt,'interrupt does not jump to another shot first');
      assert.equal(await interrupted,false);step(25);assert.equal(await latest,true);
      const settle=engine.goTo('person','linjian');step(3);engine.setReducedMotion(true);assert.equal(await settle,true);
      assert.equal(engine.getState().moving,false);assert.equal(engine.getState().id,'linjian');
      assert.equal(await engine.goTo('photos'),true);assert.equal(engine.getState().moving,false);
      assert.equal(engine.getState().scene.peopleCount,3,'a partial preference update preserves people and callbacks');
      assert.equal(await engine.goTo('person','missing'),false);
    });
    await t.test('photo reading cutaway hides foreground occluders and restores actual people on return',async()=>{
      engine.setReducedMotion(true);await engine.goTo('photos');
      assert.equal(renderer.lastScene.getObjectByName('livehouse-foreground-truss').visible,false);
      assert.equal(renderer.lastScene.getObjectByName('live-azhe-feet').visible,false);
      assert.ok(renderer.lastScene.getObjectByName('livehouse-gallery').visible,'actual3D gallery remains the reading target');
      await engine.goTo('overview');
      assert.equal(renderer.lastScene.getObjectByName('livehouse-foreground-truss').visible,true);
      assert.equal(renderer.lastScene.getObjectByName('live-azhe-feet').visible,true);
    });
    await t.test('hotspot raycast identifies the actual photo-wall meshes',async()=>{
      engine.setReducedMotion(true);await engine.goTo('photos');
      // The wall label sits in the gap between rows. Pick the real centre of
      // a frame instead; empty wall space is intentionally not a photo mesh.
      const gallery=renderer.lastScene.getObjectByName('livehouse-gallery');
      const point=new THREE.Vector3(0,.045,.079).applyMatrix4(gallery.children[4].matrixWorld).project(renderer.lastCamera);
      const hit=engine.pick((point.x+1)*195,(1-point.y)*282.5);
      assert.equal(hit?.kind,'photos');assert.equal(hit?.id,'photos');
    });
    await t.test('real room roster uses the new sculpted identity and no fictional fallback when empty',async()=>{
      engine.update({people:[{id:'actual-member',name:'Independent attendee',avatar:{...DEFAULT_AVATAR,eyewear:0},character:'editorial',position:[0,0,1],scale:1}],photos:[]});
      const model=renderer.lastScene.getObjectByName('musicspace-editorial-benchmark');assert.ok(model);assert.equal(model.userData.benchmark.appearance.eyewear,false);
      assert.equal(model.getObjectByName('eyewear').visible,false);
      assert.equal(engine.getState().scene.peopleCount,1);assert.deepEqual(engine.getHotspots().map(p=>p.id),['actual-member','photos']);
      assert.deepEqual(engine.getPhotoPreviews(),[]);assert.ok(renderer.lastScene.getObjectByName('livehouse-gallery').children.every(f=>!f.visible));
      await engine.goTo('person','actual-member');engine.update({people:[]});assert.equal(engine.getState().view,'overview');assert.equal(engine.getState().scene.peopleCount,0);
    });
    await t.test('authorized local photographs cannot reappear after a room or permission clear',()=>{
      engine.update({photos:[{id:'authorized-photo',url:PHOTO_A,label:'Real photo'}]});const pending=harness.images.at(-1);
      engine.update({photos:[]});assert.equal(pending.source,null,'cancel decoder before caller retires its blob URL');assert.equal(pending.onload,null);assert.equal(pending.onerror,null);pending.load();assert.deepEqual(engine.getPhotoPreviews(),[]);
      engine.update({photos:[{id:'second',url:PHOTO_B,label:'Second'}]});harness.images.at(-1).load();assert.equal(engine.getPhotoPreviews()[0].id,'second');
      engine.update({photos:[{id:'external',url:'https://example.invalid/private.jpg'}]});assert.deepEqual(engine.getPhotoPreviews(),[]);
    });
    await t.test('livehouse disposal settles pending camera work and releases all observed resources',async()=>{
      engine.setReducedMotion(false);const move=engine.goTo('overview');
      engine.dispose();engine.dispose();assert.equal(await move,false);
      assert.equal(harness.raf.size,0);assert.equal(renderer.disposed,true);
      assert.equal(harness.document.listenerCount(),0);assert.ok([...harness.stats.geometries.values()].every(record=>record.disposed>0));
      assert.throws(()=>engine.capture(),/disposed/);
    });
    t.diagnostic('Perspective transforms, spatial meshes, projection and lifecycle only. GPU appearance and readable composition require the separate real-browser screenshots.');
  }finally{engine?.dispose();harness.restore();}
});
