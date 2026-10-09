import * as THREE from '/Users/alakazan/workplace/tme/musicSpace/node_modules/three/build/three.module.js';
const R = [.87004, 0, .493], rot = [.18, -.18, -.35, .38, -.35, .2, -.2, -.3];
const pos = (count, gap) => Array.from({ length: count }, (_, i) => { const x = (i - (count - 1) / 2) * gap, d = count > 2 ? (i % 2 ? .1 : -.1) : 0; return [.87004 * x + .493 * d, 0, 2 + .493 * x - .87004 * d]; });
function shot(count, k) { const D = count > 4 ? 14.4 : 10.8; return { p: [-.493 * D + k * R[0], 2.15 + .2 * D, 1 + .87004 * D + k * R[2]], t: [k * R[0], 2.15, 1 + k * R[2]] }; }
function proj(sw, sh, count, gap, k) {
  const s = shot(count, k), cam = new THREE.PerspectiveCamera(43, sw / sh, .08, 90); cam.position.set(...s.p); cam.lookAt(...s.t); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  return pos(count, gap).map((p, i) => { const o = new THREE.Object3D(); o.position.set(...p); o.rotation.y = rot[i]; o.updateMatrixWorld(); const h = new THREE.Vector3(.043, 3.13, 0).applyMatrix4(o.matrixWorld).project(cam); const bl = new THREE.Vector3(p[0] - .5 * R[0], 1.6, p[2] - .5 * R[2]).project(cam), br = new THREE.Vector3(p[0] + .5 * R[0], 1.6, p[2] + .5 * R[2]).project(cam); const ft = new THREE.Vector3(...p).project(cam), hd = new THREE.Vector3(p[0], 3.35, p[2]).project(cam); return { hx: (h.x + 1) / 2 * sw, bl: (bl.x + 1) / 2 * sw, br: (br.x + 1) / 2 * sw, fx: (ft.x + 1) / 2 * sw, fy: (1 - ft.y) / 2 * sh, hdx: (hd.x + 1) / 2 * sw, hdy: (1 - hd.y) / 2 * sh }; });
}
const vps = [[1280, 800], [1366, 768], [1440, 900], [1440, 790], [1512, 982], [1536, 864], [1536, 730], [1680, 1050], [1728, 1117], [1920, 1080], [1920, 950], [2560, 1440]];
const stageH = (W, H) => H - 206; // stage: top 88, bottom H-118
for (const [name, gapFn, k] of [['current', c => c > 4 ? 1.45 : 2.15, 0], ['rev k1.8 gap1.45@4', c => c > 3 ? 1.45 : 2.15, 1.8], ['k2.2 gap1.45@4', c => c > 3 ? 1.45 : 2.15, 2.2], ['k2.4 gap1.45@3', c => c > 2 ? 1.45 : 2.15, 2.4]]) {
  let fails = [], worstLeft = 1e9, testFail = [];
  for (const [W, H] of vps) for (let n = 1; n <= 8; n++) {
    const sw = W - 56, sh = stageH(W, H), cardL = W - 500 - 28; // stage-relative
    const P = proj(sw, sh, n, gapFn(n), k);
    const last = P[P.length - 1], lastTagR = Math.max(72, Math.min(sw - 72, last.hx)) + 64;
    const over = Math.round(lastTagR - cardL), bodyOver = Math.round(last.br - cardL);
    worstLeft = Math.min(worstLeft, P[0].bl);
    if (over > -8 || bodyOver > 0) fails.push(`${W}x${H} n${n} tag+${over} body+${bodyOver}`);
  }
  for (const n of [2, 4, 8]) { const P = proj(1365, 900, n, gapFn(n), k); for (const q of P) { if (!(q.fx > 120 && q.fx < 1245 && q.hdx > 120 && q.hdx < 1245)) testFail.push(`n${n} x=${Math.round(q.fx)}`); if (!(q.fy > 170 && q.fy < 715 && q.hdy > 170 && q.hdy < 715)) testFail.push(`n${n} y=${Math.round(q.fy)}/${Math.round(q.hdy)}`); } }
  console.log(`\n## ${name}: ${fails.length} under-card cases; min first-body-left(stage px)=${Math.round(worstLeft)}; unit test(1365x900) fails: ${testFail.join(' ') || 'none'}`);
  console.log('  ' + fails.join('\n  '));
}
