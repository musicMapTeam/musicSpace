import {readFileSync} from 'node:fs';
const files = process.argv.slice(2);
const re = /[^'"`<>{}$\n]*[一-鿿　-〿＀-￯][^'"`<>{}$\n]*/g;
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    // skip comment lines
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
    const found = [...line.matchAll(re)].map(m => m[0].trim()).filter(s => s && !/^\/\//.test(s));
    for (const s of found) console.log(`${f.replace(/^.*web\//,'web/')}:${i+1}\t${s}`);
  });
}
