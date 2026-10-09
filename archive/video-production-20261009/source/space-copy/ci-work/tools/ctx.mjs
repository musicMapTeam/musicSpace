// usage: node ctx.mjs <file> <word> [<word>...]  -> prints each occurrence with 60 chars of context
import {readFileSync} from 'node:fs';
const [file, ...words] = process.argv.slice(2);
const s = readFileSync(file, 'utf8');
for (const w of words) {
  let i = -1, n = 0;
  console.log(`== ${w}`);
  while ((i = s.indexOf(w, i + 1)) >= 0) { n++; console.log(`  [${i}] …${s.slice(Math.max(0, i - 70), i + w.length + 70).replace(/\s+/g, ' ')}…`); if (n > 25) { console.log('  (more)'); break; } }
}
