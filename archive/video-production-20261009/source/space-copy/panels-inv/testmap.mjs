import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';
const root = '/Users/alakazan/workplace/tme/musicSpace';
const walk = dir => readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const testFiles = [...walk(join(root,'tests')), ...walk(join(root,'runtime-preview/tests')), ...walk(join(root,'scripts/test'))].filter(f => /\.(m?js|cjs)$/.test(f));
const tests = testFiles.map(f => [f.replace(root+'/',''), readFileSync(f,'utf8')]);
const rows = readFileSync('/tmp/space-copy/panels-inv/strings.tsv','utf8').trim().split('\n').map(l => l.split('\t'));
const seen = new Map();
for (const [loc, s] of rows) {
  if ([...s].length < 3) continue;
  if (/^(const|let|function)\b/.test(s)) continue;
  const key = s;
  if (!seen.has(key)) seen.set(key, {locs: [], hits: tests.filter(([,c]) => c.includes(s)).map(([f]) => f)});
  seen.get(key).locs.push(loc);
}
for (const [s, {locs, hits}] of seen) if (hits.length) console.log(`${locs.join(',')}\t${s}\t${hits.join(' ')}`);
