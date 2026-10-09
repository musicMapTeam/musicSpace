// After `npm run build`: check that dist/ carries the on-device model pack and that nothing heavy was inlined into index.html.
// Run by CI (`npm run ai:check`) and by hand. Exit 1 lists every problem. It applies the same length rule the browser applies
// (space-ai.js refuses a download whose size differs from labels.json), so a stale or partial copy cannot ship unnoticed.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(fileURLToPath(new URL('../../', import.meta.url)), 'dist');
const MAX_INDEX_BYTES = 5_000_000; // index.html is ~1.7 MB; the model alone would add 8.8 MB, the WASM 14 MB
const ORT_FILES = ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm', 'ort.wasm.min.mjs'];
const problems = [];
const sizeOf = file => (existsSync(join(dist, file)) ? statSync(join(dist, file)).size : -1);

const labelsPath = join(dist, 'ai', 'tc8', 'labels.json');
if (!existsSync(labelsPath)) {
  problems.push('dist/ai/tc8/labels.json is missing (is web/public/ai/tc8 committed and publicDir unchanged?)');
} else {
  const labels = JSON.parse(readFileSync(labelsPath, 'utf8'));
  if (sizeOf(`ai/tc8/${labels.model}`) !== labels.modelBytes) problems.push(`dist/ai/tc8/${labels.model} is ${sizeOf(`ai/tc8/${labels.model}`)} bytes, labels.json says ${labels.modelBytes}`);
  if (sizeOf(`ai/ort/${labels.wasm}`) !== labels.wasmBytes) problems.push(`dist/ai/ort/${labels.wasm} is ${sizeOf(`ai/ort/${labels.wasm}`)} bytes, labels.json says ${labels.wasmBytes}`);
}
for (const file of ORT_FILES) if (sizeOf(`ai/ort/${file}`) <= 0) problems.push(`dist/ai/ort/${file} is missing (npm run ai:ort copies it; npm run build runs that first)`);
if (existsSync(join(dist, 'ai', 'ort'))) {
  const extra = readdirSync(join(dist, 'ai', 'ort')).filter(name => !ORT_FILES.includes(name));
  if (extra.length) problems.push(`dist/ai/ort has files beyond the three runtime files: ${extra.join(', ')}`);
}
for (const file of ['ai/tc8/LICENSE-TinyCLIP-MIT.txt', 'ai/LICENSE-onnxruntime-web-MIT.txt']) if (sizeOf(file) <= 0) problems.push(`dist/${file} is missing (licence texts travel with the model and runtime)`);
if (sizeOf('index.html') <= 0) problems.push('dist/index.html is missing');
else if (sizeOf('index.html') > MAX_INDEX_BYTES) problems.push(`dist/index.html is ${sizeOf('index.html')} bytes (limit ${MAX_INDEX_BYTES}): the model or runtime may have been inlined`);

if (problems.length) {
  console.error(`ai:check - ${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`ai:check - ok: model ${sizeOf('ai/tc8/vision.onnx')} B, wasm ${sizeOf('ai/ort/ort-wasm-simd-threaded.wasm')} B, index.html ${sizeOf('index.html')} B, ai/ort holds exactly ${ORT_FILES.length} files`);
