// Inventory of user-visible string literals (CJK or flagged Latin) in JS files, via rolldown's oxc parser.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('/Users/alakazan/workplace/tme/musicSpace/package.json');
const { parseAst } = await import(require.resolve('rolldown/parseAst'));
const CJK = /[　-〿一-鿿＀-￯]/;
const files = process.argv.slice(2);
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const lineStarts = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === '\n') lineStarts.push(i + 1);
  // oxc offsets are UTF-16? rolldown returns offsets in UTF-16 code units for JS strings; verify by slicing.
  const lineOf = off => { let lo = 0, hi = lineStarts.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lineStarts[mid] <= off) lo = mid; else hi = mid - 1; } return lo + 1; };
  let ast;
  try { ast = parseAst(src, { sourceType: 'module' }, file); } catch (e) { console.error('PARSE FAIL', file, e.message); continue; }
  const out = [];
  const walk = (node, parent) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(n => walk(n, parent)); return; }
    if (node.type === 'Literal' && typeof node.value === 'string' && CJK.test(node.value)) out.push([lineOf(node.start), 'str', node.value]);
    if (node.type === 'TemplateLiteral') {
      const parts = node.quasis.map(q => q.value.cooked ?? q.value.raw);
      const joined = parts.join('${…}');
      if (CJK.test(joined)) out.push([lineOf(node.start), 'tpl', joined]);
      // still walk expressions inside
      node.expressions.forEach(e => walk(e, node));
      return;
    }
    for (const key of Object.keys(node)) { if (key === 'parent') continue; const v = node[key]; if (v && typeof v === 'object') walk(v, node); }
  };
  walk(ast.program ?? ast, null);
  out.sort((a, b) => a[0] - b[0]);
  for (const [line, kind, text] of out) console.log(`${file.replace(/^.*?web\//, 'web/')}:${line}\t${kind}\t${text.replace(/\s+/g, ' ').trim()}`);
}
