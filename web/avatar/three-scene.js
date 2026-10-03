import * as THREE from 'three';
import { createBenchmarkCharacter } from '../character-lab/character.js';
import { createIllustratedPerson } from '../event-room/illustrated-person.js';
import { loadBlenderVenue } from '../event-room/venue-asset.js';
import { overviewCameraLayout } from '../event-room/scene-layout.js';
import { VENUE_PRINT_PALETTE, galleryColumns, GALLERY_PRINT_ASPECT, paintStagePrint, paintGalleryPrint, stagePrintLayout } from '../event-room/venue-art.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createCelMaterials } from '../js/vendor/sakura/toon.js';
import { Pipeline } from '../js/vendor/sakura/post.js';
import { SKINS, HAIRS, GARMENT_COLORS, safeAvatar } from './model.js';

/* Original procedural Music Space set and characters. The cel ramps and depth
 * ink renderer are the existing licensed Sakura Crossing adaptation; no vendor
 * files, network assets, face photographs, or character libraries are used. */
const PALETTE = {
  ink: '#353149', dark: '#33314c', sky: '#252447', paper: '#eee3cf',
  sage: '#91ad9c', sageDark: '#567a73', clay: '#b78076', rose: '#e8afbb',
  roseLight: '#f5d0d3', roseDark: '#be829c', lilac: '#a29bbb', stone: '#8b8295',
  brass: '#bca17c', wood: '#9c7a75', sole: '#d4c7be', lamp: '#ffe3a8',
};
const UP = new THREE.Vector3(0, 1, 0);
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const validNumber = (n, fallback) => Number.isFinite(Number(n)) ? Number(n) : fallback;

/** Local Three r186 compatibility adapter for the existing Sakura cel API.
 * The ramp/tinted-band approach follows Sakura Crossing (MIT, Kenton Wang,
 * 2026). Vendor sources stay untouched. r186 no longer supports a flatShading
 * constructor option on MeshToonMaterial: geometry-owned normals deliberately
 * provide hard box faces and smooth curved surfaces instead. No warnings are
 * intercepted or suppressed here.
 */
function createLivehouseCelMaterials(){
  const ramps=new Map(),cache=new Map(),owned=new Set();
  const stops={2:[104,255],3:[104,190,255],4:[90,150,205,255],soft:[190,255],soft3:[175,220,255]};
  const ramp=(bands=3)=>{
    if(ramps.has(bands))return ramps.get(bands);
    const values=stops[bands]||stops[3],data=new Uint8Array(values.length*4);
    values.forEach((value,i)=>data.set([value,value,value,255],i*4));
    const texture=new THREE.DataTexture(data,values.length,1,THREE.RGBAFormat);
    texture.minFilter=texture.magFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.needsUpdate=true;ramps.set(bands,texture);return texture;
  };
  const create=(options={},unlit=false)=>{
    const {flat:geometryOwnsNormals,bands=3,tint='#92988f',cache:cacheable=true,depthWrite,...properties}=options;
    const key=cacheable&&!properties.map&&!properties.alphaMap?JSON.stringify([unlit,bands,tint,depthWrite,properties]):null;
    if(key&&cache.has(key))return cache.get(key);
    const material=unlit?new THREE.MeshBasicMaterial(properties):new THREE.MeshToonMaterial({...properties,gradientMap:ramp(bands)});
    if(depthWrite!==undefined&&depthWrite!==null)material.depthWrite=depthWrite;
    if(!unlit){
      const chunk=THREE.ShaderChunk.lights_toon_pars_fragment;
      const source='vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;';
      if(chunk?.includes(source)){
        const uniform={value:new THREE.Color(tint)};
        material.onBeforeCompile=shader=>{shader.uniforms.uLiveShadowTint=uniform;shader.fragmentShader=shader.fragmentShader.replace('#include <lights_toon_pars_fragment>', 'uniform vec3 uLiveShadowTint;\n'+chunk.replace(source,'vec3 band = getGradientIrradiance( geometryNormal, directLight.direction ); vec3 irradiance = band * mix( uLiveShadowTint, vec3(1.0), band ) * directLight.color;'));};
        material.customProgramCacheKey=()=>`live-cel-r186-${uniform.value.getHexString()}`;
      }
    }
    owned.add(material);if(key)cache.set(key,material);return material;
  };
  return {cel:options=>create(options),flat:options=>create(options,true),dispose(){owned.forEach(material=>material.dispose());ramps.forEach(texture=>texture.dispose());cache.clear();owned.clear();ramps.clear();}};
}

/**
 * Mount one independently-owned, captureable WebGL scene.
 * state: { scene, host:{avatar,transform}, guest:null|{avatar,transform},
 *          playing, bpm, reducedMotion }
 * For a local photograph use scene.dataUrl or scene.background (data:/blob:).
 * ready resolves when a photograph has decoded. capture() throws while it loads
 * instead of silently exporting an incomplete image. Coordinates denote feet.
 */
export function mountToonScene(container, initialState = {}) {
  if (!container?.append) throw new TypeError('A scene container is required');
  const liveMode = initialState.mode === 'livehouse';
  const renderer = new THREE.WebGLRenderer({
    alpha: true, antialias: false, stencil: false,
    preserveDrawingBuffer: true, powerPreference: 'low-power',
  });
  const canvas = renderer.domElement;
  canvas.className = 'toon-scene-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, { width: '100%', height: '100%', display: 'block', pointerEvents: liveMode?'auto':'none' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(PALETTE.sky, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = liveMode?THREE.PCFShadowMap:THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  container.append(canvas);

  const scene = new THREE.Scene();
  let camera = liveMode ? new THREE.PerspectiveCamera(43, 1, .08, 90) : new THREE.OrthographicCamera(-3, 3, 3.9, -3.9, .1, 80);
  camera.position.set(...(liveMode ? [7.6,5.5,12] : [0,7.4,15]));
  camera.lookAt(0,1.55,liveMode?-.6:0);
  camera.updateMatrixWorld();
  const set = new THREE.Group();
  const people = new THREE.Group();
  scene.add(set, people);
  const cel=liveMode?createLivehouseCelMaterials():createCelMaterials();
  const resources = { geometries: new Set(), materials: new Set(), textures: new Set() };
  const geo = g => (resources.geometries.add(g), g);
  const mat = m => (resources.materials.add(m), m);
  const colors = Object.fromEntries(Object.entries(PALETTE).map(([key, color]) => [key, cel.cel({ color, bands: key.startsWith('rose') ? 'soft3' : 3, flat: false, tint: '#827399' })]));
  const flat = color => cel.flat({ color });
  const glow = flat(PALETTE.lamp);
  const unit = {
    sphere: geo(new THREE.SphereGeometry(1, 24, 18)),
    lowSphere: geo(new THREE.IcosahedronGeometry(1, 2)),
    box: geo(new THREE.BoxGeometry(1, 1, 1)),
    round: geo(new RoundedBoxGeometry(1, 1, 1, 3, .13)),
    cylinder: geo(new THREE.CylinderGeometry(1, 1, 1, 20)),
    plane: geo(new THREE.PlaneGeometry(1, 1)),
    ring: geo(new THREE.TorusGeometry(1, .018, 6, 48)),
  };
  function mesh(g, m, at = [0, 0, 0], scale = [1, 1, 1], parent = set) {
    const o = new THREE.Mesh(g, m); o.position.set(...at); o.scale.set(...scale);
    o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
  }
  const ball = (p, s, m, parent) => mesh(unit.sphere, m, p, s, parent);
  const box = (p, s, m, parent) => mesh(unit.box, m, p, s, parent);
  const round = (p, s, m, parent) => mesh(unit.round, m, p, s, parent);
  const cylinder = (p, s, m, parent) => mesh(unit.cylinder, m, p, s, parent);
  const group = (parent = set, at = [0, 0, 0]) => { const o = new THREE.Group(); o.position.set(...at); parent.add(o); return o; };
  const noShadow = o => { o.castShadow = false; return o; };
  function rod(a, b, radius, m, parent = set) {
    const v = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const o = cylinder(v.clone().add(end).multiplyScalar(.5).toArray(), [radius, v.distanceTo(end), radius], m, parent);
    o.quaternion.setFromUnitVectors(UP, end.sub(v).normalize()); return o;
  }
  function curve(points, radius, m, parent = set, segments = 20) {
    const path = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    return mesh(geo(new THREE.TubeGeometry(path, segments, radius, 7, false)), m, [0, 0, 0], [1, 1, 1], parent);
  }
  function lathe(profile, m, parent, at = [0, 0, 0]) {
    return mesh(geo(new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(...p)), 32)), m, at, [1, 1, 1], parent);
  }
  const warm = new THREE.HemisphereLight(liveMode?'#ece5c9':'#d4d4f5',liveMode?'#826749':'#8e718d',liveMode?1.05:1.2);
  const moon = new THREE.DirectionalLight(liveMode?'#f0e1bd':'#c8d5ff',liveMode?.9:1.1);
  moon.position.set(-4.5, 8, 5); moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  Object.assign(moon.shadow.camera, { left: -8, right: 8, top: 10, bottom: -8, near: .5, far: 32 });
  moon.shadow.bias = -.0006; moon.shadow.normalBias = .018;
  const fill = new THREE.DirectionalLight('#ffc798', .52); fill.position.set(4, 4, 7);
  const poolA = new THREE.PointLight('#ffcd96', 15, 9, 2); poolA.position.set(-2.3, 3.2, 1);
  const poolB = new THREE.PointLight('#ffc68d', 12, 8, 2); poolB.position.set(2.8, 2.8, -2);
  scene.add(warm, moon, fill, poolA, poolB);

  const pipeline = new Pipeline(renderer, scene, camera, { pixelBudget: 1900000, maxPixelRatio: 1.65 });
  if(liveMode){
    // A small phone canvas can afford 2× offscreen sampling. Keep canvas/export
    // dimensions unchanged, cap total working pixels, and leave vendor code and
    // the original avatar workspace resolution policy untouched.
    let outputWidth=0,outputHeight=0;
    pipeline.setSize=(w,h)=>{
      const scale=Math.min(2,Math.sqrt(2500000/(w*h)));
      const rw=Math.max(2,Math.floor(w*scale)),rh=Math.max(2,Math.floor(h*scale));
      if(w!==outputWidth||h!==outputHeight){renderer.setPixelRatio(1);renderer.setSize(w,h,true);outputWidth=w;outputHeight=h;}
      pipeline.scale=scale;
      // Configure the final targets directly: passing through the vendor's
      // different sampling budget disposed every target twice on each resize.
      if(pipeline.size.x!==rw||pipeline.size.y!==rh){
        pipeline.size.set(rw,rh);
        pipeline.rtScene.setSize(rw,rh);pipeline.rtA.setSize(rw,rh);pipeline.rtB.setSize(rw,rh);
      }
      pipeline.ink.mat.uniforms.uTexel.value.set(1/rw,1/rh);pipeline.fxaa.mat.uniforms.uTexel.value.set(1/rw,1/rh);
      pipeline.ink.mat.uniforms.uNear.value=pipeline.camera.near;
      pipeline.ink.mat.uniforms.uFar.value=pipeline.camera.far;
      pipeline.ink.mat.uniforms.uOrthographic.value=pipeline.camera.isOrthographicCamera===true;
      pipeline.ink.mat.uniforms.uThickness.value=Math.max(.8,scale*.83);
    };
  }
  Object.assign(pipeline.ink.mat.uniforms.uInk.value, new THREE.Color('#322c47'));
  const ink = pipeline.ink.mat.uniforms;
  ink.uStrength.value = .76; ink.uSens.value = .0048;
  ink.uConcaveAmount.value = .18; ink.uFadeStart.value = 25; ink.uFadeEnd.value = 45; ink.uSkyDepth.value = 70;
  const grade = pipeline.grade.mat.uniforms;
  grade.uSaturation.value = 1.04; grade.uLift.value = .012; grade.uWarmth.value = .025; grade.uVignette.value = .12;
  grade.uShadowTint.value.set('#e0dceb'); grade.uLightTint.value.set('#fff3e1');
  // Preserve the photograph and transparent canvas exactly. The vendor shader
  // source remains untouched; this instance alone carries its alpha through.
  for (const pass of [pipeline.ink, pipeline.grade, pipeline.fxaa]) {
    pass.mat.fragmentShader = pass.mat.fragmentShader.replace(/, 1\.0 \);/g, ', texture2D( tDiffuse, vUv ).a );');
    pass.mat.needsUpdate = true;
  }

  const shadowSurface = document.createElement('canvas'); shadowSurface.width = shadowSurface.height = 128;
  const shadowCtx = shadowSurface.getContext('2d');
  const shadowGradient = shadowCtx.createRadialGradient(64, 64, 2, 64, 64, 62);
  shadowGradient.addColorStop(0, 'rgba(24,20,40,.39)'); shadowGradient.addColorStop(.4, 'rgba(24,20,40,.20)'); shadowGradient.addColorStop(1, 'rgba(24,20,40,0)');
  shadowCtx.fillStyle = shadowGradient; shadowCtx.fillRect(0, 0, 128, 128);
  const shadowTexture = new THREE.CanvasTexture(shadowSurface); resources.textures.add(shadowTexture);
  const shadowMaterial = mat(new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
  const haloSurface = document.createElement('canvas'); haloSurface.width = haloSurface.height = 128;
  const haloCtx = haloSurface.getContext('2d'); const hg = haloCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
  hg.addColorStop(0, 'rgba(255,211,145,.35)'); hg.addColorStop(.15, 'rgba(255,203,130,.12)'); hg.addColorStop(1, 'rgba(255,190,126,0)');
  haloCtx.fillStyle = hg; haloCtx.fillRect(0, 0, 128, 128);
  const haloTexture = new THREE.CanvasTexture(haloSurface); haloTexture.colorSpace = THREE.SRGBColorSpace; resources.textures.add(haloTexture);
  const haloMaterial = mat(new THREE.SpriteMaterial({ map: haloTexture, transparent: true, depthWrite: false, opacity: .7 }));
  function halo(at, size, parent = set) { const o = new THREE.Sprite(haloMaterial); o.position.set(...at); o.scale.set(size, size, 1); parent.add(o); return o; }

  function makeSky() {
    const surface = document.createElement('canvas'); surface.width = 512; surface.height = 1024;
    const ctx = surface.getContext('2d'); const g = ctx.createLinearGradient(0, 0, 0, 1024);
    [[0, '#191d3e'], [.38, '#393456'], [.61, '#665168'], [.76, '#b67d7d'], [1, '#b99392']].forEach(([stop, color]) => g.addColorStop(stop, color));
    ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 1024);
    let n = 8247; const rand = () => ((n = n * 16807 % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < 67; i++) { const x = rand() * 512, y = rand() * 470; ctx.fillStyle = `rgba(242,226,204,${.18 + rand() * .5})`; ctx.beginPath(); ctx.arc(x, y, rand() < .15 ? 1.2 : .6, 0, Math.PI * 2); ctx.fill(); }
    const tex = new THREE.CanvasTexture(surface); tex.colorSpace = THREE.SRGBColorSpace; resources.textures.add(tex); return tex;
  }
  const sky = makeSky();
  const sceneGroups = new Map();
  function lantern(p, parent = set, size = 1) {
    const g = group(parent, p); g.scale.setScalar(size);
    cylinder([0, .045, 0], [.18, .07, .18], colors.dark, g);
    const glass = cel.cel({ color: '#ffe4af', emissive: '#ffd199', emissiveIntensity: .46, bands: 'soft', flat: false });
    cylinder([0, .28, 0], [.138, .43, .138], glass, g);
    cylinder([0, .51, 0], [.2, .055, .2], colors.sageDark, g);
    for (const x of [-.115, .115]) for (const z of [-.115, .115]) rod([x, .06, z], [x, .51, z], .013, colors.dark, g);
    halo([0, .28, .03], 1.7, g); return g;
  }
  function planter(p, s, parent, flowering = false) {
    const g = group(parent, p);
    const pot = lathe([[.18 * s, 0], [.24 * s, .04 * s], [.3 * s, .52 * s], [.33 * s, .54 * s], [.33 * s, .6 * s], [.28 * s, .6 * s]], colors.clay, g);
    cylinder([0, .55 * s, 0], [.27 * s, .025, .27 * s], colors.wood, g);
    for (let i = 0; i < 6; i++) {
      const theta = i * 2.4, r = .17 * s, y = (.84 + (i % 3) * .11) * s;
      rod([0, .56 * s, 0], [Math.sin(theta) * r, y, Math.cos(theta) * r], .018 * s, colors.sageDark, g);
      const leaf = ball([Math.sin(theta) * r, y, Math.cos(theta) * r], [.16 * s, .32 * s, .06 * s], i % 2 ? colors.sage : colors.sageDark, g); leaf.rotation.z = -.5 + i * .18; leaf.rotation.y = theta;
      if (flowering && i % 2 === 0) ball([Math.sin(theta) * r, y + .18 * s, Math.cos(theta) * r], [.085 * s, .1 * s, .085 * s], colors.roseLight, g);
    }
    return pot;
  }
  function cherryTree(p, size, parent) {
    const g = group(parent, p); g.scale.setScalar(size);
    const bark = colors.wood;
    curve([[0, 0, 0], [-.06, .7, .02], [.12, 1.4, .06], [-.04, 2.4, .1], [.35, 3.15, .02]], .12, bark, g);
    const branches = [
      [[.03, 1.18, 0], [-.55, 1.8, 0], [-1.2, 2.22, .12]],
      [[.03, 1.8, .02], [.6, 2.19, -.1], [1.23, 2.53, -.1]],
      [[-.04, 2.35, .1], [-.72, 2.72, -.22], [-1.08, 3.1, -.1]],
      [[.16, 2.8, .1], [.6, 3.2, .17], [.94, 3.4, .12]],
    ];
    branches.forEach(points => curve(points, .055, bark, g));
    const clusters = [[-.95, 2.4, .03, .68], [-1.2, 2.91, .1, .62], [-.68, 3.2, -.1, .77], [.02, 3.3, -.13, .84], [.74, 3.5, -.04, .72], [1.17, 2.84, -.13, .74], [.59, 2.71, .23, .82], [-.32, 2.77, .35, .68], [.08, 3.8, -.18, .58]];
    clusters.forEach(([x, y, z, r], i) => {
      mesh(unit.lowSphere, [colors.rose, colors.roseLight, colors.roseDark][i % 3], [x, y, z], [r, r * .67, r * .72], g);
      for (let j = 0; j < 4; j++) {
        const t = j * 2.5 + i, rr = r * .77;
        const m = mesh(unit.lowSphere, j % 3 ? colors.roseLight : colors.rose, [x + Math.cos(t) * rr, y + Math.sin(t) * rr * .35, z + .25], [r * .29, r * .22, r * .27], g);
        m.castShadow = false;
      }
    });
    return g;
  }
  function bench(p, parent) {
    const g = group(parent, p);
    for (const x of [-.72, .72]) { round([x, .32, 0], [.08, .65, .52], colors.sageDark, g); rod([x, .44, .16], [x, 1.23, -.26], .033, colors.sageDark, g); }
    for (let i = 0; i < 4; i++) round([0, .57, -.28 + i * .16], [1.8, .1, .125], colors.wood, g);
    for (let i = 0; i < 3; i++) { const plank = round([0, .86 + i * .15, -.24 - i * .04], [1.8, .12, .08], colors.wood, g); plank.rotation.x = -.18; }
    const cushion = round([.4, .67, -.02], [.66, .13, .48], colors.sage, g); cushion.rotation.y = -.08;
    return g;
  }
  function fairyLights(parent, sakura) {
    const left = [-4.2, 4.45, -1.8], right = [4.2, 4.3, -1.8];
    for (const [x, y, z] of [left, right]) { rod([x, 0, z], [x, y + .11, z], .044, colors.dark, parent); ball([x, y + .12, z], [.06, .06, .06], colors.brass, parent); }
    const points = [];
    for (let i = 0; i <= 30; i++) { const t = i / 30; points.push([-4.2 + t * 8.4, 4.4 - Math.sin(t * Math.PI) * .7, -1.8]); }
    curve(points, .013, colors.dark, parent, 35);
    for (let i = 0; i < 12; i++) {
      const t = (i + .3) / 11.6, x = -4.2 + t * 8.4, y = 4.4 - Math.sin(t * Math.PI) * .7;
      rod([x, y, -1.8], [x, y - .14, -1.8], .01, colors.dark, parent);
      cylinder([x, y - .15, -1.8], [.037, .055, .037], colors.brass, parent);
      noShadow(ball([x, y - .21, -1.8], [.06, .082, .06], glow, parent));
      halo([x, y - .21, -1.78], .84, parent);
    }
  }
  function makeSet(id) {
    const root = group(); root.name = `toon-${id}`; sceneGroups.set(id, root);
    const sakura = id === 'sakura-night', stage = id === 'fan-stage';
    // The same physical floor supports all screen positions; tiles become
    // quieter toward the foreground so the characters remain the subject.
    box([0, -.16, 7], [26, .3, 22], colors.stone, root);
    const tile = cel.cel({ color: sakura ? '#bda9a5' : '#aca2a6', bands: 3, flat: false, tint: '#8b7e9c' });
    box([0, -.03, 5], [16, .07, 18], tile, root);
    for (let z = -4; z <= 10; z += 1.5) noShadow(box([0, .008, z], [16, .008, .013], colors.stone, root));
    for (let x = -8; x <= 8; x += 1.6) noShadow(box([x, .01, 3], [.012, .009, 15], colors.stone, root));
    // Distant rooftop silhouettes are real geometry, without expensive details.
    for (let i = 0; i < 16; i++) {
      const height = .6 + (i * 7 % 9) * .12, x = -10 + i * 1.4;
      const building = box([x, height / 2 - .65, -5.8 - (i % 3) * .2], [1.18, height, 2], cel.cel({ color: i % 2 ? '#55506c' : '#655771', bands: 2, flat: false }), root);
      building.castShadow = false;
      for (let j = 0; j < 2; j++) if ((i + j) % 3 === 0) noShadow(box([x - .28 + j * .56, height * .6 - .65, -4.78 - (i % 3) * .2], [.15, .18, .018], cel.flat({ color: '#c79f90' }), root));
    }
    // Warm parapet, fine rails, a small alcove and an intentional open centre.
    round([0, .44, -3.9], [15, .86, .33], colors.lilac, root);
    round([0, .88, -3.9], [15.1, .09, .45], colors.paper, root);
    for (let x = -6; x <= 6; x += 1.6) rod([x, .91, -3.9], [x, 1.39, -3.9], .024, colors.sageDark, root);
    rod([-7.4, 1.39, -3.9], [7.4, 1.39, -3.9], .03, colors.sageDark, root);
    if (!stage) {
      const house = group(root, [3.55, 0, -4]);
      round([0, 1.43, -.22], [2.3, 2.86, 1.8], colors.sageDark, house);
      round([0, 2.89, -.17], [2.53, .18, 2.03], colors.sage, house);
      round([-.38, 1.6, .703], [1.12, 1.55, .065], colors.dark, house);
      const window = cel.cel({ color: '#e5bd8d', emissive: '#f9c690', emissiveIntensity: .5, bands: 'soft3', flat: false });
      box([-.38, 1.6, .75], [.99, 1.4, .04], window, house);
      box([-.38, 1.6, .79], [.045, 1.44, .05], colors.wood, house);
      box([-.38, 1.54, .79], [1.02, .045, .05], colors.wood, house);
      round([-.38, .8, .78], [1.22, .09, .22], colors.paper, house);
      for (const x of [-.68, -.15]) round([x, 1.65, .795], [.18, 1.3, .025], colors.clay, house);
      box([.62, .86, .725], [.06, .45, .04], colors.brass, house);
      halo([-.38, 1.45, 1.02], 3.6, house);
      bench([2.45, 0, -.45], root).rotation.y = -.16;
      planter([3.66, 0, 1.02], .87, root, true);
    }
    const tree = cherryTree(sakura ? [-2.9, 0, -1.9] : [-3.75, 0, -2.85], sakura ? 1.23 : .91, root);
    round(sakura ? [-2.9, .16, -1.9] : [-3.75, .16, -2.85], sakura ? [1.9, .31, 1.5] : [1.4, .31, 1.2], colors.clay, root);
    if (sakura) {
      cherryTree([4.5, 0, -5], 1.45, root);
      for (let i = 0; i < 28; i++) {
        const x = Math.sin(i * 12.7) * 5.4, z = -2.5 + (i % 9) * .75;
        const petal = noShadow(ball([x, .025, z], [.055, .014, .027], i % 2 ? colors.rose : colors.roseLight, root)); petal.rotation.y = i;
      }
    }
    lantern([-2.34, .03, -.08], root, .95);
    lantern([3.4, .05, 2.15], root, .74);
    planter([-3.85, 0, .46], 1.05, root);
    fairyLights(root, sakura);
    if (stage) {
      // Low rounded riser and two small speaker stacks leave a place to join.
      round([0, .07, -.1], [5.7, .15, 4.8], colors.wood, root);
      round([0, .17, -1.62], [5.68, .055, 1.6], colors.clay, root);
      for (const x of [-3.15, 3.15]) {
        const speaker = group(root, [x, .38, -1]);
        round([0, .42, 0], [.74, 1.25, .61], colors.dark, speaker);
        for (const [y, r] of [[.3, .23], [.77, .1]]) {
          const circle = cylinder([0, y, .319], [r, .035, r], colors.sageDark, speaker); circle.rotation.x = Math.PI / 2;
          const centre = cylinder([0, y, .345], [r * .62, .028, r * .62], colors.dark, speaker); centre.rotation.x = Math.PI / 2;
        }
        rod([0, -.38, 0], [0, -.03, 0], .05, colors.dark, speaker);
      }
      rod([2.35, .1, .55], [2.35, 1.94, .55], .018, colors.brass, root);
      rod([2.35, 1.94, .55], [1.92, 2.02, .75], .017, colors.dark, root);
      const mic = cylinder([1.87, 2.03, .78], [.065, .17, .065], colors.dark, root); mic.rotation.z = -1.16;
      for (let i = 0; i < 3; i++) rod([2.35, .12, .55], [2.35 + Math.cos(i * 2.094) * .32, .02, .55 + Math.sin(i * 2.094) * .32], .016, colors.dark, root);
    }
    return root;
  }

  const livePeople=new Map(),liveOccluders=[],livePhotoFrames=[],livePhotoPreviews=[],pendingLivePhotoImages=new Set();
  let liveRoom=null,liveRoomSummary=null,liveWallTitle=null,liveTruss=null,livePhotoSignature='',livePhotoGeneration=0;
  let venueAsset=null,venueReady=Promise.resolve(),venueStatus={status:'procedural'};
  let liveStagePrint=null;
  const venueAbort=new AbortController();
  const livePhotoSurfaces=[];
  const isEditorial=a=>a.hair===1&&a.top===0&&a.bottom===0&&a.shoes===1&&a.eyewear<=1&&a.accessory==='none'&&a.expression==='neutral'&&a.pose==='listen';
  const photoAnchor = new THREE.Vector3(6.57,2.65,-.3);
  let photoWallCenterZ=-.65;
  const LIVE_DEFAULT_PEOPLE = [
    {id:'azhe',name:'阿哲',position:[-2.05,0,2.0],rotation:.28,scale:1,avatar:{version:2,skin:0,hair:2,hairColor:0,top:4,bottom:1,shoes:0,eyewear:1,topColor:1,bottomColor:1,shoeColor:1,accessory:'chain',expression:'neutral',pose:'sway'}},
    {id:'xiaoyu',name:'小雨',position:[.7,0,1.02],rotation:-.31,scale:.94,avatar:{version:2,skin:1,hair:5,hairColor:0,top:5,bottom:1,shoes:0,eyewear:2,topColor:1,bottomColor:0,shoeColor:1,accessory:'none',expression:'smile',pose:'sway'}},
    {id:'linjian',name:'林间',position:[1.38,.63,-2.79],rotation:.07,scale:1.02,avatar:{version:2,skin:2,hair:0,hairColor:3,top:0,bottom:4,shoes:1,eyewear:1,topColor:0,bottomColor:1,shoeColor:1,accessory:'earbuds',expression:'focused',pose:'sing'}},
  ];
  function buildLivehouse() {
    if(liveRoom)return;
    liveRoom=group();liveRoom.name='modeled-livehouse';
    const room=liveRoom;
    const inkMat=cel.cel({color:'#1a1a22',bands:3,tint:'#716e86',flat:false});
    const charcoal=cel.cel({color:'#2c2a36',bands:3,tint:'#6b657a',flat:false});
    const plaster=cel.cel({color:'#c4c2b3',bands:3,tint:'#aaa49c',flat:false});
    const creamRoom=cel.cel({color:'#f1eee4',bands:'soft3',tint:'#d0d2cb',flat:false});
    const chartreuse=cel.cel({color:'#dced60',bands:3,tint:'#9caa47',flat:false});
    const chrome=cel.cel({color:'#82828a',bands:3,tint:'#706d7c',flat:false});
    const black=flat('#212721'), lit=flat('#e5edb0');
    const floorMat=cel.cel({color:'#b7b4a7',bands:'soft',tint:'#9e97a5',flat:false});
    // Open-front architectural cutaway: every surface below is real geometry.
    // The camera travels through the open front, never through a billboard.
    box([0,-.16,.7],[14,.3,12.5],floorMat,room).name='livehouse-floor';
    // A single light landing, curved like a record. No bathroom-like floor grid.
    const landing=noShadow(mesh(geo(new THREE.CircleGeometry(4.5,64)),creamRoom,[.1,.006,1.7],[1,.73,1],room));landing.rotation.x=-Math.PI/2;
    const orbit=noShadow(mesh(geo(new THREE.TorusGeometry(3.55,.012,4,96)),chartreuse,[.1,.02,1.65],[1,.76,1],room));orbit.rotation.x=-Math.PI/2;
    const back=box([0,3.05,-5.56],[14,6.1,.24],charcoal,room);back.name='livehouse-back-wall';liveOccluders.push(back);
    const left=box([-6.97,2.55,-3.55],[.24,5.1,4.1],inkMat,room);left.name='livehouse-left-wall';liveOccluders.push(left);
    const right=box([6.97,2.8,-1.9],[.24,5.6,7.5],inkMat,room);right.name='livehouse-photo-wall';liveOccluders.push(right);
    for(const x of[-6.72,6.72])box([x,2.94,-5.32],[.18,5.88,.22],chrome,room);
    box([0,5.85,-5.27],[13.45,.12,.25],chrome,room);
    // Stage is a raised, solid platform with three climbable modeled steps.
    const stage=box([-.1,.295,-3.29],[9.85,.61,4.28],inkMat,room);stage.name='livehouse-stage';liveOccluders.push(stage);
    box([-.1,.615,-3.29],[9.9,.055,4.3],charcoal,room);
    for(let i=0;i<3;i++){
      box([-3.65,.09+i*.09,-.7-i*.32],[1.55,.18+i*.18,.4],charcoal,room);
      box([-3.65,.19+i*.18,-.535-i*.32],[1.55,.026,.07],chartreuse,room);
    }
    for(let x=-4.65;x<4.7;x+=.58)noShadow(box([x,.646,-3.28],[.008,.004,4.02],inkMat,room));
    // Cream stage backdrop is a physical panel with original typography only.
    box([-.28,3.38,-5.335],[7.55,3.53,.07],creamRoom,room).name='livehouse-stage-sign';
    function printedTexture(kind,index=0){
      const surface=document.createElement('canvas');surface.width=kind==='sign'?1536:512;surface.height=kind==='sign'?720:640;
      const ctx=surface.getContext('2d');ctx.fillStyle='#f5f3ec';ctx.fillRect(0,0,surface.width,surface.height);
      ctx.fillStyle='#272b26';ctx.strokeStyle='#272b26';
      if(kind==='sign'){
        ctx.fillStyle='#ecebdc';ctx.fillRect(0,0,1536,720);
        ctx.fillStyle='#252329';ctx.save();ctx.translate(84,30);ctx.rotate(-.06);
        ctx.font='900 250px Arial';ctx.fillText('SIDE',0,280);ctx.fillText('BY SIDE',-7,520);ctx.restore();
        ctx.fillStyle='#dcec54';ctx.beginPath();ctx.arc(1238,247,183,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#252329';ctx.lineWidth=15;ctx.beginPath();ctx.moveTo(1090,270);ctx.bezierCurveTo(1180,105,1290,400,1380,224);ctx.stroke();
        ctx.fillStyle='#252329';ctx.font='bold 26px monospace';ctx.fillText('MUSIC SPACE / AFTER THE ENCORE',90,652);
        ctx.font='bold 21px monospace';ctx.fillText('01',1360,659);
      }else{
        // Six distinct original fictional gig prints. Only these small framed
        // images are 2D; the venue, camera, people and frame depth are modeled.
        const paper='#f0f0e8',ink='#262c28',accent='#d7e58b';
        const rect=(x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
        const circle=(x,y,r,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();};
        const polygon=(points,color)=>{ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();};
        const line=(x,y,u,v,thickness,color)=>{ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(v-y,u-x));rect(0,-thickness/2,Math.hypot(u-x,v-y),thickness,color);ctx.restore();};
        rect(26,26,460,472,index===3||index===5?ink:paper);
        if(index===0){
          rect(83,92,342,187,ink);polygon([[98,98],[214,264],[147,264]],accent);
          line(278,145,278,306,8,paper);line(278,145,312,131,10,paper);circle(317,130,12,paper);
          for(let i=0;i<8;i++){const x=55+i*57,y=332+Math.sin(i*1.7)*23;circle(x,y,23,ink);polygon([[x-19,y+16],[x+21,y+16],[x+29,495],[x-29,495]],ink);if(i%3===0)line(x+13,y+40,x+39,y-83,12,ink);}
        }else if(index===1){
          rect(49,44,73,429,ink);rect(371,55,78,64,accent);
          circle(282,151,34,ink);polygon([[260,184],[303,184],[330,316],[278,351],[234,300]],ink);
          line(271,333,209,478,24,ink);line(300,335,348,477,25,ink);
          line(268,209,198,279,21,ink);line(298,215,347,260,19,ink);
          circle(236,297,44,paper);circle(255,266,30,paper);circle(239,290,12,ink);line(260,265,377,180,15,ink);line(245,280,365,191,3,paper);
        }else if(index===2){
          line(53,160,306,125,9,ink);line(161,141,148,479,7,ink);
          circle(287,344,118,ink);circle(287,344,104,paper);circle(287,344,31,accent);
          circle(156,231,61,ink);circle(156,231,50,paper);circle(348,189,50,ink);circle(348,189,39,paper);
          line(110,191,185,257,6,ink);line(325,149,371,218,6,ink);line(76,478,433,478,7,ink);
        }else if(index===3){
          polygon([[127,79],[371,59],[371,454],[127,422]],paper);rect(185,94,127,40,accent);
          ctx.fillStyle=ink;ctx.font='700 24px monospace';ctx.fillText('EXIT',215,122);
          line(144,150,336,140,5,ink);line(144,150,145,406,5,ink);line(145,406,337,431,5,ink);
          for(const[x,y]of[[219,271],[291,292]]){circle(x,y,19,ink);polygon([[x-16,y+18],[x+17,y+18],[x+23,y+110],[x-21,y+110]],ink);line(x-9,y+102,x-16,422,12,ink);line(x+10,y+102,x+23,428,12,ink);}
        }else if(index===4){
          rect(49,51,89,47,accent);line(138,478,305,255,15,ink);line(298,266,337,210,40,ink);
          circle(355,155,73,ink);polygon([[291,179],[324,221],[393,147],[366,92]],ink);
          for(let i=0;i<5;i++)line(307+i*6,117+i*18,369+i*7,143+i*18,5,paper);
          line(123,476,341,476,7,ink);line(142,452,323,451,4,ink);
        }else{
          rect(26,426,460,72,paper);rect(109,299,285,22,paper);
          line(143,321,121,475,10,paper);line(358,321,380,475,10,paper);
          polygon([[272,107],[390,128],[366,282],[248,260]],paper);polygon([[354,122],[390,128],[384,169]],accent);
          for(let i=0;i<5;i++)line(278-i*3,150+i*21,354-i*3,163+i*21,5,ink);
          circle(124,370,19,accent);
        }
        const labels=['THE LAST SONG','FROM THE FRONT ROW','BEHIND THE BEAT','AFTER THE ENCORE','ONE VOICE / ONE ROOM','LEAVE A SEAT'];
        ctx.fillStyle=ink;ctx.font='700 24px monospace';ctx.fillText(labels[index%6],28,550);ctx.font='17px monospace';ctx.fillText('ORIGINAL FICTIONAL PRINT',28,590);
      }
      const texture=new THREE.CanvasTexture(surface);texture.colorSpace=THREE.SRGBColorSpace;resources.textures.add(texture);return texture;
    }
    const signMaterial=mat(new THREE.MeshBasicMaterial({map:printedTexture('sign')}));
    noShadow(mesh(unit.plane,signMaterial,[-.28,3.38,-5.289],[7.4,3.43,1],room));
    // Truss, stage lights and their real spotlights define the room's depth.
    // Tall folded acoustic drapes frame the hand-set stage typography.
    const curtainMat=cel.cel({color:'#393244',bands:3,tint:'#645b7c',flat:false});
    for(const side of[-1,1])for(let i=0;i<9;i++){
      const x=side*(4.18+i*.27);const fold=mesh(geo(new THREE.CylinderGeometry(.19,.19,5.25,10,1,true)),curtainMat,[x,3.0,-5.03],[1,1,.65],room);fold.name='acoustic-curtain-fold';
    }
    liveTruss=group(room);liveTruss.name='livehouse-foreground-truss';
    for(const x of[-5.45,5.45]){
      rod([x,.02,-1.15],[x,5.33,-1.15],.064,chrome,liveTruss);
      rod([x+.24,.02,-1.39],[x+.24,5.33,-1.39],.044,charcoal,liveTruss);
      for(let y=.25;y<5.3;y+=.53)rod([x,y,-1.15],[x+.24,y+.38,-1.39],.025,chrome,liveTruss);
    }
    for(const z of[-1.15,-1.39])rod([-5.45,5.3,z],[5.69,5.3,z],.052,chrome,liveTruss);
    for(let x=-5.4;x<5.6;x+=.65)rod([x,5.3,-1.15],[x+.52,5.3,-1.39],.022,charcoal,liveTruss);
    for(const [i,x]of[-3.65,-.1,3.55].entries()){
      const lamp=group(room,[x,5.07,-1.28]);lamp.rotation.x=-.25;
      cylinder([0,-.1,0],[.145,.34,.145],inkMat,lamp);cylinder([0,-.28,0],[.126,.016,.126],lit,lamp);
      const spot=new THREE.SpotLight('#f3f4e9',i===1?22:30,12,.43,.65,1.6);spot.position.set(x,4.9,-1.25);spot.target.position.set(x*.52,.64,-3.2);scene.add(spot,spot.target);
      const beamMaterial=mat(new THREE.MeshBasicMaterial({color:'#dfe7b6',transparent:true,opacity:.022,depthWrite:false,side:THREE.DoubleSide}));
      const from=spot.position.clone(),to=spot.target.position.clone(),distance=from.distanceTo(to);
      const beam=noShadow(mesh(geo(new THREE.ConeGeometry(.82,distance,24,1,true)),beamMaterial,from.clone().add(to).multiplyScalar(.5).toArray(),[1,1,1],room));
      beam.quaternion.setFromUnitVectors(UP,from.sub(to).normalize());
    }
    // Speaker boxes have inset cones and port geometry, not painted rectangles.
    for(const [x,z,scale]of[[-4.33,-3.7,1],[4.19,-3.67,1],[3.75,-1.55,.7]]){
      const speaker=group(room,[x,.63,z]);speaker.scale.setScalar(scale);
      const enclosure=round([0,.93,0],[1.1,1.86,.75],inkMat,speaker);liveOccluders.push(enclosure);
      for(const[y,r]of[[.52,.34],[1.25,.22]]){
        const cone=cylinder([0,y,.39],[r,.063,r],charcoal,speaker);cone.rotation.x=Math.PI/2;
        const rim=mesh(unit.ring,chrome,[0,y,.427],[r,r,r],speaker);
        ball([0,y,.438],[r*.36,r*.36,.064],inkMat,speaker);
      }
      box([0,.15,.397],[.66,.08,.034],black,speaker);
      for(const y of[.13,1.7])for(const x of[-.44,.44])ball([x,y,.401],[.018,.018,.009],chrome,speaker);
    }
    // A compact drum kit creates additional depth behind the performer.
    const drums=group(room,[-1.55,.65,-3.95]);
    const kick=cylinder([0,.47,0],[.48,.58,.48],charcoal,drums);kick.rotation.x=Math.PI/2;
    const skin=cylinder([0,.47,.302],[.438,.017,.438],creamRoom,drums);skin.rotation.x=Math.PI/2;
    const badge=cylinder([0,.47,.314],[.1,.012,.1],inkMat,drums);badge.rotation.x=Math.PI/2;
    for(const[x,y,z,r]of[[-.47,1.04,0,.27],[.2,1.17,-.03,.24],[.69,.69,-.2,.32]]){
      cylinder([x,y,z],[r,.3,r],charcoal,drums);cylinder([x,y+.159,z],[r,.02,r],creamRoom,drums);
    }
    for(const[x,y,z]of[[-.89,1.55,.04],[.8,1.8,-.28]]){
      rod([x,0,z],[x,y,z],.016,chrome,drums);cylinder([x,y,z],[.36,.017,.36],chartreuse,drums);
      for(let i=0;i<3;i++)rod([x,.17,z],[x+Math.cos(i*2.094)*.25,.01,z+Math.sin(i*2.094)*.25],.014,chrome,drums);
    }
    // Stand microphone and coiled cable stand independently of the character.
    rod([1.75,.65,-2.36],[1.75,2.78,-2.36],.022,chrome,room);
    rod([1.75,2.78,-2.36],[1.4,2.86,-2.2],.022,inkMat,room);
    const mic=cylinder([1.36,2.867,-2.19],[.059,.22,.059],inkMat,room);mic.rotation.z=-1.24;
    for(let i=0;i<3;i++)rod([1.75,.82,-2.36],[1.75+Math.cos(i*2.094)*.32,.65,-2.36+Math.sin(i*2.094)*.32],.019,inkMat,room);
    curve([[1.39,2.84,-2.2],[1.8,1.6,-2.35],[1.85,.66,-2.0],[2.8,.66,-2.2],[3.3,.66,-3.1]],.012,inkMat,room,32);
    // Low crowd rail gives honest foreground occlusion without hiding faces.
    for(const x of[-2.85,2.82])rod([x,.01,-.1],[x,1.03,-.1],.033,chrome,room);
    rod([-2.85,1.04,-.1],[2.82,1.04,-.1],.042,charcoal,room);
    for(const x of[-2.85,2.82])box([x,.025,-.1],[.46,.05,.36],inkMat,room);
    // Six thick frames sit on the actual right wall. Their side profiles and
    // perspective change as the camera moves to the wall.
    const gallery=group(room,[6.795,2.64,-.65]);gallery.rotation.y=-Math.PI/2;
    gallery.name='livehouse-gallery';gallery.userData.hotspot={id:'photos',kind:'photos',label:'照片墙'};
    const wallSign=document.createElement('canvas');wallSign.width=1024;wallSign.height=160;paintGalleryPrint(wallSign.getContext('2d'));const wallPrint=new THREE.CanvasTexture(wallSign);wallPrint.colorSpace=THREE.SRGBColorSpace;resources.textures.add(wallPrint);const wallTitle=noShadow(mesh(unit.plane,mat(new THREE.MeshBasicMaterial({map:wallPrint})),[6.735,4.68,-.65],[3.76,3.76/GALLERY_PRINT_ASPECT,1],room));wallTitle.rotation.y=-Math.PI/2;wallTitle.rotation.z=-.015;wallTitle.userData.hotspot={id:'photos',kind:'photos',label:'照片墙'};liveWallTitle=wallTitle;

    for(let row=0;row<2;row++)for(let col=0;col<3;col++){
      const at=[(col-1)*1.12,(.5-row)*1.46,0];const frame=group(gallery,at);frame.rotation.z=(col-1)*.024;
      box([0,0,0],[.965,1.285,.036],creamRoom,frame);
      box([0,.045,.024],[.884,1.095,.008],inkMat,frame);
      const index=row*3+col,photoTexture=printedTexture('photo',index);
      const photo=mat(new THREE.MeshBasicMaterial({map:photoTexture}));
      livePhotoPreviews.push({id:`photo-${index+1}`,url:photoTexture.image.toDataURL('image/png'),label:['最后一首','安可响起','这一侧的舞台','朋友的视线','散场以后','再听一遍'][index]});
      noShadow(mesh(unit.plane,photo,[0,.045,.035],[.87,1.078,1],frame));
      livePhotoSurfaces.push(photo);livePhotoFrames.push(frame);rod([-.11,.664,0],[.11,.664,0],.014,chrome,frame);
    }
    // Small foyer bench and wall fixtures complete a usable room corner.
    for(const x of[-5.47,-3.75])box([x,.4,3.75],[.1,.8,.6],inkMat,room);
    round([-4.6,.83,3.75],[2.08,.14,.73],charcoal,room);
    round([-4.6,1.27,4.01],[2.08,.72,.09],inkMat,room);
    for(const x of[-5.1,-4.6,-4.1])box([x,1.25,4.063],[.012,.58,.007],chrome,room);
    for(const x of[-5.6,5.6]){
      box([x,4.6,-5.27],[.63,.22,.08],chartreuse,room);
      box([x,4.6,-5.218],[.28,.04,.01],black,room);
    }
    room.updateMatrixWorld(true);
    let meshCount=0;room.traverse(node=>{if(node.isMesh)meshCount++;});
    const roomBounds=new THREE.Box3().setFromObject(room);
    liveRoomSummary={roomMeshCount:meshCount,photoFrameCount:livePhotoFrames.length,roomBounds:{min:roomBounds.min.toArray(),max:roomBounds.max.toArray()},depthSpan:roomBounds.max.z-roomBounds.min.z,usesRoomImage:false};
  }

  function addLiveStagePrint(){
    if(liveStagePrint)return;
    const surface=document.createElement('canvas');surface.width=1200;surface.height=680;paintStagePrint(surface.getContext('2d'));
    const texture=new THREE.CanvasTexture(surface);texture.colorSpace=THREE.SRGBColorSpace;resources.textures.add(texture);
    liveStagePrint=group(liveRoom,[-.5,3.45,-4.71]);liveStagePrint.name='livehouse-hanging-stage-print';liveStagePrint.rotation.z=-.016;
    const paper=cel.cel({color:'#d2c7b3',bands:'soft3',tint:'#777184'});
    noShadow(box([0,0,-.023],[5.24,2.97,.03],paper,liveStagePrint));
    noShadow(mesh(unit.plane,mat(new THREE.MeshBasicMaterial({map:texture})),[0,0,0],[5.2,5.2*680/1200,1],liveStagePrint));
    for(const x of[-2.36,2.36])rod([x,1.49,-.01],[x,1.94,-.01],.012,colors.dark,liveStagePrint);
    layoutLiveStagePrint();
  }

  function layoutLiveStagePrint(){if(!liveStagePrint)return;const layout=stagePrintLayout(width/height<.85);liveStagePrint.position.set(...layout.position);liveStagePrint.scale.setScalar(layout.scale);}

  function makeAvatar(data, slot) {
    const ownedBefore = new Set(resources.geometries);
    const a = safeAvatar(data);
    const root = group(people); root.name = `${slot}-feet`;
    const lean = group(root); const body = group(lean); body.name = `${slot}-pose`;
    // Original lanky editorial figures: approximately 5.5 heads tall, cut-paper hair shapes,
    // slim limbs and a fashion silhouette. They are volumetric meshes, not a
    // photograph, flattened sprite, or recreation of the reference character.
    const skin = cel.cel({ color: SKINS[a.skin], bands: 'soft', flat: false, tint: '#e8d8d4', emissive: SKINS[a.skin], emissiveIntensity: .12 });
    const hair = cel.cel({ color: HAIRS[a.hairColor], bands: 3, flat: false, tint: '#887489' });
    const hairShade = cel.cel({ color: new THREE.Color(HAIRS[a.hairColor]).multiplyScalar(.77).getStyle(), bands: 3, flat: false });
    const cloth = cel.cel({ color: GARMENT_COLORS[a.topColor], bands: 3, flat: false, tint: '#88778f' });
    const seam = cel.cel({ color: new THREE.Color(GARMENT_COLORS[a.topColor]).multiplyScalar(.8).getStyle(), bands: 3, flat: false });
    const dark = cel.cel({ color: '#483541', bands: 'soft', flat: false });
    const cream = cel.cel({ color: '#f5e8d2', bands: 'soft', flat: false });
    const pants = cel.cel({ color: GARMENT_COLORS[a.bottomColor], bands: 3, flat: false });
    const pantsSeam = cel.cel({ color: new THREE.Color(GARMENT_COLORS[a.bottomColor]).multiplyScalar(.79).getStyle(), bands: 3, flat: false });
    const shoeMaterial = cel.cel({ color: GARMENT_COLORS[a.shoeColor], bands: 3, flat: false });
    const shoeTrim = cel.cel({ color: new THREE.Color(GARMENT_COLORS[a.shoeColor]).multiplyScalar(.72).getStyle(), bands: 3, flat: false });
    const blush = cel.cel({ color: new THREE.Color(SKINS[a.skin]).lerp(new THREE.Color('#bd8490'), .35).getStyle(), bands: 'soft', flat: false });
    const graphicInk = flat('#543f49');
    const mouthInk = a.skin >= 3 ? flat('#ebc3ad') : dark;
    function polygon(points, depth, material, parent = body, at = [0, 0, 0], bevel = .018) {
      const shape = new THREE.Shape(); points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y)); shape.closePath();
      const geom = geo(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 12 }));
      geom.translate(0, 0, -depth / 2); return mesh(geom, material, at, [1, 1, 1], parent);
    }
    function flatShape(draw, material, parent, at) {
      const shape = new THREE.Shape(); draw(shape);
      return noShadow(mesh(geo(new THREE.ShapeGeometry(shape, 24)), material, at, [1, 1, 1], parent));
    }
    // Rounded shoe lasts replace stacked bevelled cubes. The upper tapers
    // continuously toward the toe and heel; the sole remains flat on the floor.
    function shoeLast(material, parent, { sole = false, platform = false } = {}) {
      const profile = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-.174, .004, .034), new THREE.Vector3(-.142, .078, .108),
        new THREE.Vector3(-.064, .099, .125), new THREE.Vector3(.04, .104, .106),
        new THREE.Vector3(.142, .086, .07), new THREE.Vector3(.21, .038, .027),
        new THREE.Vector3(.225, .003, .005),
      ]);
      const vertices = [], indices = [], longitudinal = 24, radial = 16;
      const soleHeight = platform ? .06 : .028;
      for (let row = 0; row <= longitudinal; row++) {
        const section = profile.getPoint(row / longitudinal);
        const radius = Math.max(.002, section.y) * (sole ? 1.035 : 1);
        const h = sole ? soleHeight : Math.max(.004, section.z) * (platform ? 1.07 : 1);
        const base = sole ? .004 : soleHeight - .001;
        for (let i = 0; i <= radial; i++) {
          const angle = i / radial * Math.PI * 2;
          vertices.push(Math.cos(angle) * radius, base + (Math.sin(angle) + 1) * h * .5, section.x);
          if (row < longitudinal && i < radial) {
            const a = row * (radial + 1) + i, b = a + radial + 1;
            indices.push(a, a + 1, b, b, a + 1, b + 1);
          }
        }
      }
      for(const end of [0,longitudinal]){
        const offset=end*(radial+1), centreIndex=vertices.length/3;
        const top=(offset+radial/4)*3,bottom=(offset+radial*3/4)*3;
        vertices.push(0,(vertices[top+1]+vertices[bottom+1])*.5,vertices[offset*3+2]);
        for(let i=0;i<radial;i++)end===0?indices.push(centreIndex,offset+i+1,offset+i):indices.push(centreIndex,offset+i,offset+i+1);
      }
      const geometry = geo(new THREE.BufferGeometry());
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setIndex(indices); geometry.computeVertexNormals();
      const item = mesh(geometry, material, [0,0,0], [1,1,1], parent);
      item.name = sole ? 'avatar-shoe-sole' : 'avatar-shoe-upper';
      return item;
    }
    // Flattened cloth tubes meet the front/back thickness of the torso. Starting
    // them inside its shoulder volume avoids a detached tube/corset appearance.
    function sleeve(points, radius, material, parent, depth = .16) {
      const path = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
      const longitudinal = 18, radial = 12;
      const geometry = geo(new THREE.TubeGeometry(path, longitudinal, radius, radial, false));
      const positions = geometry.attributes.position;
      for (let row = 0; row <= longitudinal; row++) {
        const t = row / longitudinal, centre = path.getPointAt(t), taper = 1 - .2 * t;
        for (let i = 0; i <= radial; i++) {
          const index = row * (radial + 1) + i;
          positions.setXYZ(index,
            centre.x + (positions.getX(index) - centre.x) * taper,
            centre.y + (positions.getY(index) - centre.y) * taper,
            centre.z + (positions.getZ(index) - centre.z) * depth / radius * taper);
        }
      }
      geometry.computeVertexNormals();
      const item = mesh(geometry, material, [0,0,0], [1,1,1], parent);
      item.name = 'avatar-garment-sleeve'; return item;
    }
    const wide = a.bottom === 2 || a.bottom === 5;
    const shorts = a.bottom === 0 || a.bottom === 3;
    for (const sign of [-1, 1]) {
      const leg = group(body, [sign * .145, .115, sign > 0 ? .048 : -.055]); leg.rotation.z = sign > 0 ? -.052 : .021;
      if (!shorts) {
        const w = wide ? .155 : a.bottom === 4 ? .067 : .12;
        const trouser = polygon([[-w * (wide ? 1.27 : 1), 0], [w * (wide ? 1.27 : 1), 0], [w * .8, .56], [w * .98, 1.17], [-w * .97, 1.19], [-w * .79, .58]], .18, pants, leg);
        curve([[sign * .035, .12, .106], [sign * .029, .59, .106], [sign * .021, 1.08, .106]], .007, pantsSeam, leg, 12);
        if (a.bottom === 1) round([sign * .108, .65, .11], [.1, .22, .032], pantsSeam, leg);
      } else {
        rod([0, 0, 0], [0, 1.19, 0], .038, skin, leg);
        cylinder([0, a.bottom === 3 ? .24 : .073, 0], [.047, a.bottom === 3 ? .39 : .16, .05], cream, leg);
        polygon([[-.13, .72], [.142, .7], [.15, 1.2], [-.137, 1.2]], .22, pants, leg);
        rod([sign * .10, .75, .125], [sign * .07, 1.09, .125], .008, pantsSeam, leg);
      }
      const isHigh = a.shoes === 1, platform = a.shoes === 3, loafers = a.shoes === 2;
      const foot = group(root, [sign * .16, 0, sign > 0 ? .078 : -.031]);
      foot.name = 'avatar-foot'; foot.rotation.y = sign > 0 ? -.18 : .09;
      shoeLast(shoeMaterial, foot, { platform });
      shoeLast(colors.sole, foot, { sole: true, platform });
      if (isHigh) {
        const collar = cylinder([0,.173,-.091],[.073,.239,.083],shoeMaterial,foot);
        collar.name = 'avatar-shoe-collar';
        for(let i=0;i<3;i++)rod([-.049,.149+i*.047,-.006],[.049,.157+i*.047,-.006],.006,cream,foot);
      } else if (loafers) {
        curve([[-.083,.126,.018],[0,.151,.027],[.083,.126,.018]],.012,shoeTrim,foot,12);
        round([0,.153,.033],[.052,.011,.02],colors.brass,foot);
      } else {
        for(let i=0;i<2;i++)curve([[-.056,.135,.003+i*.047],[0,.151,.008+i*.047],[.056,.135,.012+i*.047]],.006,cream,foot,8);
      }
    }
    const shoulderY = 2.115;
    // Covered garments have no full-body cream/skin plate behind them. Only
    // deliberately layered tops get a fitted undershirt; only the crop has a
    // small anatomical torso. This keeps necklines/arms/waists honest.
    if (a.top === 1 || a.top === 2) {
      const under = polygon([[-.197,1.29],[.197,1.29],[.224,1.95],[.21,2.105],[.089,2.2],[-.089,2.2],[-.21,2.105],[-.224,1.95]],.244,cream);
      under.name = 'avatar-layered-undershirt';
    } else if (a.top === 5) {
      const anatomy = polygon([[-.181,1.29],[.181,1.29],[.213,1.91],[.208,2.08],[.084,2.2],[-.084,2.2],[-.208,2.08],[-.213,1.91]],.215,skin,body,[0,0,-.015],.022);
      anatomy.name = 'avatar-crop-torso';
    }
    cylinder([0,2.283,-.015],[.073,.3,.07],skin,body);
    let garment;
    if(a.top===0){
      // One continuous box tee, with a soft round neck and hip-covering hem.
      garment=polygon([[-.311,1.275],[.302,1.299],[.32,1.94],[.273,2.129],[.105,2.212],[.073,2.162],[0,2.142],[-.078,2.171],[-.112,2.207],[-.275,2.128],[-.318,1.925]],.302,cloth,body,[0,0,0],.013);
      for(let row=0;row<2;row++)for(let col=0;col<3;col++)noShadow(ball([-.064+col*.063,1.84+row*.067,.172],[.016,.016,.005],graphicInk,body));
      curve([[-.107,2.2,.17],[-.065,2.16,.177],[.006,2.148,.177],[.094,2.196,.17]],.01,seam,body,14);
    }else if(a.top===1){
      for(const sign of[-1,1]){
        garment=polygon([[sign*.052,1.23],[sign*.282,1.25],[sign*.297,2.088],[sign*.124,2.203],[sign*.036,2.08]],.303,cloth);
        garment.name='avatar-garment-shell';
        polygon([[sign*.034,2.1],[sign*.11,2.209],[sign*.239,2.1],[sign*.146,1.95]],.023,seam,body,[0,0,.17],.011);
        round([sign*.198,1.855,.168],[.12,.14,.018],seam,body);
        round([sign*.198,1.928,.181],[.131,.021,.014],cloth,body);
        round([sign*.208,1.44,.169],[.132,.021,.014],seam,body);
        for(let i=0;i<3;i++)ball([sign*.074,1.4+i*.2,.178],[.009,.009,.006],colors.brass,body);
      }
    }else if(a.top===2){
      garment=polygon([[-.254,1.334],[.254,1.334],[.26,1.95],[.192,2.157],[0,1.975],[-.192,2.157],[-.26,1.95]],.297,cloth);
      curve([[-.188,2.145,.17],[0,1.963,.182],[.188,2.145,.17]],.014,seam,body,14);
      round([0,1.353,.009],[.525,.042,.312],seam,body);
    }else if(a.top===3){
      garment=polygon([[-.274,1.284],[.274,1.284],[.327,1.97],[.245,2.145],[.095,2.207],[.066,2.16],[-.066,2.16],[-.095,2.207],[-.245,2.145],[-.327,1.97]],.326,cloth);
      round([0,1.308,.009],[.558,.064,.344],seam,body);
      rod([0,1.341,.188],[0,2.161,.188],.008,colors.brass,body);
      round([.018,1.98,.201],[.021,.042,.01],colors.brass,body);
      for(const sign of[-1,1])rod([sign*.17,1.5,.189],[sign*.258,1.72,.18],.009,seam,body);
    }else if(a.top===4){
      garment=polygon([[-.238,1.297],[.236,1.309],[.269,1.95],[.222,2.14],[.091,2.202],[.064,2.165],[-.064,2.165],[-.091,2.202],[-.222,2.14],[-.269,1.95]],.283,cream);
      for(let i=0;i<7;i++)round([0,1.385+i*.104,.155],[.454,.026,.009],cloth,body);
      curve([[-.09,2.197,.159],[0,2.158,.166],[.09,2.197,.159]],.01,cloth,body,12);
    }else{
      garment=polygon([[-.212,1.515],[.212,1.515],[.232,1.91],[.148,2.179],[.086,2.19],[0,2.107],[-.086,2.19],[-.148,2.179],[-.232,1.91]],.276,cloth);
      round([0,1.531,0],[.432,.032,.291],seam,body);
      curve([[-.148,2.176,.15],[-.164,2.014,.159],[-.23,1.91,.155]],.007,seam,body,12);
      curve([[.148,2.176,.15],[.164,2.014,.159],[.23,1.91,.155]],.007,seam,body,12);
    }
    garment.name='avatar-garment-shell';
    if (a.accessory === 'chain') {
      curve([[-.105, 2.205, .18], [0, 1.925, .218], [.105, 2.205, .18]], .012, colors.brass, body, 18);
      curve([[-.115, 2.205, .18], [0, 2.038, .22], [.115, 2.205, .18]], .008, cream, body, 14);
      const pendant = cylinder([0, 1.914, .232], [.044, .015, .044], colors.brass, body); pendant.rotation.x = Math.PI / 2;
      rod([.009,1.895,.247],[.009,1.934,.247],.005,dark,body);
      noShadow(ball([-.002,1.895,.25],[.013,.008,.004],dark,body));
    } else if (a.accessory === 'crossbody') {
      polygon([[-.245,2.17],[-.171,2.205],[.337,1.355],[.266,1.316]], .03, colors.dark, body, [0,0,.235], .012);
      round([.29, 1.313, .126], [.326, .287, .29], colors.dark, body);
      round([.29, 1.347, .284], [.276, .115, .028], colors.sageDark, body);
      rod([.174, 1.398, .306], [.405, 1.398, .306], .007, colors.brass, body);
      round([.373, 1.378, .317], [.018, .035, .011], colors.brass, body);
      for(let i=0;i<3;i++)round([.253+i*.036,1.344,.307],[.011,.031+(i%2)*.026,.009],cream,body);
      const record = cylinder([.29,1.46,.13],[.106,.014,.106],dark,body); record.rotation.x=Math.PI/2;
    }

    const head = group(body, [.043, 2.64, 0]); head.scale.setScalar(.54);
    const face = polygon([[-.325, .29], [-.37, .095], [-.335, -.18], [-.22, -.345], [-.015, -.407], [.205, -.35], [.335, -.195], [.368, .08], [.313, .31], [.15, .404], [-.14, .403]], .37, skin, head, [0, 0, 0], .06);
    face.receiveShadow = false; face.name='avatar-face';
    for (const sign of [-1, 1]) {
      const ear = ball([sign * .372, -.067, .004], [.055, .085, .05], skin, head); ear.receiveShadow = false;
      const cheek = ball([sign * .245, -.161, .266], [.05, .022, .007], blush, head); cheek.receiveShadow = false;
    }
    // Almond whites, cut-off irises and substantial lids carry the calm,
    // slightly knowing expression. Features hug the face instead of bulging.
    for (const sign of [-1, 1]) {
      const eyeGroup = group(head, [sign * .17, -.04, .276]); eyeGroup.rotation.z = sign * (a.expression === 'focused' ? -.095 : a.expression === 'smile' ? .095 : .055);
      eyeGroup.scale.y = a.expression === 'focused' ? .77 : 1;
      if (a.expression === 'wink' && sign === -1) {
        curve([[-.106,-.011,.018],[-.025,-.047,.019],[.095,-.015,.018]], .015, dark, eyeGroup, 12);
        curve([[-.1,-.013,.018],[-.133,.004,.018]], .01, dark, eyeGroup, 6);
      } else {
      flatShape(s => { s.moveTo(-.113, .009); s.quadraticCurveTo(0, .056, .113, .016); s.quadraticCurveTo(.103, -.097, 0, -.105); s.quadraticCurveTo(-.093, -.09, -.113, .009); }, cream, eyeGroup, [0, 0, 0]);
      flatShape(s => { s.moveTo(-.055, .025); s.lineTo(.06, .027); s.quadraticCurveTo(.062, -.081, 0, -.084); s.quadraticCurveTo(-.06, -.073, -.055, .025); }, graphicInk, eyeGroup, [sign * -.005, 0, .008]);
      curve([[-.111, .015, .015], [-.025, .041, .017], [.066, .037, .016], [.116, .016, .015]], .018, dark, eyeGroup, 12);
      curve([[-.099, -.038, .011], [-.044, -.094, .012], [.026, -.105, .012], [.094, -.057, .011]], .009, dark, eyeGroup, 12);
      noShadow(ball([-.025, -.004, .019], [.014, .023, .004], cream, eyeGroup));
      }
      curve([[sign * .063, .141, .278], [sign * .164, .161, .28], [sign * .277, .121, .272]], .014, hairShade, head, 9);
    }
    const nose = ball([.006, -.2, .275], [.037, .014, .012], dark, head); nose.receiveShadow = false;
    let mouth;
    if (a.pose === 'sing') mouth=noShadow(ball([0, -.293, .274], [.027, .035, .007], mouthInk, head));
    else if (a.expression === 'smile') mouth=curve([[-.085,-.27,.273],[0,-.314,.278],[.086,-.269,.273]], .012, mouthInk, head, 14);
    else if (a.expression === 'wink') mouth=curve([[-.049,-.287,.274],[.012,-.299,.278],[.077,-.266,.272]], .011, mouthInk, head, 12);
    else if (a.expression === 'focused') mouth=curve([[-.053,-.291,.274],[.006,-.285,.278],[.059,-.286,.274]], .011, mouthInk, head, 9);
    else mouth=curve([[-.047, -.29, .271], [.006, -.302, .275], [.058, -.286, .271]], .011, mouthInk, head, 10);
    mouth.name='avatar-expression-mouth';
    // Back hair volume and front locks use designed angular outlines.
    const bob = a.hair === 1, shag = a.hair === 2, updo = a.hair === 3, twists = a.hair === 4, blunt = a.hair === 5, centrePart = a.hair === 6, buzz = a.hair === 7;
    const back = buzz
      ? [[-.375,.084],[-.366,.271],[-.259,.382],[-.091,.44],[.131,.424],[.301,.32],[.378,.129],[.369,-.046],[.305,-.145],[-.319,-.145]]
      : centrePart
        ? [[-.43,.35],[-.457,.146],[-.398,-.312],[-.295,-.367],[-.285,-.226],[.28,-.225],[.298,-.364],[.433,-.278],[.456,.161],[.293,.43],[-.098,.501]]
      : blunt
      ? [[-.43,.39],[-.49,.17],[-.47,-.36],[-.31,-.47],[-.28,-.29],[.3,-.29],[.32,-.48],[.47,-.37],[.48,.19],[.3,.44],[-.08,.51]]
      : twists
      ? [[-.39,.3],[-.41,.06],[-.35,-.19],[-.27,-.25],[.29,-.24],[.4,-.06],[.42,.19],[.23,.39],[-.12,.44]]
      : bob
      ? [[-.43, .41], [-.5, .21], [-.48, -.37], [-.32, -.56], [-.285, -.37], [-.22, -.5], [-.1, -.39], [.22, -.41], [.27, -.56], [.43, -.4], [.5, .23], [.34, .46], [.04, .55], [-.2, .52]]
      : shag
        ? [[-.4, .45], [-.48, .19], [-.55, -.19], [-.4, -.16], [-.48, -.43], [-.28, -.35], [-.22, -.53], [-.12, -.34], [.17, -.35], [.24, -.48], [.39, -.29], [.49, -.36], [.43, -.1], [.52, .12], [.34, .43], [.04, .56]]
        : [[-.39, .4], [-.47, .18], [-.42, -.2], [-.31, -.33], [-.27, -.17], [.3, -.17], [.35, -.33], [.46, -.16], [.48, .19], [.34, .44], [.03, .54], [-.23, .48]];
    polygon(back, .36, hair, head, [0, .035, -.16], .022);
    if (twists) {
      for (let i = 0; i < 9; i++) {
        const theta = -.15 + i / 8 * Math.PI, x = Math.cos(theta) * .39, y = .16 + Math.sin(theta) * .36;
        const twist = polygon([[-.055, -.09], [.028, -.095], [.055, .02], [.09, .095], [.048, .18], [-.04, .158], [-.063, .038]], .10, hair, head, [x, y, .15], .014); twist.rotation.z = (theta - Math.PI / 2) * .64;
      }
    }
    const fringe = buzz
      ? [[-.383,.12],[-.338,.31],[-.152,.411],[.127,.407],[.323,.311],[.385,.114],[.305,.167],[.137,.199],[-.141,.199],[-.307,.166]]
      : centrePart
        ? [[-.444,.101],[-.363,.37],[-.127,.493],[.033,.408],[.151,.493],[.368,.364],[.446,.109],[.39,-.135],[.273,.066],[.124,.327],[.018,.387],[-.069,.315],[-.211,.107],[-.387,-.14]]
      : blunt
      ? [[-.431,.117],[-.38,.37],[-.21,.477],[.13,.47],[.346,.36],[.435,.136],[.341,.08],[.26,.186],[.169,.124],[.082,.21],[-.022,.129],[-.105,.221],[-.192,.13],[-.266,.21],[-.344,.069]]
      : twists
      ? [[-.407,.12],[-.363,.327],[-.204,.397],[.095,.413],[.31,.32],[.406,.139],[.331,.041],[.299,.177],[.169,.234],[.01,.26],[-.106,.2],[-.211,.155],[-.298,.051]]
      : bob
      ? [[-.435, .13], [-.408, .396], [-.231, .506], [.099, .51], [.343, .417], [.455, .25], [.406, -.095], [.317, .116], [.238, .337], [.183, .095], [.089, .028], [.008, .363], [-.054, .124], [-.127, .072], [-.201, .328], [-.233, .076], [-.32, -.04], [-.321, .255]]
      : shag
        ? [[-.452, .104], [-.372, .378], [-.207, .519], [-.045, .471], [.072, .574], [.221, .474], [.286, .543], [.402, .352], [.488, .262], [.366, .035], [.292, .22], [.241, .023], [.171, .213], [.093, .071], [.031, .32], [-.048, .065], [-.123, .262], [-.233, .021], [-.265, .22], [-.346, .015]]
        : [[-.439, .143], [-.359, .385], [-.124, .498], [.131, .497], [.364, .372], [.453, .151], [.367, -.046], [.287, .15], [.19, .348], [.101, .122], [.018, .055], [-.002, .334], [-.12, .192], [-.216, .091], [-.222, .31], [-.329, .07]];
    polygon(fringe, .092, hair, head, [0, .031, .253], .009);
    // Fine engraved cuts emphasize the designed silhouette without wireframe.
    if (!buzz) curve([[-.34, .28, .312], [-.3, .4, .314], [-.18, .465, .312]], .007, hairShade, head, 11);
    if (buzz) for (let i = 0; i < 5; i++) rod([-.25+i*.12,.266,.314],[-.22+i*.12,.32,.315],.006,hairShade,head);
    if (centrePart) curve([[.019,.396,.321],[.016,.444,.319],[.011,.493,.273]],.012,skin,head,9);
    if (bob) curve([[.376, .21, .294], [.401, -.13, .265], [.34, -.408, .117]], .01, hairShade, head, 14);
    if (updo) {
      polygon([[-.05, -.12], [.117, -.141], [.228, -.031], [.184, .136], [.004, .199], [-.149, .085], [-.173, -.02]], .28, hair, head, [.3, .49, -.15], .03);
      rod([.203, .45, -.027], [.429, .46, -.027], .024, colors.clay, head);
      polygon([[0, .24], [.223, .108], [.332, -.11], [.267, -.39], [.128, -.665], [.135, -.314], [-.026, -.485], [.029, -.166], [-.088, .025]], .13, hair, head, [.354, .38, -.11], .012);
    }
    if (a.eyewear > 0) {
      const lightFrame = a.eyewear === 2 || a.skin >= 3;
      const frameMaterial = lightFrame ? cream : dark;
      for (const sign of [-1, 1]) {
        const frame = group(head, [sign * .174, -.054, .327]); frame.rotation.z = sign * .055;
        let outline = [[-.134, .053, 0], [-.125, -.037, 0], [-.079, -.117, 0], [.045, -.13, 0], [.119, -.071, 0], [.137, .052, 0], [.032, .071, 0], [-.134, .053, 0]];
        if (a.eyewear === 1) outline = [[-.14,.06,0],[-.14,-.08,0],[-.097,-.11,0],[.104,-.11,0],[.14,-.061,0],[.14,.06,0],[-.14,.06,0]];
        if (a.eyewear === 2) outline = [[-.14,.061,0],[-.091,-.065,0],[-.031,-.093,0],[.071,-.07,0],[.163,.104,0],[.043,.072,0],[-.14,.061,0]].map(([x,y,z])=>[x*sign,y,z]);
        if (a.eyewear === 4) {
          outline = Array.from({length:33},(_,i)=>{const theta=i/32*Math.PI*2;return[Math.cos(theta)*.132,Math.sin(theta)*.123-.018,0];});
        }
        if (a.eyewear === 5) {
          outline = [[-.157,.075,0],[-.172,-.015,0],[-.099,-.105,0],[.11,-.087,0],[.178,.029,0],[.139,.084,0],[-.157,.075,0]];
          flatShape(p=>{p.moveTo(-.157,.075);p.lineTo(-.17,-.015);p.lineTo(-.1,-.1);p.lineTo(.109,-.083);p.lineTo(.175,.029);p.lineTo(.139,.08);p.closePath();},cel.flat({color:'#829caa',transparent:true,opacity:.52,depthWrite:false}),frame,[0,0,-.004]);
        }
        if (a.eyewear === 3) {
          outline = [[-.14,.043,0],[-.126,-.057,0],[.115,-.075,0],[.139,.044,0],[-.14,.043,0]];
          flatShape(s => { s.moveTo(-.14,.04); s.lineTo(-.122,-.062); s.lineTo(.112,-.07); s.lineTo(.137,.042); s.closePath(); }, flat('#554548'), frame, [0,0,-.005]);
        }
        curve(outline, a.eyewear === 4 ? .008 : lightFrame ? .017 : .018, a.eyewear === 4 || a.eyewear === 5 ? colors.brass : frameMaterial, frame, 36);
        rod([sign * .304, .004, .326], [sign * .379, .019, .052], a.eyewear === 4 ? .008 : .017, frameMaterial, head);
        round([sign * .276, -.004, .351], [.025, .01, .011], colors.brass, head);
      }
      curve([[-.043, -.029, .338], [0, -.014, .35], [.043, -.029, .338]], a.eyewear === 4 ? .008 : .017, frameMaterial, head, 8);
    }
    if (a.accessory === 'headphones') {
      const band = mesh(geo(new THREE.TorusGeometry(.56, .029, 8, 40, Math.PI)), dark, [0, .095, -.025], [1, 1.06, 1], head);
      for (const sign of [-1, 1]) {
        round([sign * .456, -.063, -.018], [.09, .204, .15], dark, head);
        round([sign * .504, -.063, -.018], [.041, .184, .127], colors.sage, head);
        rod([sign * .504, .018, -.025], [sign * .556, .1, -.025], .017, colors.brass, head);
      }
    }
    if (a.accessory === 'earbuds') {
      for (const sign of [-1, 1]) {
        ball([sign*.399,-.066,.067],[.027,.039,.026],cream,head);
        rod([sign*.404,-.075,.084],[sign*.407,-.172,.091],.014,cream,head);
        ball([sign*.407,-.174,.091],[.016,.018,.016],colors.brass,head);
      }
    } else if (a.accessory === 'cap') {
      const capMaterial = colors.sageDark;
      mesh(geo(new THREE.SphereGeometry(1,28,14,0,Math.PI*2,0,Math.PI/2)),capMaterial,[0,.285,-.025],[.508,.321,.446],head);
      const band=mesh(geo(new THREE.TorusGeometry(.477,.025,8,40)),colors.sage,[0,.288,-.025],[1,.88,1],head);band.rotation.x=Math.PI/2;
      const brim=round([0,.276,.396],[.848,.045,.42],capMaterial,head);brim.rotation.x=.075;
      for(let i=0;i<3;i++)round([-.039+i*.039,.443,.373],[.012,.025+(i%2)*.025,.015],cream,head);
    }
    // Pose rigs bend at a real elbow. Thin wrist and finger volumes stay clear.
    const limbs = [];
    const arms = a.pose === 'wave'
      ? [[[-.222, shoulderY, 0], [-.53, 1.97, .03], [-.64, 2.49, .02]], [[.222, shoulderY, 0], [.395, 1.66, .02], [.35, 1.31, .11]]]
      : a.pose === 'listen'
        ? [[[-.222, shoulderY, 0], [-.49, 2.13, .04], [-.27, 2.58, .06]], [[.222, shoulderY, 0], [.49, 2.14, .04], [.27, 2.58, .06]]]
        : a.pose === 'sing'
          ? [[[-.222, shoulderY, 0], [-.39, 1.7, .03], [-.45, 1.39, .13]], [[.222, shoulderY, 0], [.49, 1.94, .04], [.23, 2.27, .26]]]
          : [[[-.222, shoulderY, 0], [-.365, 1.66, .02], [-.38, 1.29, .085]], [[.222, shoulderY, 0], [.375, 1.68, -.01], [.42, 1.37, .11]]];
    if(liveMode&&a.pose==='sway'){arms[0]=[[-.222,shoulderY,0],[-.42,1.77,.025],[-.23,1.49,.19]];arms[1]=[[.222,shoulderY,0],[.325,1.75,.015],[.402,1.345,.04]];}
    arms.forEach((points, side) => {
      const limb = group(body); limbs.push(limb);
      const start = new THREE.Vector3(...points[0]), elbow = new THREE.Vector3(...points[1]), end = new THREE.Vector3(...points[2]);
      const shortSleeve = a.top === 0;
      const sleeveless = a.top === 5;
      const sleeveMat = a.top === 2 || a.top === 4 ? cream : cloth;
      const sleeveRadius = a.top === 3 ? .112 : a.top === 1 ? .09 : .066;
      if (sleeveless) {
        curve(points, .038, skin, limb, 15);
      } else if (shortSleeve) {
        const hem = start.clone().lerp(elbow, .64);
        sleeve([start.toArray(), start.clone().lerp(elbow,.3).toArray(),hem.toArray()],.114,cloth,limb,.167);
        const inset=hem.clone().lerp(start,.09);
        curve([inset.toArray(),elbow.toArray(),end.toArray()],.037,skin,limb,14);
      } else {
        sleeve(points,sleeveRadius,sleeveMat,limb,a.top===3?.176:.16);
        const dir = end.clone().sub(elbow).normalize();
        const cuff = cylinder(end.toArray(), [sleeveRadius * .84, .076, sleeveRadius * .84], a.top === 2 ? cream : seam, limb); cuff.quaternion.setFromUnitVectors(UP, dir);
        if (a.top === 4) for (let i = 1; i < 5; i++) {
          const centre = start.clone().lerp(elbow, i / 5); const stripe = cylinder(centre.toArray(), [.068, .031, .068], cloth, limb); stripe.quaternion.setFromUnitVectors(UP, elbow.clone().sub(start).normalize());
        }
      }
      const direction = end.clone().sub(elbow).normalize();
      const palmAt = end.clone().addScaledVector(direction, .085);
      const palm = ball(palmAt.toArray(), [.046, .081, .037], skin, limb); palm.quaternion.setFromUnitVectors(UP, direction);
      ball(palmAt.clone().add(new THREE.Vector3(side ? -.04 : .04, .02, .007)).toArray(), [.02, .042, .024], skin, limb);
      if (a.pose === 'wave' && side === 0) for (let f = 0; f < 3; f++) {
        const finger = ball([palmAt.x - .034 + f * .026, palmAt.y + .082, palmAt.z], [.014, .055 + (f % 2) * .012, .018], skin, limb); finger.rotation.z = .12 - f * .12;
      }
      if (a.pose === 'sing' && side === 1) {
        const mic = group(limb, [palmAt.x, palmAt.y + .064, palmAt.z]); mic.rotation.z = -.31;
        cylinder([0, 0, 0], [.025, .23, .025], dark, mic); ball([0, .132, 0], [.05, .067, .05], colors.sole, mic);
      }
    });
    const shadow = noShadow(mesh(unit.plane, shadowMaterial, [0, .014, 0], [1.1, .79, 1], root)); shadow.rotation.x = -Math.PI / 2;
    // Elongate the lower body and shorten the torso in body-local space. The
    // mesh geometry, camera and contact origin stay real 3D; shared unit shapes
    // are cloned before deformation. Head-to-height ratio is ~1:5.5, rather
    // than the former toy-like 1:3.2. Existing four arm rigs keep their pose.
    root.updateMatrixWorld(true);
    const bodyInverse = body.matrixWorld.clone().invert();
    body.traverse(object => {
      if (!object.isMesh) return;
      for (let ancestor = object; ancestor && ancestor !== body; ancestor = ancestor.parent) if (ancestor === head) return;
      const toBody = bodyInverse.clone().multiply(object.matrixWorld), fromBody = toBody.clone().invert();
      const geometry = geo(object.geometry.clone());
      const positions = geometry.attributes.position, vertex = new THREE.Vector3();
      for (let i = 0; i < positions.count; i++) {
        vertex.fromBufferAttribute(positions, i).applyMatrix4(toBody);
        const upperWeight=clamp((vertex.y-1.27)/.75,0,1);
        vertex.x+=upperWeight*.037;
        vertex.y-=upperWeight*vertex.x*.031;
        vertex.y = vertex.y <= 1.3 ? vertex.y * 1.12 : 1.456 + (vertex.y - 1.3) * .84;
        vertex.applyMatrix4(fromBody); positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
      }
      geometry.computeVertexNormals(); object.geometry = geometry;
    });
    head.rotation.z=-.035;
    body.rotation.y = slot === 'host' ? .075 : -.09;
    const ownedGeometries = [...resources.geometries].filter(g => !ownedBefore.has(g));
    return { root, lean, body, head, limbs, shadow, avatar: a, signature: JSON.stringify(a), phase: slot === 'host' ? 0 : 1.1, ownedGeometries };
  }
  function removePerson(person) {
    if (!person) return;
    people.remove(person.root);
    if(person.dispose){person.dispose();return;}
    person.ownedGeometries.forEach(g => { g.dispose(); resources.geometries.delete(g); });
  }

  let state = {}, disposed = false, raf = 0, lastFrame = 0, animationTime = 0;
  let width = 1, height = 1, sceneKey = '', backgroundSource = '', backgroundReady = true;
  let image = null, backgroundError = null, photoGeneration = 0, ready = Promise.resolve();
  let host = null, guest = null;
  const raycaster = new THREE.Raycaster(); const floor = new THREE.Plane(UP, 0);
  const point = new THREE.Vector3(); const bounds = {};
  const cameraLook = new THREE.Vector3(0,1.55,-.6);
  const occlusionRay = new THREE.Raycaster();
  let liveView='overview', livePersonId=null, cameraMove=null, cameraInitialized=false;
  function shotFor(view,id){
    const portraitAspect=width/height<.85;
    if(view==='person'){
      const person=livePeople.get(id);if(!person)return null;
      const origin=person.root.position,scale=person.root.scale.x;
      return {position:origin.clone().add(new THREE.Vector3(.6,portraitAspect?2.05:2.65,7).multiplyScalar(scale)),target:origin.clone().add(new THREE.Vector3(0,portraitAspect?1.05:1.65,0).multiplyScalar(scale))};
    }
    if(view==='photos'){
      const count=Math.max(1,Math.min(6,(state.photos||[]).length)),cols=galleryColumns(count,portraitAspect),rows=Math.ceil(count/cols);
      const halfFov=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),photoWidth=Math.max(1.5,cols*1.12);
      const top=2.64+rows*.73+.42+photoWidth/GALLERY_PRINT_ASPECT/2,bottom=2.64-(rows-1)*.73-.643;
      const safeTop=88,safeBottom=height-(portraitAspect?186:164),safeHeight=Math.max(120,safeBottom-safeTop);
      const distance=Math.max(4.3,photoWidth/(2*halfFov*(width/height)*.88),(top-bottom)/(2*halfFov*(safeHeight/height)))*1.04;
      const targetY=(top+bottom)/2-(height/2-(safeTop+safeBottom)/2)*(2*halfFov*distance)/height;
      return {position:new THREE.Vector3(6.79-distance,targetY+.33,photoWallCenterZ+.15),target:new THREE.Vector3(6.79,targetY,photoWallCenterZ)};
    }
    const overview=overviewCameraLayout(livePeople.size,portraitAspect,height);
    return {position:new THREE.Vector3(...overview.position),target:new THREE.Vector3(...overview.target)};
  }
  function getState(){return {scene:liveMode?{...liveRoomSummary,peopleCount:livePeople.size,venueAsset:{...venueStatus}}:undefined,view:liveView,id:livePersonId,personId:livePersonId,moving:!!cameraMove,mode:liveMode?'livehouse':'avatar',camera:{type:camera.type,projection:camera.isPerspectiveCamera?'perspective':'orthographic',position:camera.position.toArray(),target:cameraLook.toArray(),fov:camera.fov??null,aspect:width/height}};}
  function reportView(){state.onViewChange?.({view:liveView,id:livePersonId,moving:!!cameraMove});}
  function settleCamera(shot){camera.position.copy(shot.position);cameraLook.copy(shot.target);camera.lookAt(cameraLook);camera.updateMatrixWorld(true);}
  function goTo(view,id=null){
    if(!liveMode||disposed)return Promise.resolve(false);
    if(!['overview','person','photos'].includes(view))return Promise.resolve(false);
    const shot=shotFor(view,id);if(!shot)return Promise.resolve(false);
    cameraMove?.resolve(false);cameraMove=null;liveView=view;livePersonId=view==='person'?id:null;
    if(state.reducedMotion){settleCamera(shot);reportView();renderFrame();return Promise.resolve(true);}
    return new Promise(resolve=>{
      cameraMove={from:camera.position.clone(),fromLook:cameraLook.clone(),to:shot.position,toLook:shot.target,elapsed:0,duration:950,resolve};
      reportView();lastFrame=0;schedule();
    });
  }
  function advanceCamera(dt){
    if(!cameraMove)return;
    const move=cameraMove;move.elapsed+=dt*1000;
    const t=clamp(move.elapsed/move.duration,0,1),ease=t*t*(3-2*t);
    camera.position.lerpVectors(move.from,move.to,ease);cameraLook.lerpVectors(move.fromLook,move.toLook,ease);
    camera.lookAt(cameraLook);camera.updateMatrixWorld(true);
    if(t===1){cameraMove=null;move.resolve(true);reportView();}
  }
  function makeEditorialAvatar(a){
    const base=new THREE.Group();people.add(base);
    const shade=(color,factor)=>'#'+new THREE.Color(color).multiplyScalar(factor).getHexString();
    const palette={skin:SKINS[a.skin],skinShade:shade(SKINS[a.skin],.82),hair:HAIRS[a.hairColor],hairShade:shade(HAIRS[a.hairColor],.8),hairLight:HAIRS[a.hairColor],tee:GARMENT_COLORS[a.topColor],teeShade:shade(GARMENT_COLORS[a.topColor],.85),shorts:GARMENT_COLORS[a.bottomColor],canvas:GARMENT_COLORS[a.shoeColor]};
    const model=createBenchmarkCharacter(THREE,{cel:cel.cel,flat:cel.flat,palette,eyewear:a.eyewear!==0});base.add(model.root);
    model.root.traverse(o=>{if(o.isMesh){if(o.material?.isMeshBasicMaterial)o.castShadow=false;for(let n=o;n;n=n.parent)if(n.name==='head'){o.receiveShadow=false;break;}}});
    return {root:base,body:model.root,head:null,limbs:[],avatar:a,signature:JSON.stringify(a),phase:0,dispose:model.dispose};
  }
  function layoutLivePhotos(count){
    const columns=galleryColumns(count,width/height<.85),rows=Math.max(1,Math.ceil(count/columns));
    for(let i=0;i<count;i++){const row=Math.floor(i/columns),rowCount=Math.min(columns,count-row*columns);livePhotoFrames[i].position.set((i%columns-(rowCount-1)/2)*1.12,((rows-1)/2-row)*1.46,0);}
    if(liveWallTitle){const printWidth=Math.max(1.5,columns*1.12);liveWallTitle.position.y=2.64+rows*.73+.42;liveWallTitle.scale.set(printWidth,printWidth/GALLERY_PRINT_ASPECT,1);}
  }
  function updateLivePhotos(){
    if(!Array.isArray(state.photos))return;
    const incoming=state.photos.slice(0,6).filter(p=>p&&typeof p.url==='string'&&/^(blob:|data:image\/(?:png|jpeg|webp);)/.test(p.url));
    const signature=JSON.stringify(incoming);
    if(signature===livePhotoSignature)return;livePhotoSignature=signature;const generation=++livePhotoGeneration;
    stopLivePhotoLoads();
    livePhotoPreviews.splice(0);
    livePhotoSurfaces.forEach((material,i)=>{material.map?.dispose();resources.textures.delete(material.map);material.map=null;material.needsUpdate=true;livePhotoFrames[i].visible=false;delete livePhotoFrames[i].userData.hotspot;});
    layoutLivePhotos(incoming.length);if(cameraInitialized&&liveView==='photos'&&!cameraMove)settleCamera(shotFor('photos'));
    incoming.forEach((photo,i)=>{const image=new Image();pendingLivePhotoImages.add(image);image.onerror=()=>{pendingLivePhotoImages.delete(image);image.onload=image.onerror=null;if(!disposed&&generation===livePhotoGeneration)state.onPhotoError?.({id:photo.id,kind:'protected-photo'});};image.onload=()=>{
      pendingLivePhotoImages.delete(image);image.onload=image.onerror=null;
      if(disposed||generation!==livePhotoGeneration)return;
      const surface=document.createElement('canvas');surface.width=512;surface.height=640;const ctx=surface.getContext('2d');ctx.fillStyle='#f4f1e7';ctx.fillRect(0,0,512,640);
      const fit=Math.min(488/image.naturalWidth,588/image.naturalHeight);const w=image.naturalWidth*fit,h=image.naturalHeight*fit;ctx.drawImage(image,(512-w)/2,(604-h)/2,w,h);
      const texture=new THREE.CanvasTexture(surface);texture.colorSpace=THREE.SRGBColorSpace;resources.textures.add(texture);livePhotoSurfaces[i].map=texture;livePhotoSurfaces[i].needsUpdate=true;livePhotoFrames[i].visible=true;livePhotoFrames[i].userData.hotspot={id:photo.id,kind:'photo',label:photo.label||'查看现场照片'};
      livePhotoPreviews.push({...photo});renderFrame();
    };image.src=photo.url;});
  }
  function stopLivePhotoLoads(){for(const pending of pendingLivePhotoImages){pending.onload=pending.onerror=null;pending.removeAttribute?.('src');}pendingLivePhotoImages.clear();}
  function updateLivePeople(){
    const previousCount=livePeople.size;let selectedMoved=false;
    const definitions=Array.isArray(state.people)?state.people:LIVE_DEFAULT_PEOPLE;
    const keep=new Set();
    for(const[index,definition]of definitions.entries()){
      const id=String(definition.id||`person-${index}`),avatar=safeAvatar(definition.avatar),editorial=definition.character==='editorial'&&isEditorial(avatar),illustrated=definition.character==='illustrated',signature=JSON.stringify(avatar)+(illustrated?':illustrated':editorial?':editorial':'');keep.add(id);
      let person=livePeople.get(id);
      if(!person||person.signature!==signature){if(person)removePerson(person);person=illustrated?createIllustratedPerson(THREE,avatar,{onLoad:()=>renderFrame()}):editorial?makeEditorialAvatar(avatar):makeAvatar(avatar,`live-${id}`);if(illustrated)people.add(person.root);person.signature=signature;livePeople.set(id,person);}
      const position=definition.position||[index*1.8-2,0,1];
      if(id===livePersonId&&person.root.position.distanceTo(new THREE.Vector3(...position))>.001)selectedMoved=true;
      person.root.position.set(validNumber(position[0],0),validNumber(position[1],0),validNumber(position[2],1));
      person.root.scale.setScalar(clamp(validNumber(definition.scale,1),.6,1.3));
      person.root.rotation.y=validNumber(definition.rotation,0);
      person.root.userData.hotspot={id,kind:'person',label:String(definition.name||id)};person.definition=definition;
      person.phase=index*.95;
    }
    for(const[id,person]of livePeople)if(!keep.has(id)){removePerson(person);livePeople.delete(id);}
    if(liveView==='person'&&!livePeople.has(livePersonId)){liveView='overview';livePersonId=null;cameraMove?.resolve(false);cameraMove=null;settleCamera(shotFor('overview'));reportView();}
    if(cameraInitialized&&((liveView==='overview'&&previousCount!==livePeople.size)||(liveView==='person'&&selectedMoved))){const shot=shotFor(liveView,livePersonId);if(cameraMove){cameraMove.to.copy(shot.position);cameraMove.toLook.copy(shot.target);}else settleCamera(shot);}
    scene.updateMatrixWorld(true);
  }
  function getHotspots(){
    if(!liveMode||disposed)return[];
    scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
    const targets=[...livePeople.values()].map(person=>({ ...person.root.userData.hotspot,point:new THREE.Vector3(.043,3.13,0).applyMatrix4(person.root.matrixWorld)}));
    targets.push({id:'photos',kind:'photos',label:'照片墙',point:photoAnchor.clone()});
    return targets.map(item=>{
      const projected=item.point.clone().project(camera),delta=item.point.clone().sub(camera.position),distance=delta.length();
      let visible=projected.z>-1&&projected.z<1&&projected.x>-.97&&projected.x<.97&&projected.y>-.95&&projected.y<.97;
      if(visible){occlusionRay.set(camera.position,delta.normalize());occlusionRay.near=.05;occlusionRay.far=Math.max(.1,distance-.16);visible=!occlusionRay.intersectObjects(liveOccluders,false).some(hit=>{for(let node=hit.object;node;node=node.parent)if(!node.visible)return false;return true;});}
      return {id:item.id,kind:item.kind,label:item.label,x:(projected.x+1)/2,y:(1-projected.y)/2,visible};
    });
  }
  function pick(clientX,clientY){
    if(!liveMode||disposed)return null;
    const rect=container.getBoundingClientRect();
    const x=(clientX-rect.left)/rect.width,y=(clientY-rect.top)/rect.height;
    if(x<0||x>1||y<0||y>1)return null;
    raycaster.setFromCamera(new THREE.Vector2(x*2-1,1-y*2),camera);scene.updateMatrixWorld(true);
    const hits=raycaster.intersectObjects([people,liveRoom],true);
    for(const hit of hits){
      let visible=true;for(let node=hit.object;node;node=node.parent)if(!node.visible){visible=false;break;}if(!visible)continue;
      if(hit.object.userData.alphaAt&&!hit.object.userData.alphaAt(hit.uv))continue;
      for(let node=hit.object;node;node=node.parent)if(node.userData.hotspot)return {...node.userData.hotspot};
      if(!hit.object.material?.transparent)return null;
    }
    return null;
  }

  function positionPerson(person, value, slot) {
    if (!person) return;
    const transform = value?.transform || {};
    const x = clamp(validNumber(transform.x, slot === 'host' ? 37 : 66), 0, 100);
    const y = clamp(validNumber(transform.y, 81), 0, 100);
    raycaster.setFromCamera(new THREE.Vector2(x / 50 - 1, 1 - y / 50), camera);
    raycaster.ray.intersectPlane(floor, point);
    person.root.position.copy(point);
    const s = clamp(validNumber(transform.scale, 1), .3, 2);
    // The legacy DOM handles use 32% of artwork width for a 200x265 figure.
    // Follow that ratio, not viewport height, to keep previews and exports equal.
    const worldHeight = 7.8, viewAspect = width / height;
    const unitScale = worldHeight * viewAspect * .64 / 3.0;
    person.root.scale.setScalar(s * unitScale);
    person.lean.rotation.z = -THREE.MathUtils.degToRad(clamp(validNumber(transform.rotation, 0), -20, 20));
    const headHeight = (3.0 * s * unitScale / worldHeight) * 100;
    bounds[slot] = { x, y, left: x - 16 * s, top: y - headHeight, width: 32 * s, height: headHeight };
  }
  function updatePeople() {
    if(liveMode){updateLivePeople();return;}
    for (const slot of ['host', 'guest']) {
      const value = state[slot]; let person = slot === 'host' ? host : guest;
      if (!value) { if (person) removePerson(person); person = null; }
      else {
        const sig = JSON.stringify(safeAvatar(value.avatar));
        if (!person || sig !== person.signature) { if (person) removePerson(person); person = makeAvatar(value.avatar, slot); }
        positionPerson(person, value, slot);
      }
      if (slot === 'host') host = person; else guest = person;
    }
  }
  function setBackground(source) {
    if (source === backgroundSource) return;
    backgroundSource = source; const generation = ++photoGeneration;
    image = null; backgroundError = null;
    if (!source) { backgroundReady = true; ready = Promise.resolve(); return; }
    if (!/^(data:image\/(?:png|jpeg|webp);|blob:)/i.test(source)) {
      backgroundReady = false; backgroundError = new Error('Pass an already-authorized local photo data URL or blob URL'); ready = Promise.resolve(); return;
    }
    backgroundReady = false;
    ready = new Promise(resolve => {
      const candidate = new Image();
      candidate.onload = () => {
        if (disposed || generation !== photoGeneration) { resolve(); return; }
        image = candidate; backgroundReady = true; canvas.style.opacity = '1'; renderFrame(); resolve();
      };
      candidate.onerror = () => {
        if (generation === photoGeneration) backgroundError = new Error('The local photograph could not be decoded');
        resolve();
      };
      candidate.src = source;
    });
  }
  // Photo pixels bypass colour grading. DOM presentation can place this canvas
  // over its original photo, and capture composites the exact same cover crop.
  function updateSet() {
    if(liveMode){
      buildLivehouse();updateLivePhotos();set.visible=true;scene.background=new THREE.Color('#17171e');renderer.setClearColor('#17171e',1);setBackground('');
      warm.color.set('#ebe4fa');warm.groundColor.set('#473b59');warm.intensity=.94;
      moon.color.set('#ffefd2');moon.position.set(-3.8,7.3,5.4);moon.intensity=1.12;
      fill.color.set('#c5b6ef');fill.position.set(4,4.7,7);fill.intensity=.36;
      poolA.color.set('#e8b878');poolA.position.set(-2.4,3.9,-2.4);poolA.intensity=15;
      poolB.color.set('#c8b3ea');poolB.position.set(4.7,3.2,.2);poolB.intensity=9;
      ink.uInk.value.set('#282431');ink.uStrength.value=.24;ink.uSens.value=.0085;ink.uConcaveAmount.value=0;ink.uFadeStart.value=27;ink.uFadeEnd.value=55;
      grade.uShadowTint.value.set('#f0f1ef');grade.uLightTint.value.set('#ffffff');grade.uWarmth.value=0;grade.uSaturation.value=1;grade.uLift.value=0;grade.uVignette.value=.075;
      return;
    }
    const photo = state.scene?.kind === 'photo';
    const key = photo ? 'photo' : (['rooftop-night', 'sakura-night', 'fan-stage'].includes(state.scene?.id) ? state.scene.id : 'rooftop-night');
    if (key !== sceneKey) {
      sceneKey = key;
      if (!photo && !sceneGroups.has(key)) makeSet(key);
      sceneGroups.forEach((g, id) => { g.visible = id === key; });
      scene.background = photo ? null : sky;
      renderer.setClearColor(PALETTE.sky, photo ? 0 : 1);
      renderer.shadowMap.needsUpdate = true;
    }
    set.visible = !photo;
    setBackground(photo ? state.scene?.dataUrl || state.scene?.background || state.background || '' : '');
    // Avoid guessing automatic depth/occlusion in a flat photograph.
    warm.intensity = photo ? 1.6 : 1.2; fill.intensity = photo ? .45 : .52;
    poolA.intensity = photo ? 0 : 15; poolB.intensity = photo ? 0 : 12;
    grade.uVignette.value = photo ? 0 : .12;
  }
  function animate(dt) {
    const moving = state.playing && !state.reducedMotion;
    if (moving) animationTime += dt;
    const beat = animationTime * clamp(validNumber(state.bpm, 78), 40, 180) / 60 * Math.PI;
    for (const person of (liveMode?[...livePeople.values()]:[host,guest])) {
      if (!person) continue;
      person.updateFacing?.(camera);
      const t = beat + person.phase, sway = moving ? Math.sin(t) : 0;
      person.body.rotation.z = sway * .035;
      person.body.position.y = moving ? (1 - Math.cos(t * 2)) * .008 : 0;
      if(person.head){person.head.rotation.z = -.035 + sway * -.028;person.head.rotation.y = sway * .025;}
      if (person.avatar.pose === 'wave' && person.limbs[0]) person.limbs[0].rotation.z = moving ? Math.sin(t * 2) * .045 : 0;
    }
    if (moving) renderer.shadowMap.needsUpdate = true;
  }
  function renderFrame() {
    if (disposed || renderer.getContext().isContextLost()) return;
    if(liveMode&&camera.isPerspectiveCamera){
      // A camera-specific architectural cutaway keeps the real wall legible.
      // Geometry and membership remain in the scene; return restores them.
      const showForeground=liveView!=='photos';
      if(liveTruss&&liveTruss.visible!==showForeground){liveTruss.visible=showForeground;renderer.shadowMap.needsUpdate=true;}
      for(const [id,person] of livePeople)person.root.visible=showForeground&&(liveView!=='person'||id===livePersonId);
    }
    if(liveMode)for(const person of livePeople.values())person.updateFacing?.(camera);
    pipeline.render();
    if(liveMode)state.onHotspots?.(getHotspots());
  }
  function tick(now) {
    raf = 0;
    if (disposed) return;
    if (!document.hidden) {
      const dt = lastFrame ? Math.min((now - lastFrame) / 1000, .06) : 0; lastFrame = now;
      advanceCamera(dt);animate(dt);renderFrame();
    }
    if ((cameraMove || state.playing && !state.reducedMotion) && !document.hidden) raf = requestAnimationFrame(tick);
  }
  function schedule() {
    if (!raf && !disposed) raf = requestAnimationFrame(tick);
  }
  function resize() {
    if (disposed) return;
    const rect = container.getBoundingClientRect();
    width = Math.max(2, Math.round(rect.width || container.clientWidth || 400));
    height = Math.max(2, Math.round(rect.height || container.clientHeight || 500));
    if(liveMode){camera.aspect=width/height;camera.fov=43;}else{camera.left=-3.9*width/height;camera.right=3.9*width/height;}
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    pipeline.setSize(width, height);
    updatePeople();
    if(liveMode){layoutLiveStagePrint();layoutLivePhotos((state.photos||[]).length);const shot=shotFor(liveView,livePersonId)||shotFor('overview');if(cameraMove){cameraMove.resolve(false);cameraMove=null;}settleCamera(shot);cameraInitialized=true;reportView();}
    renderer.shadowMap.needsUpdate = true; renderFrame();
  }
  function update(nextState = {}) {
    if (disposed) return;
    state = liveMode?{...state,...nextState,mode:'livehouse'}:{...nextState,scene:nextState.scene||{kind:'builtin',id:'rooftop-night'}};
    updateSet();updatePeople();animate(0);
    if(liveMode&&state.reducedMotion&&cameraMove){const move=cameraMove;cameraMove=null;settleCamera({position:move.to,target:move.toLook});move.resolve(true);reportView();}
    renderer.shadowMap.needsUpdate = true; renderFrame(); schedule();
  }
  function capture(options = {}) {
    if (disposed) throw new Error('The 3D scene has been disposed');
    if (renderer.getContext().isContextLost()) throw new Error('The graphics context is unavailable');
    if (state.scene?.kind === 'photo' && (!backgroundReady || backgroundError)) throw backgroundError || new Error('The photograph is still loading');
    if (state.scene?.kind === 'photo' && !image) throw new Error('A resolved local photograph is required to capture this scene');
    const exportWidth = Math.round(clamp(validNumber(options.width, width), 2, 2400));
    const exportHeight = Math.round(clamp(validNumber(options.height, exportWidth * height / width), 2, 3200));
    if (Math.abs(exportWidth / exportHeight - width / height) > .01) throw new Error('Capture must preserve the artwork aspect ratio');
    const resized = exportWidth !== width || exportHeight !== height;
    try {
      if (resized) pipeline.setSize(exportWidth, exportHeight);
      renderFrame();
      if (state.scene?.kind !== 'photo') return canvas.toDataURL('image/png');
      const output = document.createElement('canvas'); output.width = canvas.width; output.height = canvas.height;
      const ctx = output.getContext('2d');
      const scale = Math.max(output.width / image.naturalWidth, output.height / image.naturalHeight);
      const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
      ctx.drawImage(image, (output.width - w) / 2, (output.height - h) / 2, w, h);
      ctx.drawImage(canvas, 0, 0); return output.toDataURL('image/png');
    } finally {
      if (resized) { pipeline.setSize(width, height); renderFrame(); }
    }
  }

  const portraitCache = new Map();
  function portrait(avatar, options = {}) {
    if (disposed) throw new Error('The 3D scene has been disposed');
    if (renderer.getContext().isContextLost()) throw new Error('The graphics context is unavailable');
    const normalized = { ...safeAvatar(avatar), pose: 'sway' };
    const fullBody = options.fullBody === true;
    const size = Math.round(clamp(validNumber(options.size, 256), 96, 768));
    const key = JSON.stringify([normalized, fullBody, size]);
    if (portraitCache.has(key)) return portraitCache.get(key);
    const savedCamera=camera;
    const hiddenLivePeople=[...livePeople.values()].map(person=>[person,person.root.visible]);
    const saved = {
      cameraPosition: camera.position.clone(), cameraQuaternion: camera.quaternion.clone(),
      left: camera.left, right: camera.right, top: camera.top, bottom: camera.bottom,
      background: scene.background, setVisible: set.visible,
      hostVisible: host?.root.visible, guestVisible: guest?.root.visible,
      clearColor: renderer.getClearColor(new THREE.Color()), clearAlpha: renderer.getClearAlpha(),
      warm: warm.intensity, fill: fill.intensity, poolA: poolA.intensity, poolB: poolB.intensity,
      vignette: grade.uVignette.value,
    };
    let model;
    try {
      if(liveMode){camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,80);pipeline.camera=camera;hiddenLivePeople.forEach(([person])=>person.root.visible=false);}
      set.visible = false; if (host) host.root.visible = false; if (guest) guest.root.visible = false;
      scene.background = null; renderer.setClearColor(0, 0);
      warm.intensity = 1.5; fill.intensity = .78; poolA.intensity = poolB.intensity = 0; grade.uVignette.value = 0;
      model = makeAvatar(normalized, 'portrait'); model.shadow.visible = false;
      model.body.rotation.y = -.045;
      const portraitHeight = fullBody ? Math.round(size * 1.5) : size;
      const halfHeight = fullBody ? 1.61 : .52;
      camera.left = -halfHeight * size / portraitHeight; camera.right = -camera.left;
      camera.top = halfHeight; camera.bottom = -halfHeight;
      const targetY = fullBody ? 1.43 : 2.58;
      camera.position.set(0, targetY + .16, 12); camera.lookAt(0, targetY, 0);
      camera.updateProjectionMatrix(); camera.updateMatrixWorld();
      pipeline.setSize(size, portraitHeight); renderer.shadowMap.needsUpdate = true; renderFrame();
      const result = canvas.toDataURL('image/png');
      portraitCache.set(key, result);
      if (portraitCache.size > 48) portraitCache.delete(portraitCache.keys().next().value);
      return result;
    } finally {
      removePerson(model);camera=savedCamera;pipeline.camera=camera;hiddenLivePeople.forEach(([person,visible])=>person.root.visible=visible);
      set.visible = saved.setVisible; if (host) host.root.visible = saved.hostVisible; if (guest) guest.root.visible = saved.guestVisible;
      scene.background = saved.background; renderer.setClearColor(saved.clearColor, saved.clearAlpha);
      warm.intensity = saved.warm; fill.intensity = saved.fill; poolA.intensity = saved.poolA; poolB.intensity = saved.poolB;
      grade.uVignette.value = saved.vignette;
      camera.position.copy(saved.cameraPosition); camera.quaternion.copy(saved.cameraQuaternion);
      camera.left = saved.left; camera.right = saved.right; camera.top = saved.top; camera.bottom = saved.bottom;
      camera.updateProjectionMatrix(); camera.updateMatrixWorld();
      pipeline.setSize(width, height); renderer.shadowMap.needsUpdate = true; renderFrame();
    }
  }
  const onVisibility = () => { lastFrame = 0; if (!document.hidden) schedule(); };
  const onContextLost = event => { event.preventDefault(); cancelAnimationFrame(raf); raf = 0; container.dispatchEvent(new CustomEvent('toonerror',{detail:{reason:'context-lost'}}));state.onError?.(new Error('WebGL context lost')); };
  const onContextRestored = () => { if (!disposed) { renderer.shadowMap.needsUpdate = true; resize(); schedule(); } };
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);
  document.addEventListener('visibilitychange', onVisibility);
  const observer = new ResizeObserver(resize); observer.observe(container);
  update(initialState); resize();
  if(liveMode&&initialState.venueAssetUrl){
    venueStatus={status:'loading'};
    venueReady=loadBlenderVenue({url:initialState.venueAssetUrl,cel,signal:venueAbort.signal,palette:VENUE_PRINT_PALETTE}).then(asset=>{
      if(disposed){asset.dispose();return;}
      const gallery=liveRoom.getObjectByName('livehouse-gallery');
      // Retain runtime-owned photo surfaces, frames and title. Only replace
      // static architecture; never attach an asset-owned photo or person.
      for(const child of liveRoom.children)if(child!==gallery&&child!==liveWallTitle)child.visible=false;
      liveRoom.add(asset.root);venueAsset=asset;liveTruss=asset.cutaway;
      addLiveStagePrint();
      liveOccluders.splice(0,liveOccluders.length,...asset.occluders);
      gallery.position.copy(asset.gallery.position);gallery.quaternion.copy(asset.gallery.quaternion);
      // Runtime photo display is centered inside the full real wall, instead
      // of framing its open front edge on a wide desktop camera.
      photoWallCenterZ=-1.8;gallery.position.z=photoWallCenterZ;liveWallTitle.position.z=photoWallCenterZ;photoAnchor.z=photoWallCenterZ;
      venueStatus={...asset.summary};
      liveRoomSummary={...liveRoomSummary,roomMeshCount:asset.summary.meshCount,roomBounds:asset.summary.bounds,depthSpan:asset.summary.bounds.max[2]-asset.summary.bounds.min[2],artDirection:'printed-livehouse-v1',stagePrint:true};
      renderer.shadowMap.needsUpdate=true;renderFrame();schedule();
    }).catch(error=>{
      if(disposed)return;
      venueStatus={status:'fallback',reason:String(error.message)};
      initialState.onVenueError?.(error);renderFrame();
    });
  }
  return {
    update,capture,portrait,goTo,getHotspots,getState,pick,resize,
    getPhotoPreviews(){return livePhotoPreviews.map(photo=>({...photo}));},
    setReducedMotion(value){update(liveMode?{reducedMotion:!!value}:{...state,reducedMotion:!!value});},
    get ready() { return liveMode?Promise.all([ready,venueReady]):ready; },
    getBounds: () => structuredClone(bounds),
    dispose() {
      if (disposed) return; disposed = true;photoGeneration++;cameraMove?.resolve(false);cameraMove=null;venueAbort.abort();venueAsset?.dispose();
      cancelAnimationFrame(raf); observer.disconnect();livePhotoGeneration++;stopLivePhotoLoads();for(const person of livePeople.values())if(person.dispose)person.dispose();
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onContextLost); canvas.removeEventListener('webglcontextrestored', onContextRestored);
      pipeline.dispose(); cel.dispose();
      resources.geometries.forEach(g => g.dispose()); resources.materials.forEach(m => m.dispose()); resources.textures.forEach(t => t.dispose());
      moon.shadow.dispose(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
      scene.clear();sceneGroups.clear();portraitCache.clear();livePeople.clear();liveOccluders.length=0;livePhotoFrames.length=0;livePhotoPreviews.length=0;image=null;
    },
  };
}

/** Standalone modeled-room entry point. This does not load the reference artwork. */
export function mountLivehouseScene(container,options={}){
  try{return mountToonScene(container,{...options,mode:'livehouse'});}
  catch(error){options.onError?.(error);throw error;}
}
