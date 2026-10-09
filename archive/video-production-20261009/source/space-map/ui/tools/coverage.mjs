// Which characters of the map's UI copy each Doodle face lacks (they fall back to a system font until the font script is re-run).
import { readFileSync } from 'node:fs';
const repo = '/Users/alakazan/workplace/tme/musicSpace/';
const css = readFileSync(repo + 'web/event-room/public/fonts/doodle/fonts.css', 'utf8');
const faces = {};
for (const m of css.matchAll(/@font-face\{font-family:"([^"]+)";[^}]*unicode-range:([^;}]+)/g)) {
  const set = faces[m[1]] ||= [];
  for (const part of m[2].split(',')) { const [a, b] = part.trim().replace(/^U\+/, '').split('-'); set.push([parseInt(a, 16), parseInt(b || a, 16)]); }
}
const has = (face, cp) => (faces[face] || []).some(([a, b]) => cp >= a && cp <= b);
const files = ['js/app.js', 'js/home.js', 'js/map.js', 'js/open-catalogue.js', 'js/share-card.js', 'js/space-bridge.js', 'index.html', 'js/map-catalogue.js'];
const text = files.map(f => readFileSync(repo + 'web/original-map/' + f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')).join('');
const hf = JSON.parse(readFileSync(repo + 'web/original-map/assets/data/hf-collaborations.json', 'utf8'));
const all = text + hf.tracks.map(t => t.title + t.artists.join('') + t.album).join('');
const chars = [...new Set([...all].filter(c => /[　-鿿＀-￯]/.test(c)))];
for (const face of ['Doodle Display', 'Doodle Marker', 'Doodle Hand']) {
  const missing = chars.filter(c => !has(face, c.codePointAt(0)));
  console.log(face, 'missing', missing.length, missing.join(''));
}
const uiOnly = [...new Set([...files.slice(0, 7).map(f => readFileSync(repo + 'web/original-map/' + f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')).join('')].filter(c => /[　-鿿＀-￯]/.test(c)))];
console.log('UI copy (no data):', uiOnly.length, 'chars; Marker missing:', uiOnly.filter(c => !has('Doodle Marker', c.codePointAt(0))).join(''), '; Hand missing:', uiOnly.filter(c => !has('Doodle Hand', c.codePointAt(0))).join(''), '; Display missing:', uiOnly.filter(c => !has('Doodle Display', c.codePointAt(0))).join(''));
