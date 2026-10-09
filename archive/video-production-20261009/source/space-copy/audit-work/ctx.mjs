import fs from 'node:fs';
const [file, ...words] = process.argv.slice(2);
const s = fs.readFileSync(file, 'utf8');
for (const w of words) {
  const re = new RegExp(w, 'g'); let m; const hits = [];
  while ((m = re.exec(s))) hits.push(s.slice(Math.max(0, m.index - 70), m.index + 50).replace(/\s+/g, ' '));
  console.log(`== ${w} (${hits.length})`);
  for (const h of hits.slice(0, 40)) console.log('   ' + h);
}
