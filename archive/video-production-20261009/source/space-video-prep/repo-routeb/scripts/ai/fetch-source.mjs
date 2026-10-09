// Step 1 of the model pack: fetch the pinned TinyCLIP-ViT-8M/16 ONNX export and verify every byte.
//
//   node scripts/ai/fetch-source.mjs            (AI_WORK=/some/dir to choose the work directory; default scripts/ai/work/)
//   HF_ENDPOINT=https://hf-mirror.com node ...  (optional mirror; the SHA-256 checks below still decide what is accepted)
//
// Source: https://huggingface.co/onnx-community/TinyCLIP-ViT-8M-16-Text-3M-YFCC15M-ONNX at commit 9463a9c508a344c837ffefe9d724f3827bf2dc79
// (an automatic ONNX conversion of wkcn/TinyCLIP-ViT-8M-16-Text-3M-YFCC15M @ a2a8c6eaa2549ad66eb7c31b85022bf58273a26c; MIT).
// The commit is pinned, not `main`. This runs on a developer machine only: the app never contacts huggingface.co.
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const REPO = 'onnx-community/TinyCLIP-ViT-8M-16-Text-3M-YFCC15M-ONNX';
const COMMIT = '9463a9c508a344c837ffefe9d724f3827bf2dc79';
const FILES = {
  'onnx/model.onnx': { bytes: 94071688, sha256: '31d28cb07209533d10fc4fef73ac324ce17de6741a2372e7e1531a4ac8fdaeb2' },
  'config.json': { bytes: 850, sha256: '0ca46b868f12305e959a1cfa2b8085e7bffd521f68769ec3bf2999986b55bec3' },
  'preprocessor_config.json': { bytes: 468, sha256: '5df7e578c37e907a431daf47fd592fc49fa50d23ed4c41285a0a34a58a9d2e06' },
  'tokenizer.json': { bytes: 3642073, sha256: '6d9109cc838977f3ca94a379eec36aecc7c807e1785cd729660ca2fc0171fb35' },
  'tokenizer_config.json': { bytes: 726, sha256: 'f97b07bf147d9e4dbdb5f98941d35fc0b9412263a183483f73893adf756ede3e' },
  'special_tokens_map.json': { bytes: 133, sha256: '92e1e31d71a7f63cd75b4dfa1469377bd2cd6b8292cf70b3ff5b7082b0edc1c9' },
  'vocab.json': { bytes: 862328, sha256: '5047b556ce86ccaf6aa22b3ffccfc52d391ea4accdab9c2f2407da5b742d4363' },
  'merges.txt': { bytes: 524619, sha256: '9fd691f7c8039210e0fced15865466c65820d09b63988b0174bfe25de299051a' },
};

const work = process.env.AI_WORK || fileURLToPath(new URL('./work/', import.meta.url));
const target = join(work, 'models', 'onnx-community', 'TinyCLIP-ViT-8M-16-Text-3M-YFCC15M-ONNX');
const endpoint = (process.env.HF_ENDPOINT || 'https://huggingface.co').replace(/\/$/, '');

async function sha256Of(file) {
  const hash = createHash('sha256');
  await pipeline(createReadStream(file), hash);
  return hash.digest('hex');
}

for (const [path, want] of Object.entries(FILES)) {
  const file = join(target, path);
  if (existsSync(file) && statSync(file).size === want.bytes && (await sha256Of(file)) === want.sha256) {
    console.log(`ok (already here)  ${path}`);
    continue;
  }
  mkdirSync(dirname(file), { recursive: true });
  const url = `${endpoint}/${REPO}/resolve/${COMMIT}/${path}`;
  process.stdout.write(`GET ${url}\n`);
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  const partial = `${file}.part`;
  const hash = createHash('sha256');
  let bytes = 0;
  const counter = async function* (source) { for await (const chunk of source) { hash.update(chunk); bytes += chunk.length; yield chunk; } };
  await pipeline(Readable.fromWeb(response.body), counter, createWriteStream(partial));
  const got = hash.digest('hex');
  if (bytes !== want.bytes || got !== want.sha256) throw new Error(`${path}: got ${bytes} bytes / ${got}, expected ${want.bytes} bytes / ${want.sha256}`);
  renameSync(partial, file);
  console.log(`ok (downloaded)    ${path}  ${bytes} bytes  ${got}`);
}
console.log(`source verified in ${target}`);
