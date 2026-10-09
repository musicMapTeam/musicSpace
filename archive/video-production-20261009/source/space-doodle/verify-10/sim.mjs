// Simulate overview framing: current vs proposed variants. Window coords = stage.left(28) + stage-relative.
import * as THREE from '/Users/alakazan/workplace/tme/musicSpace/node_modules/three/build/three.module.js';
const R = [.87004, 0, .493];
function positions(count, gapFn, shift = 0) {
  const right = [.87004, .493], gap = gapFn(count), centerZ = 2;
  return Array.from({ length: count }, (_, i) => { const x = (i - (count - 1) / 2) * gap + shift, depth = count > 2 ? (i % 2 ? .1 : -.1) : 0; return [right[0] * x + right[1] * depth, 0, centerZ + right[1] * x - right[0] * depth]; });
}
function cam(count, camShift = 0) {
  const distance = count > 4 ? 14.4 : 10.8;
  const pos = [-.493 * distance, 2.15 + .20 * distance, 1 + .87004 * distance], tgt = [0, 2.15, 1];
  return { position: pos.map((v, k) => v + camShift * R[k]), target: tgt.map((v, k) => v + camShift * R[k]) };
}
const rotations = [.18, -.18, -.35, .38, -.35, .2, -.2, -.3];
function run(label, vp, count, { gapFn, camShift = 0, groupShift = 0 }) {
  const [W, H] = vp; const sw = W - 56; // stage inset 28 each side
  const stageTop = 88, stageBottom = { 900: 782, 800: 682, 1080: 962, 768: 650, 864: 746, 982: 864, 1117: 999, 1050: 932, 1440: 1322 }[H] ?? (H - 118);
  const sh = stageBottom - stageTop;
  const shot = cam(count, camShift), camera = new THREE.PerspectiveCamera(43, sw / sh, .08, 90);
  camera.position.set(...shot.position); camera.lookAt(...shot.target); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
  const cardLeft = W - 500; // .presence right:60 max-width:440
  const out = [];
  positions(count, gapFn, groupShift).forEach((p, i) => {
    const root = new THREE.Object3D(); root.position.set(...p); root.rotation.y = rotations[i]; root.updateMatrixWorld();
    const head = new THREE.Vector3(.043, 3.13, 0).applyMatrix4(root.matrixWorld).project(camera);
    const sx = (head.x + 1) / 2 * sw, sy = (1 - head.y) / 2 * sh;
    const tagCx = Math.max(72, Math.min(sw - 72, sx)) + 28;
    // body extent: +-0.5 world units along camera right at chest height
    const bl = new THREE.Vector3(p[0] - .5 * R[0], 1.6, p[2] - .5 * R[2]).project(camera), br = new THREE.Vector3(p[0] + .5 * R[0], 1.6, p[2] + .5 * R[2]).project(camera);
    const foot = new THREE.Vector3(p[0], 0, p[2]).project(camera);
    out.push({ i, tag: [Math.round(tagCx - 64), Math.round(tagCx + 64)], body: [Math.round((bl.x + 1) / 2 * sw + 28), Math.round((br.x + 1) / 2 * sw + 28)], headY: Math.round(sy + stageTop), footY: Math.round((1 - foot.y) / 2 * sh + stageTop) });
  });
  const ph = new THREE.Vector3(6.57, 2.65, -.65).project(camera), phx = Math.round((ph.x + 1) / 2 * sw + 28);
  const last = out[out.length - 1];
  // stage print / venue reference: where does world x=-4 (left speakers) land
  const spk = new THREE.Vector3(-4.2, 1.5, -1).project(camera);
  console.log(`${label.padEnd(8)} ${W}x${H} n=${count} cardL=${cardLeft} lastTag=${last.tag} lastBody=${last.body} firstBody=${out[0].body} heads=${out.map(o => o.headY)} feet=${out.map(o => o.footY)} photoTagX=${phx} spkX=${Math.round((spk.x + 1) / 2 * sw + 28)} ${last.tag[1] < cardLeft - 10 ? 'OK' : 'UNDER-CARD'}${out[0].body[0] < 28 + 20 ? ' LEFT-CUT' : ''}`);
}
const cur = c => c > 4 ? 1.45 : 2.15, tight = c => c > 3 ? 1.45 : 2.15;
const vps = [[1280, 800], [1366, 768], [1440, 900], [1512, 982], [1536, 864], [1920, 1080], [1728, 1117]];
for (const count of [4, 5]) for (const vp of vps) {
  run('current', vp, count, { gapFn: cur });
  run('V1rev', vp, count, { gapFn: tight, camShift: 1.8 });
}
console.log('--- 1/2/3/6/8 members');
for (const count of [1, 2, 3, 6, 8]) for (const vp of [[1280, 800], [1440, 900], [1920, 1080]]) { run('current', vp, count, { gapFn: cur }); run('V1rev', vp, count, { gapFn: tight, camShift: 1.8 }); }
