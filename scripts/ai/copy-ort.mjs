// Copy the onnxruntime-web 1.30.0 runtime files the on-device viewpoint model needs into web/public/ai/ort/, so Vite ships them
// next to index.html (never inlined) and the browser loads them from the app's own origin. Runs before `npm run dev` / `build`
// (see the predev / prebuild scripts) and by hand as `npm run ai:ort`.
//
//   Copies ONLY: ort.wasm.min.mjs, ort-wasm-simd-threaded.mjs, ort-wasm-simd-threaded.wasm  (from node_modules/onnxruntime-web/dist)
//   Refuses:     another onnxruntime-web version, or files whose SHA-256 differs from the audited ones below, or a .wasm whose
//                size disagrees with `wasmBytes` in web/public/ai/tc8/labels.json (space-ai.js checks that length in the browser).
//   Leaves alone: nothing else. Any other file found in web/public/ai/ort/ is deleted (the folder is generated and git-ignored).
//
// To move to another onnxruntime-web version: change package.json, the version and the three hashes below, regenerate labels.json
// (`node scripts/ai/build-labels.mjs`, which records the new wasm size), and bump CACHE_NAME in web/js/ai/space-ai.js.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const VERSION = '1.30.0';
const FILES = {
  'ort.wasm.min.mjs': '219e6a1fc8a9938268d18efca3c91d310bd2f4a59bbd13744df5b2b7fc6cee3b',
  'ort-wasm-simd-threaded.mjs': 'e13f7f94fc51b4ca72b12faeb1ee95f4ace6dfbc8939bc718aabdc0a27c4299b',
  'ort-wasm-simd-threaded.wasm': '3398c10d07d229bd91b364548e130e0e51a8e5704b88c7c083ebbeb78842dee2',
};

const root = fileURLToPath(new URL('../../', import.meta.url));
const source = join(root, 'node_modules', 'onnxruntime-web');
const target = join(root, 'web', 'public', 'ai', 'ort');
const sha256 = file => createHash('sha256').update(readFileSync(file)).digest('hex');

function stop(message) {
  console.error(`ai:ort - ${message}`);
  process.exit(1);
}

if (!existsSync(join(source, 'package.json'))) stop('onnxruntime-web is not installed. Run `npm ci` first.');
const installed = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8')).version;
if (installed !== VERSION) stop(`onnxruntime-web ${installed} is installed, but the model pack is verified against ${VERSION}. Run \`npm ci\`.`);

mkdirSync(target, { recursive: true });
for (const entry of readdirSync(target)) if (!(entry in FILES)) rmSync(join(target, entry), { recursive: true, force: true });

let copied = 0;
for (const [name, expected] of Object.entries(FILES)) {
  const from = join(source, 'dist', name);
  if (!existsSync(from)) stop(`${from} is missing from the package.`);
  const actual = sha256(from);
  if (actual !== expected) stop(`${name} has SHA-256 ${actual}, expected ${expected}.`);
  const to = join(target, name);
  if (existsSync(to) && sha256(to) === expected) continue;
  copyFileSync(from, to);
  copied += 1;
}

const labels = JSON.parse(readFileSync(join(root, 'web', 'public', 'ai', 'tc8', 'labels.json'), 'utf8'));
const wasmSize = statSync(join(target, labels.wasm)).size;
if (wasmSize !== labels.wasmBytes) stop(`${labels.wasm} is ${wasmSize} bytes but labels.json says ${labels.wasmBytes}.`);

console.log(`ai:ort - onnxruntime-web ${VERSION}: ${Object.keys(FILES).length} files in web/public/ai/ort/ (${copied} copied)`);
