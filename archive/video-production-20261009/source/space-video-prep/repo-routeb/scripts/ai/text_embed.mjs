// Step 3 of the model pack: embed every prompt of prompts.mjs with the fp32 TinyCLIP TEXT tower (Node, onnxruntime-node via
// transformers.js). Offline, developer machine only: the text tower is never shipped and no text is ever encoded in a browser.
//
//   cd scripts/ai && npm ci && cd ../..      (installs @huggingface/transformers 4.3.0; see scripts/ai/package.json)
//   node scripts/ai/text_embed.mjs           (AI_WORK=/some/dir to choose the work directory; default scripts/ai/work/)
//
// Reads  <work>/models/local/tinyclip-8m-16/  (made by extract_tinyclip.py: config, tokenizer, onnx/text_model.onnx)
// Writes <work>/textemb_tinyclip-8m.json      { model, dim, prompts: { "<prompt>": [512 floats] } }
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env, AutoTokenizer, CLIPTextModelWithProjection } from '@huggingface/transformers';
import { PROMPT_SETS } from './prompts.mjs';

const work = process.env.AI_WORK || fileURLToPath(new URL('./work/', import.meta.url));
env.allowRemoteModels = false; // never download anything from here: the model directory below must already exist
env.allowLocalModels = true;
env.localModelPath = path.join(work, 'models') + path.sep;

const KEY = 'tinyclip-8m';
const DIR = 'local/tinyclip-8m-16';
const prompts = [...new Set(Object.values(PROMPT_SETS).flatMap(set => Object.values(set).flat()))];
console.log('unique prompts:', prompts.length);

const started = performance.now();
const tokenizer = await AutoTokenizer.from_pretrained(DIR);
const model = await CLIPTextModelWithProjection.from_pretrained(DIR, { dtype: 'fp32' });
const out = {};
const BATCH = 8;
for (let i = 0; i < prompts.length; i += BATCH) {
  const batch = prompts.slice(i, i + BATCH);
  const inputs = tokenizer(batch, { padding: 'max_length', max_length: 77, truncation: true });
  const { text_embeds } = await model(inputs);
  const dim = text_embeds.dims[1];
  batch.forEach((prompt, j) => { out[prompt] = Array.from(text_embeds.data.slice(j * dim, (j + 1) * dim)); });
}
const file = path.join(work, `textemb_${KEY}.json`);
fs.writeFileSync(file, JSON.stringify({ model: KEY, dim: Object.values(out)[0].length, prompts: out }));
console.log(KEY, 'done in', Math.round(performance.now() - started), 'ms, dim', Object.values(out)[0].length, '->', file);
