import { mountToonScene as mountNew } from '/Users/alakazan/workplace/tme/musicSpace/web/avatar/three-scene.js';
import { mountToonScene as mountOld } from './old/three-scene.js';
const A1 = { version: 2, skin: 1, hair: 3, hairColor: 2, top: 2, bottom: 1, shoes: 0, eyewear: 1, topColor: 3, bottomColor: 0, shoeColor: 2, accessory: 'chain', expression: 'smile', pose: 'wave' };
const A2 = { version: 2, skin: 3, hair: 1, hairColor: 0, top: 0, bottom: 0, shoes: 1, eyewear: 0, topColor: 0, bottomColor: 1, shoeColor: 1, accessory: 'none', expression: 'neutral', pose: 'listen' };
const T = { x: 37, y: 81, scale: 1, rotation: 0 };
function photo() { const c = document.createElement('canvas'); c.width = 600; c.height = 800; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 600, 800); g.addColorStop(0, '#203050'); g.addColorStop(1, '#e09060'); x.fillStyle = g; x.fillRect(0, 0, 600, 800); x.fillStyle = '#fff'; x.fillRect(100, 100, 120, 300); return c.toDataURL('image/png'); }
const cases = [
  ['rooftop', { scene: { kind: 'builtin', id: 'rooftop-night' }, host: { avatar: A1, transform: T }, guest: null, playing: false, bpm: 90, reducedMotion: true }],
  ['sakura-duo', { scene: { kind: 'builtin', id: 'sakura-night' }, host: { avatar: A1, transform: T }, guest: { avatar: A2, transform: { ...T, x: 66 } }, playing: false, bpm: 90, reducedMotion: true }],
  ['fanstage-duo', { scene: { kind: 'builtin', id: 'fan-stage' }, host: { avatar: A2, transform: T }, guest: { avatar: A1, transform: { ...T, x: 68, scale: .92, rotation: 3 } }, playing: false, bpm: 120, reducedMotion: true }],
  ['photo', { scene: { kind: 'photo', dataUrl: photo() }, host: { avatar: A1, transform: T }, guest: null, playing: false, bpm: 90, reducedMotion: true }],
];
async function run(mount, el) {
  const out = {}; const s = mount(el, cases[0][1]);
  for (const [name, state] of cases) { s.update(state); await s.ready; await new Promise(r => setTimeout(r, 120)); out[name] = s.capture(); out[name + '@1440'] = s.capture({ width: 1440, height: 1920 }); }
  out.portrait = s.portrait(A1); out.portraitFull = s.portrait(A2, { fullBody: true }); out.state = JSON.stringify(s.getState());
  s.dispose(); return out;
}
window.__compare = (async () => {
  const oldOut = await run(mountOld, document.getElementById('a'));
  const newOut = await run(mountNew, document.getElementById('b'));
  const result = {};
  for (const k of Object.keys(oldOut)) result[k] = { same: oldOut[k] === newOut[k], len: [oldOut[k].length, newOut[k].length] };
  window.__images = { oldOut, newOut };
  return result;
})();
