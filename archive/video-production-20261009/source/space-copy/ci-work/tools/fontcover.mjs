// Which CJK characters added by the working-tree diff (UI sources) are not covered by each Doodle family's unicode-range?
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const repo = '/Users/alakazan/workplace/tme/musicSpace';
const css = readFileSync(`${repo}/web/event-room/public/fonts/doodle/fonts.css`, 'utf8');
const fam = {};
for (const m of css.matchAll(/@font-face\{font-family:"([^"]+)";[^}]*unicode-range:([^;}]+)/g)) {
  const set = fam[m[1]] ||= [];
  for (const part of m[2].split(',')) { const r = part.trim().replace('U+', '').split('-'); set.push([parseInt(r[0], 16), parseInt(r[1] || r[0], 16)]); }
}
const covered = (f, cp) => (fam[f] || []).some(([a, b]) => cp >= a && cp <= b);
const diff = execFileSync('git', ['diff', '-U0', '--', 'web', 'runtime-preview/src', 'scripts/build/static-html-plugin.mjs'], {cwd: repo, encoding: 'utf8', maxBuffer: 64 << 20});
const added = diff.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++')).join('\n');
const chars = [...new Set([...added].filter(c => /[㐀-鿿]/.test(c)))];
for (const f of ['Doodle Marker', 'Doodle Hand', 'Doodle Display']) console.log(f, 'missing:', chars.filter(c => !covered(f, c.codePointAt(0))).join(''));
console.log('families:', Object.keys(fam).join(', '));
