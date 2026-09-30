// Step 4 of the model pack: assemble web/public/ai/tc8/labels.json (and install vision.onnx next to it), or check that the committed
// pair is exactly what the pipeline produces.
//
//   node scripts/ai/build-labels.mjs            write labels.json and copy the quantised image tower to web/public/ai/tc8/vision.onnx
//   node scripts/ai/build-labels.mjs --check    change nothing; exit 1 unless the committed labels.json and vision.onnx are byte-identical
//   AI_WORK=/some/dir  work directory (default scripts/ai/work/).   REPO_ROOT=/some/dir  repo root (default: two levels up)
//
// labels.json holds what the browser needs besides the model: the class order, the four L2-normalised viewpoint text vectors
// (mean of the L2-normalised `en7` prompt embeddings per class, normalised again, rounded to 5 decimals), the logit scale (100, CLIP's
// usual temperature), the CLIP mean / std, the centre-crop size, the model file name, and the exact byte sizes of vision.onnx and of the
// onnxruntime-web .wasm (space-ai.js refuses a download whose length differs, so a truncated or stale file never gets used).
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { CLASSES, PROMPT_SETS } from './prompts.mjs';

const check = process.argv.includes('--check');
const work = process.env.AI_WORK || fileURLToPath(new URL('./work/', import.meta.url));
const root = process.env.REPO_ROOT || fileURLToPath(new URL('../../', import.meta.url));
const packDir = path.join(root, 'web', 'public', 'ai', 'tc8');
const quantised = path.join(work, 'models', 'local', 'tinyclip-8m-16', 'onnx', 'vision_model_quantized.onnx');
const ortWasm = path.join(root, 'node_modules', 'onnxruntime-web', 'dist', 'ort-wasm-simd-threaded.wasm');
const PROMPT_SET = 'en7';
const CLIP_MEAN = [0.48145466, 0.4578275, 0.40821073];
const CLIP_STD = [0.26862954, 0.26130258, 0.27577711];

const norm = vector => { let s = 0; for (const x of vector) s += x * x; s = Math.sqrt(s) || 1; return vector.map(x => x / s); };
const mean = vectors => { const o = new Array(vectors[0].length).fill(0); for (const v of vectors) for (let i = 0; i < o.length; i++) o[i] += v[i]; return o.map(x => x / vectors.length); };
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const need = file => { if (!fs.existsSync(file)) { console.error(`missing ${file}: run the earlier steps first (see scripts/ai/README.md)`); process.exit(2); } return file; };

const text = JSON.parse(fs.readFileSync(need(path.join(work, 'textemb_tinyclip-8m.json')), 'utf8'));
const set = PROMPT_SETS[PROMPT_SET];
const vectors = CLASSES.map(name => norm(mean(set[name].map(prompt => norm(text.prompts[prompt])))));
const labels = {
  version: 1,
  model: 'vision.onnx',
  modelBytes: fs.statSync(need(quantised)).size,
  wasm: 'ort-wasm-simd-threaded.wasm',
  wasmBytes: fs.statSync(need(ortWasm)).size,
  source: 'local/tinyclip-8m-16/onnx/vision_model_quantized.onnx',
  promptSet: PROMPT_SET,
  classes: CLASSES,
  input: 'pixel_values',
  output: 'image_embeds',
  scale: 100,
  preprocess: { size: 224, mean: CLIP_MEAN, std: CLIP_STD, squash: false },
  vectors: vectors.map(v => v.map(x => +x.toFixed(5))),
};
const labelsBytes = Buffer.from(JSON.stringify(labels));
const modelBytes = fs.readFileSync(quantised);
const shipped = { labels: path.join(packDir, 'labels.json'), model: path.join(packDir, 'vision.onnx') };

console.log(`labels.json  ${labelsBytes.length} bytes  sha256 ${sha256(labelsBytes)}`);
console.log(`vision.onnx  ${modelBytes.length} bytes  sha256 ${sha256(modelBytes)}`);
if (check) {
  const same = (file, bytes) => fs.existsSync(file) && sha256(fs.readFileSync(file)) === sha256(bytes);
  const results = { 'labels.json': same(shipped.labels, labelsBytes), 'vision.onnx': same(shipped.model, modelBytes) };
  for (const [name, ok] of Object.entries(results)) console.log(`${ok ? 'identical' : 'DIFFERENT'}  web/public/ai/tc8/${name}`);
  process.exit(Object.values(results).every(Boolean) ? 0 : 1);
}
fs.mkdirSync(packDir, { recursive: true });
fs.writeFileSync(shipped.labels, labelsBytes);
fs.writeFileSync(shipped.model, modelBytes);
console.log('written to', packDir);
