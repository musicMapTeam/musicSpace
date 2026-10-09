import {readFileSync} from 'node:fs';
const plan = JSON.parse(readFileSync('/tmp/space-copy/plan/shell.json','utf8'));
const root = '/Users/alakazan/workplace/tme/musicSpace/';
let missing = 0, checked = 0;
for (const [i, c] of plan.changes.entries()) {
  const src = readFileSync(root + c.file, 'utf8');
  const parts = c.new.split('‖').map(s => s.trim()).flatMap(s => s.split(' / ').length > 1 && /身份|请先确认|新招呼/.test(s) ? s.split(' / ').map(x => x.trim()) : [s]);
  for (let p of parts) {
    if (!p || p.startsWith('(remove') || p === '') continue;
    // template placeholders
    if (p.includes('${')) p = p.split('${')[0].trim();
    if (p.includes('{n}')) p = p.split('{n}').pop().trim();
    if (!p) continue;
    checked++;
    if (!src.includes(p)) { missing++; console.log(`#${i+1} ${c.file}: MISSING «${p}»   (current: ${c.current.slice(0,60)})`); }
  }
}
console.log(`checked ${checked} strings, missing ${missing}`);
