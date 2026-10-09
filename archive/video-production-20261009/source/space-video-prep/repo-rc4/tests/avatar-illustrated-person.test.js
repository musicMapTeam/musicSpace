import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import * as THREE from 'three';
import { DEFAULT_AVATAR } from '../web/avatar/model.js';
import { renderAvatarSvg } from '../web/illustrated-avatar/index.js';

const source = readFileSync(new URL('../web/event-room/illustrated-person.js', import.meta.url), 'utf8');
const WIDTH = 480, HEIGHT = 1000, DIRECTIONS = ['front', 'quarter', 'side', 'back'];
const angles = { front: 0, quarter: .6, side: 1.5, back: 2.5 };
const pattern = (direction, x, y) => (DIRECTIONS.indexOf(direction) * 53 + x + y * 7) & 255;
const uvAt = (x, y) => ({ x: (x + .5) / WIDTH, y: 1 - (y + .5) / HEIGHT });

// Real Three geometry/material/texture objects; only image decoding and canvas pixels
// are synthetic. These checks do not render or make GPU/visual acceptance claims.
function harness(alphaAt = pattern) {
  const images = [], canvases = [], textures = [], blobs = new Map(), revoked = [];
  const masks = [], maskBuffers = [], maskBytes = [], rgba = [], rgbaBuffers = [], readbacks = [];
  let loads = 0;
  class TrackedUint8Array extends Uint8Array {
    constructor(...args) {
      super(...args);
      masks.push(new WeakRef(this)); maskBuffers.push(new WeakRef(this.buffer)); maskBytes.push(this.byteLength);
    }
  }
  class Image {
    constructor() { this.direction = DIRECTIONS[images.length]; images.push(this); }
  }
  const document = {
    createElement(tag) {
      assert.equal(tag, 'canvas');
      const canvas = { width: 0, height: 0, getContext(type, options) {
        assert.equal(type, '2d'); assert.equal(options.willReadFrequently, true);
        return {
          drawImage(image, x, y, width, height) {
            assert.deepEqual([x, y, width, height], [0, 0, WIDTH, HEIGHT]);
            canvas.direction = image.direction;
          },
          getImageData(x, y, width, height) {
            readbacks.push([x, y, width, height]);
            const data = new Uint8ClampedArray(width * height * 4);
            for (let index = 0; index < width * height; index++) {
              data[index * 4] = 255; data[index * 4 + 1] = index & 255; data[index * 4 + 2] = 88;
              data[index * 4 + 3] = alphaAt(canvas.direction, index % width, Math.floor(index / width));
            }
            rgba.push(new WeakRef(data)); rgbaBuffers.push(new WeakRef(data.buffer));
            return { data };
          },
        };
      } };
      canvases.push(canvas); return canvas;
    },
  };
  class CanvasTexture extends THREE.CanvasTexture {
    constructor(canvas) { super(canvas); textures.push(this); }
  }
  const context = vm.createContext({
    Image, document, Blob, Uint8Array: TrackedUint8Array, renderAvatarSvg,
    URL: {
      createObjectURL(blob) { const url = `blob:synthetic-${blobs.size}`; blobs.set(url, blob); return url; },
      revokeObjectURL(url) { revoked.push(url); },
    },
  });
  vm.runInContext(source.replace(/^import .*;$/gm, '').replace('export function createIllustratedPerson', 'function createIllustratedPerson') + '\nglobalThis.create = createIllustratedPerson;', context);
  const person = context.create({ ...THREE, CanvasTexture }, DEFAULT_AVATAR, { onLoad() { loads++; } });
  const plane = person.body.children[0], shadow = person.root.children[1];
  return {
    person, plane, shadow, images, canvases, textures, blobs, revoked, masks, maskBuffers, maskBytes, rgba, rgbaBuffers, readbacks,
    get loads() { return loads; },
    load(direction) { images[DIRECTIONS.indexOf(direction)].onload(); },
    fail(direction) { images[DIRECTIONS.indexOf(direction)].onerror(); },
    loadAll() { for (const direction of DIRECTIONS) this.load(direction); },
    face(relative) {
      const world = person.root.getWorldPosition(new THREE.Vector3()), angle = person.root.rotation.y + relative;
      const camera = new THREE.PerspectiveCamera();
      camera.position.set(world.x + Math.sin(angle) * 10, world.y + 4, world.z + Math.cos(angle) * 10);
      person.updateFacing(camera); return camera;
    },
  };
}

function legacySample(direction, uv, alphaAt = pattern) {
  if (!uv) return true;
  const x = Math.min(WIDTH - 1, Math.max(0, Math.floor(uv.x * WIDTH)));
  const y = Math.min(HEIGHT - 1, Math.max(0, Math.floor((1 - uv.y) * HEIGHT)));
  return Number.isNaN(x) || Number.isNaN(y) ? false : alphaAt(direction, x, y) > 88;
}

async function collected(refs, message) {
  for (let attempt = 0; attempt < 12; attempt++) {
    await new Promise(resolve => setImmediate(resolve));
    global.gc();
    if (refs.every(ref => ref.deref() === undefined)) return;
  }
  assert.fail(message);
}

if (process.argv.includes('--memory-probe')) {
  assert.equal(typeof global.gc, 'function');
  const h = harness();
  h.loadAll();
  assert.deepEqual(h.maskBytes, [480000, 480000, 480000, 480000]);
  await collected([...h.rgba, ...h.rgbaBuffers], 'temporary RGBA arrays and backing buffers must be collectable while the person is alive');
  assert.ok(h.masks.every(ref => ref.deref()), 'all four direction masks remain while the person is alive');
  const activeSampler = h.plane.userData.alphaAt;
  h.person.dispose();
  assert.equal(activeSampler(uvAt(200, 0)), false);
  await collected([...h.masks, ...h.maskBuffers], 'dispose must release every mask even if a caller retained the previous sampler');
  // Retain all scene/image/texture objects through the assertions so GC cannot
  // pass merely by dropping the complete person or its callback closure.
  assert.equal(h.images.length, 4); assert.equal(h.textures.length, 4); assert.equal(h.plane.visible, false);
  process.stdout.write('RGBA and disposed alpha buffers collected\n');
} else {
  test('four unchanged SVG/CanvasTextures retain exactly one alpha byte per source pixel', async () => {
    const h = harness();
    h.loadAll();
    assert.deepEqual(h.maskBytes, DIRECTIONS.map(() => WIDTH * HEIGHT));
    const retainedBytes = h.maskBytes.reduce((total, bytes) => total + bytes, 0);
    assert.equal(retainedBytes, 1920000);
    assert.equal(retainedBytes / (4 * WIDTH * HEIGHT * 4), .25, '75% reduction is only the CPU picking buffers');
    assert.equal(h.loads, 4); assert.equal(h.textures.length, 4);
    for (const [index, direction] of DIRECTIONS.entries()) {
      const blob = [...h.blobs.values()][index];
      assert.equal(blob.type, 'image/svg+xml');
      assert.equal(await blob.text(), renderAvatarSvg(DEFAULT_AVATAR, { view: direction, width: WIDTH, height: HEIGHT }));
      const texture = h.textures[index];
      assert.ok(texture instanceof THREE.CanvasTexture);
      assert.equal(texture.image, h.canvases[index]);
      assert.equal(texture.image.width, WIDTH); assert.equal(texture.image.height, HEIGHT);
      assert.equal(texture.colorSpace, THREE.SRGBColorSpace); assert.equal(texture.anisotropy, 4);
      assert.deepEqual(h.readbacks[index], [0, 0, WIDTH, HEIGHT]);
    }
    assert.equal(h.plane.geometry.parameters.width, 1.5552); assert.equal(h.plane.geometry.parameters.height, 3.24);
    assert.equal(h.plane.position.y, 1.48);
    assert.equal(h.plane.material.alphaTest, .35); assert.equal(h.plane.material.transparent, false);
    assert.equal(h.plane.material.side, THREE.DoubleSide);
    assert.equal(h.plane.material.depthTest, true); assert.equal(h.plane.material.depthWrite, true);
    h.person.dispose();
  });

  test('all alpha values 0–255 preserve the strict >88 hit threshold in each direction', () => {
    const h = harness((_direction, x) => x & 255); h.loadAll();
    for (const direction of DIRECTIONS) {
      h.face(angles[direction]);
      for (let alpha = 0; alpha <= 255; alpha++) {
        assert.equal(h.plane.userData.alphaAt(uvAt(alpha, 321)), alpha > 88, `${direction}, alpha ${alpha}`);
      }
    }
    h.person.dispose();
  });

  test('UV flooring, vertical flip, edge clamping and missing UV match the original sampler', () => {
    const h = harness(); h.loadAll();
    const xs = [-Infinity, -2, -Number.EPSILON, 0, .5 / WIDTH, 1 / WIDTH, 1 / WIDTH - Number.EPSILON, .49, .999, 1, 2, Infinity, NaN];
    const ys = [-Infinity, -2, 0, .5 / HEIGHT, .3, 1 - 1 / HEIGHT, 1 - 1 / HEIGHT + Number.EPSILON, 1, 2, Infinity, NaN];
    for (const direction of DIRECTIONS) {
      h.face(angles[direction]);
      for (const x of xs) for (const y of ys) {
        const uv = { x, y };
        assert.equal(h.plane.userData.alphaAt(uv), legacySample(direction, uv), `${direction}: ${x}, ${y}`);
      }
      assert.equal(h.plane.userData.alphaAt(), true); assert.equal(h.plane.userData.alphaAt(null), true);
    }
    h.person.dispose();
  });

  test('direction boundaries, camera facing, translated roots and mirroring remain unchanged', () => {
    const h = harness(); h.loadAll();
    h.person.root.position.set(4, -2, 6); h.person.root.rotation.y = .63;
    for (const relative of [0, .289999, .290001, 1.099999, 1.100001, 2.049999, 2.050001, Math.PI - .000001]) {
      for (const sign of [1, -1]) {
        const camera = h.face(relative * sign);
        const expected = relative < .29 ? 'front' : relative < 1.1 ? 'quarter' : relative < 2.05 ? 'side' : 'back';
        assert.equal(h.plane.material.map.image.direction, expected);
        assert.equal(h.plane.scale.x, relative > 0 && sign < 0 ? -1 : 1);
        const angle = Math.atan2(camera.position.x - 4, camera.position.z - 6);
        assert.ok(Math.abs(h.person.body.rotation.y - (angle - .63)) < 1e-12);
        assert.equal(h.plane.userData.alphaAt(uvAt(88, 18)), legacySample(expected, uvAt(88, 18)));
      }
    }
    h.person.dispose();
  });

  test('actual Three raycast UVs follow the mirrored plane without a second alpha-mask flip', () => {
    const h = harness((_direction, x) => x < WIDTH / 2 ? 255 : 0); h.loadAll();
    for (const sign of [1, -1]) {
      h.face(sign * .6); h.person.root.updateMatrixWorld(true);
      const target = h.person.body.localToWorld(new THREE.Vector3(1.5552 / 4, 1.48, 0));
      const normal = new THREE.Vector3(0, 0, 1).transformDirection(h.plane.matrixWorld);
      const ray = new THREE.Raycaster(target.clone().addScaledVector(normal, 5), normal.clone().negate());
      const hit = ray.intersectObject(h.plane, false)[0];
      assert.ok(hit); assert.ok(Math.abs(hit.uv.x - (sign > 0 ? .75 : .25)) < 1e-6);
      assert.equal(h.plane.userData.alphaAt(hit.uv), sign < 0);
    }
    h.person.dispose();
  });

  test('untextured plane stays hidden until the selected direction is loaded', () => {
    const h = harness();
    assert.equal(h.plane.visible, false); assert.equal(h.plane.material.map, null);
    h.face(.6); h.load('front');
    assert.equal(h.plane.visible, false, 'a different plate completing must not expose an untextured rectangle');
    h.load('quarter');
    assert.equal(h.plane.visible, true); assert.equal(h.plane.material.map.image.direction, 'quarter');
    h.face(2.5); h.fail('back');
    assert.equal(h.plane.material.map.image.direction, 'quarter', 'existing loaded plate remains when a later direction fails');
    h.person.dispose();
  });

  test('failed initial images never expose the untextured plane and revoke their URLs', () => {
    const h = harness();
    for (const direction of DIRECTIONS) h.fail(direction);
    assert.equal(h.plane.visible, false); assert.equal(h.plane.material.map, null);
    assert.equal(h.textures.length, 0); assert.equal(h.maskBytes.length, 0); assert.equal(h.loads, 0);
    assert.deepEqual(new Set(h.revoked), new Set(h.blobs.keys()));
    h.person.dispose();
  });

  test('dispose before image completion prevents late callbacks from creating textures or reviving the plane', () => {
    const h = harness(); h.person.dispose();
    assert.deepEqual(new Set(h.revoked), new Set(h.blobs.keys()));
    h.load('front'); h.load('quarter'); h.fail('side'); h.load('back'); h.face(2.5);
    assert.equal(h.plane.visible, false); assert.equal(h.plane.material.map, null);
    assert.equal(h.plane.userData.alphaAt, undefined);
    assert.equal(h.textures.length, 0); assert.equal(h.canvases.length, 0); assert.equal(h.maskBytes.length, 0); assert.equal(h.loads, 0);
  });

  test('dispose releases loaded resources once, detaches the hit mask and ignores remaining completions', () => {
    const h = harness(() => 255); h.load('front'); h.load('quarter');
    const oldSampler = h.plane.userData.alphaAt;
    const resources = [...h.textures, h.plane.geometry, h.plane.material, h.shadow.geometry, h.shadow.material];
    const disposals = resources.map(() => 0);
    resources.forEach((resource, index) => resource.addEventListener('dispose', () => disposals[index]++));
    h.person.dispose(); h.person.dispose(); h.load('side'); h.load('back'); h.face(-1.5);
    assert.deepEqual(disposals, resources.map(() => 1));
    assert.equal(h.plane.visible, false); assert.equal(h.plane.material.map, null); assert.equal(h.plane.userData.alphaAt, undefined);
    assert.equal(oldSampler(uvAt(200, 300)), false, 'even a retained previous sampler no longer accesses a mask');
    assert.equal(h.textures.length, 2); assert.equal(h.maskBytes.length, 2); assert.equal(h.loads, 2);
    assert.deepEqual(new Set(h.revoked), new Set(h.blobs.keys()));
  });

  test('temporary RGBA and disposed alpha backing buffers are actually collectable', async () => {
    const { stdout } = await promisify(execFile)(process.execPath, ['--expose-gc', fileURLToPath(import.meta.url), '--memory-probe'], { timeout: 15000 });
    assert.match(stdout, /RGBA and disposed alpha buffers collected/);
  });
}
